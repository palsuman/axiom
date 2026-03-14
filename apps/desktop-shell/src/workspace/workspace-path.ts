import path from 'node:path';
import os from 'node:os';

export function resolveWorkspacePath(target: string, cwd: string) {
  if (!target) return cwd;
  const expanded = target.startsWith('~') ? path.join(os.homedir(), target.slice(1)) : target;
  return path.resolve(cwd, expanded);
}

