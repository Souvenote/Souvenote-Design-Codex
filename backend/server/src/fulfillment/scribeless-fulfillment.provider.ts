import {
  BadGatewayException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type ProviderOperation,
  ProviderTelemetryService,
} from '../observability/provider-telemetry.service';
import {
  FulfillmentSubmissionError,
  type FulfillmentProvider,
  type FulfillmentProviderRequest,
} from './fulfillment.provider';

export const SCRIBELESS_FETCH = Symbol('SCRIBELESS_FETCH');
export type ScribelessFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type ScribelessCampaign = {
  id?: unknown;
  status?: unknown;
  delivery_method?: unknown;
  frequency?: unknown;
  variables?: unknown;
};

type ScribelessRecipient = {
  id?: unknown;
  status?: unknown;
  is_rendered?: unknown;
  campaign_id?: unknown;
  variables?: unknown;
  documents?: unknown;
};

@Injectable()
export class ScribelessFulfillmentProvider implements FulfillmentProvider {
  readonly mode = 'scribeless' as const;
  private readonly baseUrl = 'https://platform.scribeless.co/api';

  constructor(
    private readonly configService: ConfigService,
    @Inject(SCRIBELESS_FETCH) private readonly request: ScribelessFetch,
    @Optional()
    private readonly providerTelemetry?: ProviderTelemetryService,
  ) {}

  async submit(request: FulfillmentProviderRequest) {
    this.assertConfirmedFoldedWorkflow();
    this.assertCampaignSender(request.senderAddress);
    const campaignId = this.requiredSetting('SCRIBELESS_CAMPAIGN_ID');
    const campaign = await this.fetchCampaign(campaignId);
    this.assertCampaign(campaign, campaignId, Boolean(request.qrCodeUrl));

    const imageVariable = this.variableName(
      'SCRIBELESS_IMAGE_VARIABLE',
      'frontImageUrl',
    );
    const messageVariable = this.variableName(
      'SCRIBELESS_MESSAGE_VARIABLE',
      'insideMessage',
    );
    const qrVariable = this.variableName('SCRIBELESS_QR_VARIABLE', 'qrCodeUrl');
    const data = request.recipients.map(({ externalId, address }) => ({
      firstName: address.firstName,
      lastName: address.lastName,
      address: {
        address1: address.address1,
        ...(address.address2 ? { address2: address.address2 } : {}),
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      },
      variables: {
        externalId,
        [imageVariable]: request.frontImageUrl,
        [messageVariable]: request.insideMessage,
        ...(request.qrCodeUrl ? { [qrVariable]: request.qrCodeUrl } : {}),
      },
    }));

    let response: Response;
    try {
      response = await this.fetchWithTimeout(
        'recipient_create',
        '/recipients',
        {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ campaignId, data }),
        },
      );
    } catch (error) {
      throw new FulfillmentSubmissionError(
        `Scribeless submission outcome is unknown: ${this.errorMessage(error)}`,
        true,
      );
    }

    if (!response.ok) {
      throw new FulfillmentSubmissionError(
        `Scribeless rejected the fulfillment request (${response.status}): ${await this.errorBody(response)}`,
        response.status >= 500,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new FulfillmentSubmissionError(
        'Scribeless accepted the request but returned an unreadable response.',
        true,
      );
    }
    if (!Array.isArray(payload) || payload.length !== data.length) {
      throw new FulfillmentSubmissionError(
        'Scribeless accepted the request but returned an unexpected recipient count.',
        true,
      );
    }

    let recipients: Array<{
      id: string;
      status: string;
      isRendered: boolean | null;
    }>;
    try {
      recipients = payload.map((value) =>
        this.parseRecipient(value, campaignId),
      );
    } catch (error) {
      throw new FulfillmentSubmissionError(
        `Scribeless accepted the request but returned invalid recipient data: ${this.errorMessage(error)}`,
        true,
      );
    }
    const providerRecipientIds = recipients.map((recipient) => recipient.id);
    const statuses = recipients.map((recipient) => recipient.status);
    return {
      providerFulfillmentId: providerRecipientIds[0],
      providerRecipientIds,
      providerCampaignId: campaignId,
      providerStatus: this.aggregateStatus(statuses),
      estimatedDelivery: null,
      responseMetadata: {
        recipientCount: recipients.length,
        recipientStatuses: statuses,
        renderedCount: recipients.filter((recipient) => recipient.isRendered)
          .length,
      },
    };
  }

  async fetchStatus(providerRecipientIds: string[]) {
    if (!providerRecipientIds.length) {
      throw new InternalServerErrorException(
        'Scribeless fulfillment has no recipient IDs to reconcile.',
      );
    }

    const recipients = await Promise.all(
      providerRecipientIds.map(async (recipientId) => {
        const response = await this.fetchWithTimeout(
          'recipient_get',
          `/recipients/${encodeURIComponent(recipientId)}`,
          { method: 'GET', headers: this.headers() },
        );
        if (!response.ok) {
          throw new BadGatewayException(
            `Scribeless recipient status request failed (${response.status}): ${await this.errorBody(response)}`,
          );
        }
        return this.parseRecipient(await response.json());
      }),
    );
    const statuses = recipients.map((recipient) => recipient.status);
    return {
      providerStatus: this.aggregateStatus(statuses),
      recipientStatuses: recipients.map((recipient) => ({
        id: recipient.id,
        status: recipient.status,
        isRendered: recipient.isRendered,
      })),
      responseMetadata: {
        recipientCount: recipients.length,
        renderedCount: recipients.filter((recipient) => recipient.isRendered)
          .length,
      },
    };
  }

  private async fetchCampaign(campaignId: string) {
    const response = await this.fetchWithTimeout(
      'campaign_get',
      `/campaigns/${encodeURIComponent(campaignId)}`,
      { method: 'GET', headers: this.headers() },
    );
    if (!response.ok) {
      throw new BadGatewayException(
        `Scribeless campaign validation failed (${response.status}): ${await this.errorBody(response)}`,
      );
    }
    return (await response.json()) as ScribelessCampaign;
  }

  private assertCampaign(
    campaign: ScribelessCampaign,
    campaignId: string,
    qrRequired: boolean,
  ) {
    if (campaign.id !== campaignId) {
      throw new InternalServerErrorException(
        'Scribeless returned a mismatched campaign.',
      );
    }
    if (String(campaign.delivery_method).toLowerCase() !== 'directmail') {
      throw new InternalServerErrorException(
        'SCRIBELESS_CAMPAIGN_ID must use directMail delivery.',
      );
    }
    if (String(campaign.frequency).toLowerCase() !== 'recurring') {
      throw new InternalServerErrorException(
        'SCRIBELESS_CAMPAIGN_ID must be a recurring campaign; one-time checkout is not automated.',
      );
    }

    const status = String(campaign.status).trim().toLowerCase();
    const allowPending = this.readBoolean(
      'SCRIBELESS_ALLOW_PENDING_CAMPAIGN',
      false,
    );
    if (
      !['live', 'ready'].includes(status) &&
      !(allowPending && status === 'pending')
    ) {
      throw new InternalServerErrorException(
        'Scribeless campaign must be live/ready, or pending only when SCRIBELESS_ALLOW_PENDING_CAMPAIGN=true.',
      );
    }

    const availableVariables = new Set(
      Array.isArray(campaign.variables)
        ? campaign.variables
            .map((variable) => {
              if (!variable || typeof variable !== 'object') return '';
              const id = (variable as { id?: unknown }).id;
              return typeof id === 'string' ? id : '';
            })
            .filter(Boolean)
        : [],
    );
    const expectedVariables = [
      this.variableName('SCRIBELESS_IMAGE_VARIABLE', 'frontImageUrl'),
      this.variableName('SCRIBELESS_MESSAGE_VARIABLE', 'insideMessage'),
      ...(qrRequired
        ? [this.variableName('SCRIBELESS_QR_VARIABLE', 'qrCodeUrl')]
        : []),
    ];
    const missing = expectedVariables.filter(
      (variable) => !availableVariables.has(variable),
    );
    if (missing.length) {
      throw new InternalServerErrorException(
        `Scribeless campaign template is missing variables: ${missing.join(', ')}.`,
      );
    }
  }

  private parseRecipient(value: unknown, expectedCampaignId?: string) {
    if (!value || typeof value !== 'object') {
      throw new Error('Scribeless returned an invalid recipient.');
    }
    const recipient = value as ScribelessRecipient;
    const id = typeof recipient.id === 'string' ? recipient.id.trim() : '';
    const status =
      typeof recipient.status === 'string'
        ? recipient.status.trim().toLowerCase()
        : '';
    if (!id || !status) {
      throw new Error('Scribeless returned an incomplete recipient.');
    }
    if (
      expectedCampaignId &&
      recipient.campaign_id !== undefined &&
      recipient.campaign_id !== expectedCampaignId
    ) {
      throw new Error('Scribeless returned a recipient from another campaign.');
    }
    return {
      id,
      status,
      isRendered:
        typeof recipient.is_rendered === 'boolean'
          ? recipient.is_rendered
          : null,
    };
  }

  private aggregateStatus(statuses: string[]) {
    const normalized = statuses.map((status) =>
      status
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_'),
    );
    const priority = [
      'not_sent',
      'deleted',
      'failed',
      'hold',
      'admin_hold',
      'pending',
      'ready',
      'in_progress',
      'printing',
      'shipped',
      'delivered',
    ];
    return priority.find((status) => normalized.includes(status)) ?? 'unknown';
  }

  private async fetchWithTimeout(
    operation: ProviderOperation,
    path: string,
    init: RequestInit,
  ) {
    const timeoutMs = this.readInteger(
      'SCRIBELESS_REQUEST_TIMEOUT_MS',
      30_000,
      1_000,
      120_000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const action = () =>
        this.request(`${this.baseUrl}${path}`, {
          ...init,
          redirect: 'error',
          signal: controller.signal,
        });
      return await (this.providerTelemetry
        ? this.providerTelemetry.measureHttp('scribeless', operation, action)
        : action());
    } finally {
      clearTimeout(timeout);
    }
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.requiredSetting('SCRIBELESS_API_KEY'),
    };
  }

  private assertConfirmedFoldedWorkflow() {
    if (!this.readBoolean('SCRIBELESS_FOLDED_WORKFLOW_CONFIRMED', false)) {
      throw new InternalServerErrorException(
        'Scribeless folded-card workflow is disabled. Confirm a team-specific folded campaign and set SCRIBELESS_FOLDED_WORKFLOW_CONFIRMED=true.',
      );
    }
    if (!this.readBoolean('SCRIBELESS_CAMPAIGN_SENDER_CONFIRMED', false)) {
      throw new InternalServerErrorException(
        'Confirm the Scribeless campaign return address and set SCRIBELESS_CAMPAIGN_SENDER_CONFIRMED=true.',
      );
    }
  }

  private assertCampaignSender(
    senderAddress: FulfillmentProviderRequest['senderAddress'],
  ) {
    const configured = this.requiredSetting(
      'SCRIBELESS_CAMPAIGN_SENDER_ADDRESS_JSON',
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(configured);
    } catch {
      throw new InternalServerErrorException(
        'SCRIBELESS_CAMPAIGN_SENDER_ADDRESS_JSON must be valid JSON.',
      );
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new InternalServerErrorException(
        'SCRIBELESS_CAMPAIGN_SENDER_ADDRESS_JSON must contain an address object.',
      );
    }
    const record = parsed as Record<string, unknown>;
    const fields: Array<keyof typeof senderAddress> = [
      'firstName',
      'lastName',
      'address1',
      'address2',
      'city',
      'state',
      'postalCode',
      'country',
    ];
    const mismatch = fields.some(
      (field) =>
        this.normalizedAddressValue(record[field]) !==
        this.normalizedAddressValue(senderAddress[field]),
    );
    if (mismatch) {
      throw new InternalServerErrorException(
        'The order sender address does not match the confirmed Scribeless campaign return address.',
      );
    }
  }

  private normalizedAddressValue(value: unknown) {
    return typeof value === 'string'
      ? value.trim().replace(/\s+/g, ' ').toLowerCase()
      : '';
  }

  private variableName(key: string, fallback: string) {
    const value = this.configService.get<string>(key)?.trim() || fallback;
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value)) {
      throw new InternalServerErrorException(
        `${key} must be a valid Scribeless variable name.`,
      );
    }
    return value;
  }

  private requiredSetting(key: string) {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new InternalServerErrorException(`${key} is required.`);
    }
    return value;
  }

  private readBoolean(key: string, fallback: boolean) {
    const value = this.configService.get<string>(key)?.trim().toLowerCase();
    if (!value) return fallback;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new InternalServerErrorException(`${key} must be true or false.`);
  }

  private readInteger(
    key: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ) {
    const configured = this.configService.get<string>(key);
    if (!configured) return fallback;
    const value = Number(configured);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new InternalServerErrorException(
        `${key} must be an integer between ${minimum} and ${maximum}.`,
      );
    }
    return value;
  }

  private async errorBody(response: Response) {
    const text = (await response.text()).trim();
    return text.slice(0, 500) || 'No error body returned.';
  }

  private errorMessage(error: unknown) {
    return error instanceof Error
      ? error.message.slice(0, 500)
      : 'network error';
  }
}

export const defaultScribelessFetch: ScribelessFetch = (input, init) =>
  fetch(input, init);
