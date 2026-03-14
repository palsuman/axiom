import os from 'node:os';
import path from 'node:path';

const DEFAULT_HOME_DIR = '.nexus';
const DEFAULT_WORKSPACE_ID = 'default';

export function expandHome(input: string) {
  if (!input) return input;
  if (input.startsWith('~/')) {
    return path.join(os.homedir(), input.slice(2));
  }
  if (input.startsWith('~')) {
    return path.join(os.homedir(), input.slice(1));
  }
  return input;
}

export function resolveWorkspaceDataRoot(override?: string) {
  const envWorkspace = override ?? process.env.NEXUS_WORKSPACE_DATA;
  const dataRoot =
    envWorkspace ??
    path.join(process.env.NEXUS_DATA_DIR ?? process.env.NEXUS_HOME ?? DEFAULT_HOME_DIR, 'workspaces');
  return path.resolve(expandHome(dataRoot));
}

export function sanitizeWorkspaceId(input: string) {
  const trimmed = input?.trim();
  if (!trimmed) return DEFAULT_WORKSPACE_ID;
  return trimmed.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '-').toLowerCase();
}
