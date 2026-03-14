import type { GitRepositoryInfo } from '@nexus/contracts/ipc';

type NexusBridge = {
  gitListRepositories?: () => Promise<GitRepositoryInfo[]>;
};

export class GitRepositoryStore {
  private readonly bridge: NexusBridge | undefined;
  private repositories: GitRepositoryInfo[] = [];

  constructor(bridge?: NexusBridge) {
    this.bridge = bridge ?? (typeof window !== 'undefined' ? window.nexus : undefined);
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
