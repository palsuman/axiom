import fs from 'node:fs/promises';
import path from 'node:path';
import type { WebContents } from 'electron';

import type {
  RunConfigurationLoadResponse,
  RunConfigurationSavePayload,
  RunConfigurationSaveResponse
} from '@nexus/contracts/ipc';
import {
  createDefaultLaunchConfigurationDocument,
  parseLaunchConfigurationDocument,
  serializeLaunchConfigurationDocument
} from '@nexus/platform/run-debug/launch-config';

import type { WindowManager } from '../windowing/window-manager';

type SessionMetadata = NonNullable<ReturnType<WindowManager['getSessionMetadataForWebContents']>>;

export class LaunchConfigurationService {
  constructor(private readonly windows: WindowManager) {}

  async load(sender: WebContents): Promise<RunConfigurationLoadResponse> {
    const filePath = this.resolveLaunchConfigurationPath(sender);
    try {
      const text = await fs.readFile(filePath, 'utf8');
      const result = parseLaunchConfigurationDocument(text);
      return {
        path: filePath,
        exists: true,
        text,
        issues: [...result.issues]
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      const document = createDefaultLaunchConfigurationDocument();
      return {
        path: filePath,
        exists: false,
        text: serializeLaunchConfigurationDocument(document),
        issues: []
      };
    }
  }

  async save(sender: WebContents, payload: RunConfigurationSavePayload): Promise<RunConfigurationSaveResponse> {
    const filePath = this.resolveLaunchConfigurationPath(sender);
    const result = parseLaunchConfigurationDocument(payload.text);
    if (result.issues.length) {
      return {
        path: filePath,
        saved: false,
        text: payload.text,
        issues: [...result.issues]
      };
    }
    const normalizedText = serializeLaunchConfigurationDocument(result.document);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, normalizedText, 'utf8');
    return {
      path: filePath,
      saved: true,
      text: normalizedText,
      issues: []
    };
  }

  private resolveLaunchConfigurationPath(sender: WebContents) {
    const session = this.resolveSession(sender);
    const workspaceRoot = this.resolveWorkspaceRoot(session);
    if (!workspaceRoot) {
      throw new Error('Unable to resolve workspace root for launch configurations');
    }
    return path.join(workspaceRoot, '.nexus', 'launch.json');
  }

  private resolveSession(sender: WebContents) {
    const session = this.windows.getSessionMetadataForWebContents(sender.id);
    if (!session) {
      throw new Error('Unable to resolve window session for launch configurations');
    }
    return session;
  }

  private resolveWorkspaceRoot(session: SessionMetadata) {
    return session.workspacePrimary ?? session.workspaceRoots?.[0] ?? session.workspace;
  }
}
