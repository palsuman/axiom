import fs from 'node:fs';
import path from 'node:path';

import { sanitizeWorkspaceId, resolveWorkspaceDataRoot } from '@nexus/platform/workspace-paths';

const STATE_VERSION = 1;

export type WorkspaceEditorEntry = {
  resource: string;
  title: string;
  kind: 'text' | 'preview' | 'diff';
  groupId?: string;
};

export type WorkspaceScmState = {
  lastBranch?: string;
};

export type WorkspaceStatePayload = {
  editors: WorkspaceEditorEntry[];
  activeEditorResource?: string;
  activityBar?: { activeId?: string };
  sidebar?: { activeViewId?: string };
  secondarySidebar?: { activeViewId?: string };
  panel?: { activeViewId?: string; visible: boolean };
  scm?: WorkspaceScmState;
};

type PersistedState = {
  version: number;
  updatedAt: number;
  state: WorkspaceStatePayload;
};

export class WorkspaceStateStore {
  private readonly dir: string;
  private readonly filePath: string;

  constructor(options: { workspaceId: string; dataRoot?: string }) {
    this.dir = resolveWorkspaceDataRoot(options.dataRoot);
    this.filePath = path.join(this.dir, `${sanitizeWorkspaceId(options.workspaceId)}.state.json`);
  }

  load(): WorkspaceStatePayload | null {
    if (!fs.existsSync(this.filePath)) return null;
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.version !== STATE_VERSION) {
        return null;
      }
      return parsed.state;
    } catch {
      return null;
    }
  }

  save(state: WorkspaceStatePayload) {
    const payload: PersistedState = {
      version: STATE_VERSION,
      updatedAt: Date.now(),
      state
    };
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}
