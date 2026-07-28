import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { ErrorReportingService } from './error-reporting.service';
import { OperationalAlertsService } from './operational-alerts.service';

describe('OperationalAlertsService', () => {
  const query = jest.fn();
  const reportOperationalAlert = jest.fn();
  const getConfig = jest.fn();
  let service: OperationalAlertsService;

  beforeEach(() => {
    query.mockReset();
    reportOperationalAlert.mockReset();
    getConfig.mockReset();
    service = new OperationalAlertsService(
      { query } as unknown as DatabaseService,
      { get: getConfig } as unknown as ConfigService,
      { reportOperationalAlert } as unknown as ErrorReportingService,
    );
    query.mockResolvedValue({
      rows: [
        { alert_name: 'payment_reconciliation_backlog', alert_count: '1' },
        { alert_name: 'moderation_queue_stale', alert_count: '10' },
        { alert_name: 'generation_refund_spike', alert_count: '5' },
        { alert_name: 'fulfillment_hold_backlog', alert_count: '1' },
      ],
    });
  });

  it('emits only aggregate alert names and counts', async () => {
    await service.evaluateNow(1_000_000);

    expect(reportOperationalAlert.mock.calls).toEqual([
      ['payment_reconciliation_backlog', 1, 1],
      ['moderation_queue_stale', 10, 10],
      ['generation_refund_spike', 5, 5],
      ['fulfillment_hold_backlog', 1, 1],
    ]);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([15, 144, 60, 15]);
    expect(sql).not.toMatch(
      /email|recipient_address|sender_address|creative_brief|s3_key|error_message|status_reason/i,
    );
  });

  it('suppresses repeats until the cooldown and re-arms after recovery', async () => {
    await service.evaluateNow(2_000_000);
    reportOperationalAlert.mockClear();
    await service.evaluateNow(2_010_000);
    expect(reportOperationalAlert).not.toHaveBeenCalled();

    query.mockResolvedValueOnce({
      rows: [
        { alert_name: 'payment_reconciliation_backlog', alert_count: 0 },
        { alert_name: 'moderation_queue_stale', alert_count: 0 },
        { alert_name: 'generation_refund_spike', alert_count: 0 },
        { alert_name: 'fulfillment_hold_backlog', alert_count: 0 },
      ],
    });
    await service.evaluateNow(2_020_000);
    await service.evaluateNow(2_030_000);
    expect(reportOperationalAlert).toHaveBeenCalledTimes(4);
  });
});
