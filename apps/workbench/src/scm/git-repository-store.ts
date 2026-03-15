import type { GitRepositoryInfo } from '@nexus/contracts/ipc';
import { resolveNexusBridge } from '../boot/nexus-bridge-resolver';

type NexusBridge = {
  gitListRepositories?: () => Promise<GitRepositoryInfo[]>;
};

export class GitRepositoryStore {
  private readonly bridge: NexusBridge | undefined;
  private repositories: GitRepositoryInfo[] = [];

  constructor(bridge?: NexusBridge) {
    this.bridge = bridge ?? resolveNexusBridge<NexusBridge>();
  }

  async refresh() {
    if (!this.bridge?.gitListRepositories) {
      throw new Error('Git bridge is unavailable');
    }
    this.repositories = await this.bridge.gitListRepositories();
    return this.getRepositories();
  }

  getRepositories() {
    return [...this.repositories];
  }
}
