import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { WORKER_RUNTIME_CONFIG } from '../runtime/runtime.module';
import type { WorkerRuntimeConfig } from '../runtime/runtime-config';
import { TryRiskFreeResolverRepository } from './try-risk-free-resolver.repository';

@Injectable()
export class TryRiskFreeResolverService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TryRiskFreeResolverService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly repository: TryRiskFreeResolverRepository,
    @Inject(WORKER_RUNTIME_CONFIG) private readonly config: WorkerRuntimeConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.tryRiskFreeResolverEnabled) return;
    this.timer = setInterval(() => void this.runOnce(), this.config.tryRiskFreeResolverIntervalMs);
    this.timer.unref();
  }

  async runOnce(): Promise<number> {
    if (!this.config.tryRiskFreeResolverEnabled || this.running) return 0;
    this.running = true;
    try {
      const resolved = await this.repository.resolveDue();
      if (resolved > 0) this.logger.log(`Resolved ${resolved} due mock Try Risk-Free authorization(s).`);
      return resolved;
    } catch {
      this.logger.error('Try Risk-Free resolver tick failed with a sanitized database error.');
      return 0;
    } finally {
      this.running = false;
    }
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
