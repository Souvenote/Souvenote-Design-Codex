import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { readString, runtimeEnvironment } from '../config/runtime-config';

type ProviderMode = 'disabled' | 'deterministic_mock' | 'sandbox' | 'live';

class CreativeCapabilitiesDto {
  @ApiProperty({ enum: ['disabled', 'deterministic_mock', 'sandbox', 'live'] }) image!: ProviderMode;
  @ApiProperty({ enum: ['disabled', 'deterministic_mock', 'sandbox', 'live'] }) music!: ProviderMode;
  @ApiProperty({ enum: ['disabled', 'deterministic_mock', 'sandbox', 'live'] }) text!: ProviderMode;
}

class EnvironmentCapabilitiesDto {
  @ApiProperty({ enum: ['local', 'test', 'invite_only_beta', 'production'] }) releaseStage!: string;
  @ApiProperty({ enum: ['disabled', 'local_private', 's3_private'] }) uploads!: string;
  @ApiProperty({ type: CreativeCapabilitiesDto }) creative!: CreativeCapabilitiesDto;
  @ApiProperty({ enum: ['disabled', 'deterministic_mock', 'sandbox', 'live'] }) checkout!: ProviderMode;
  @ApiProperty({ enum: ['disabled', 'deterministic_mock', 'sandbox', 'live'] }) fulfillment!: ProviderMode;
  @ApiProperty() externalProviderCallsEnabled!: boolean;
  @ApiProperty() label!: string;
}

@ApiTags('capabilities')
@ApiBearerAuth()
@Controller('capabilities')
export class CapabilitiesController {
  constructor(private readonly configuration: ConfigService) {}

  @Get()
  @ApiOperation({ operationId: 'getEnvironmentCapabilities' })
  @ApiOkResponse({ type: EnvironmentCapabilitiesDto })
  get(): EnvironmentCapabilitiesDto {
    const environment = runtimeEnvironment(this.configuration);
    const creative = {
      image: this.providerMode('IMAGE_PROVIDER_MODE'),
      music: this.providerMode('MUSIC_PROVIDER_MODE'),
      text: this.providerMode('TEXT_PROVIDER_MODE'),
    };
    const checkout = this.providerMode('PAYMENT_PROVIDER_MODE');
    const fulfillment = this.providerMode('FULFILLMENT_PROVIDER_MODE');
    const modes = [...Object.values(creative), checkout, fulfillment];
    const releaseStage = this.releaseStage(environment);
    return {
      releaseStage,
      uploads: this.uploadMode(environment),
      creative,
      checkout,
      fulfillment,
      externalProviderCallsEnabled: modes.some((mode) => mode === 'sandbox' || mode === 'live'),
      label: modes.every((mode) => mode === 'deterministic_mock')
        ? 'Deterministic beta mock'
        : 'Provider capabilities vary by workflow',
    };
  }

  private providerMode(key: string): ProviderMode {
    const configured = readString(this.configuration, key)?.toLowerCase();
    if (configured === 'mock') {
      const environment = runtimeEnvironment(this.configuration);
      return environment === 'development' || environment === 'test' ? 'deterministic_mock' : 'disabled';
    }
    if (configured === 'sandbox') return 'sandbox';
    if (configured === 'live') return 'live';
    return 'disabled';
  }

  private uploadMode(environment: string): EnvironmentCapabilitiesDto['uploads'] {
    const configured = readString(this.configuration, 'ASSET_STORAGE_MODE')?.toLowerCase();
    if (configured === 's3') return 's3_private';
    if (configured === 'local' || environment === 'development' || environment === 'test') return 'local_private';
    return 'disabled';
  }

  private releaseStage(environment: string): string {
    const configured = readString(this.configuration, 'RELEASE_STAGE')?.toLowerCase();
    if (configured === 'invite_only_beta' || configured === 'production') return configured;
    return environment === 'test' ? 'test' : 'local';
  }
}
