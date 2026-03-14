import fs from 'node:fs';
import path from 'node:path';
import { sanitizeWorkspaceId, resolveWorkspaceDataRoot } from '@nexus/platform/workspace/workspace-paths';

const STATE_VERSION = 1;

export type DebugBreakpointEntry = {
  id: string;
  source: string;
  line: number;
  enabled: boolean;
};

export type DebugWatchExpression = {
  id: string;
  expression: string;
  value?: string;
  type?: string;
  status: 'idle' | 'evaluating' | 'evaluated' | 'error';
  error?: string;
};

export type DebugSessionUiState = {
  breakpoints: DebugBreakpointEntry[];
  watchExpressions: DebugWatchExpression[];
  selectedStackFrameId?: number;
};

type PersistedState = {
  version: number;
  updatedAt: number;
  state: DebugSessionUiState;
};

export class DebugSessionUiStore {
  private readonly dir: string;
  private readonly filePath: string;

  constructor(options: { workspaceId: string; dataRoot?: string }) {
    this.dir = resolveWorkspaceDataRoot(options.dataRoot);
    this.filePath = path.join(this.dir, `${sanitizeWorkspaceId(options.workspaceId)}.debug.json`);
  }

  load(): DebugSessionUiState | null {
    if (!fs.existsSync(this.filePath)) return null;
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.version !== STATE_VERSION) {
        return null;
      }
      return {
        breakpoints: Array.isArray(parsed.state.breakpoints) ? parsed.state.breakpoints : [],
        watchExpressions: Array.isArray(parsed.state.watchExpressions) ? parsed.state.watchExpressions : [],
        selectedStackFrameId:
          typeof parsed.state.selectedStackFrameId === 'number' ? parsed.state.selectedStackFrameId : undefined
      };
    } catch {
      return null;
    }
  }

  save(state: DebugSessionUiState) {
    const payload: PersistedState = {
      version: STATE_VERSION,
      updatedAt: Date.now(),
      state
    };
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}
