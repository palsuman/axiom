import path from 'node:path';
import type {
  FeatureFlagSnapshot,
  LogPayload,
  TelemetryHealthResponse,
  TelemetryRecord,
  TelemetryReplayRequest,
  TelemetryReplayResponse,
  TelemetryTrackPayload
} from '@nexus/contracts/ipc';
import type { NexusEnv } from '@nexus/platform/config/env';
import { TelemetryStore } from '@nexus/platform/observability/telemetry-store';

type TelemetryServiceOptions = {
  store?: TelemetryStore;
  featureFlags?: {
    list: () => FeatureFlagSnapshot;
    getTelemetrySummary: () => string;
  };
  privacy?: {
    isTelemetryEnabled: (workspaceId?: string) => boolean;
  };
};

export class TelemetryService {
  private readonly store: TelemetryStore;
  private readonly featureFlags?: NonNullable<TelemetryServiceOptions['featureFlags']>;
  private readonly privacy?: NonNullable<TelemetryServiceOptions['privacy']>;

  constructor(env: NexusEnv, options: TelemetryServiceOptions = {}) {
    this.featureFlags = options.featureFlags;
    this.privacy = options.privacy;
    this.store =
      options.store ??
      new TelemetryStore({
        bufferPath: path.join(env.nexusDataDir ?? env.nexusHome, 'telemetry', 'events.jsonl')
      });
  }

  track(payload: TelemetryTrackPayload): TelemetryRecord {
    const featureFlagSummary = this.featureFlags?.getTelemetrySummary();
    const normalizedPayload = {
      ...payload,
      attributes: featureFlagSummary
        ? {
            ...(payload.attributes ?? {}),
            featureFlags: featureFlagSummary
          }
        : payload.attributes,
      tags: this.mergeTags(payload.tags)
    };
    if (this.privacy && !this.privacy.isTelemetryEnabled(payload.workspaceId)) {
      return this.store.preview(normalizedPayload);
    }
    return this.store.track(normalizedPayload);
  }

  trackRendererLog(payload: LogPayload, context: { sessionId?: string; workspaceId?: string } = {}) {
    return this.track({
      name: 'renderer.log',
      scope: 'renderer',
      level: payload.level,
      message: payload.message,
      sessionId: context.sessionId,
      workspaceId: context.workspaceId
    });
  }

  replay(request: TelemetryReplayRequest = {}): TelemetryReplayResponse {
    return this.store.replay(request);
  }

  getHealth(): TelemetryHealthResponse {
    return this.store.getHealth();
  }

  private mergeTags(existing: string[] | undefined) {
    const tags = new Set(existing ?? []);
    this.featureFlags?.list().activeKeys.forEach(key => {
      tags.add(`ff:${key}`);
    });
    return Array.from(tags);
  }
}
