import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { GitRepositoryManager } from './git-repository-manager';

describe('GitRepositoryManager', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-git-manager-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('discovers repositories within workspace roots', async () => {
    const repoRoot = await createRepo('repo-a');
    const manager = new GitRepositoryManager([tempDir], { maxDepth: 2, watchHead: false, rescanIntervalMs: 0 });
    await manager.start();
    const repos = manager.getRepositories();
    expect(repos).toHaveLength(1);
    expect(repos[0]?.worktreePath).toBe(repoRoot);
    expect(repos[0]?.head.ref).toBe('refs/heads/main');
    manager.dispose();
  });

  it('updates repository head information after a refresh', async () => {
    const repoRoot = await createRepo('repo-watch');
    const gitDir = path.join(repoRoot, '.git');
    const manager = new GitRepositoryManager([tempDir], { maxDepth: 2, watchHead: false, rescanIntervalMs: 0 });
    await manager.start();
    const reposBefore = manager.getRepositories();
    expect(reposBefore[0]?.head.commit).toBe('1111111111111111111111111111111111111111');

    await fs.writeFile(path.join(gitDir, 'refs/heads/main'), '2222222222222222222222222222222222222222', 'utf8');
    await manager.refreshNow();

    const reposAfter = manager.getRepositories();
    expect(reposAfter[0]?.head.commit).toBe('2222222222222222222222222222222222222222');
    manager.dispose();
  });

  it('detects newly added repositories on refresh', async () => {
    const manager = new GitRepositoryManager([tempDir], { maxDepth: 3, watchHead: false, rescanIntervalMs: 0 });
    await manager.start();
    expect(manager.getRepositories()).toHaveLength(0);
    await createRepo('repo-b');
    await manager.refreshNow();
    expect(manager.getRepositories()).toHaveLength(1);
    manager.dispose();
  });

  it('handles gitdir files for submodules', async () => {
    const parent = await createRepo('parent');
    const modulesDir = path.join(parent, '.git', 'modules');
    await fs.mkdir(modulesDir, { recursive: true });
    const moduleGitDir = path.join(modulesDir, 'lib');
    await fs.mkdir(path.join(moduleGitDir, 'refs', 'heads'), { recursive: true });
    await fs.writeFile(path.join(moduleGitDir, 'HEAD'), 'ref: refs/heads/main', 'utf8');
    await fs.writeFile(path.join(moduleGitDir, 'refs/heads/main'), '3333333333333333333333333333333333333333', 'utf8');
    const worktree = path.join(parent, 'lib');
    await fs.mkdir(worktree, { recursive: true });
    await fs.writeFile(path.join(worktree, '.git'), `gitdir: ${path.relative(worktree, moduleGitDir)}`, 'utf8');

    const manager = new GitRepositoryManager([tempDir], { maxDepth: 4, watchHead: false, rescanIntervalMs: 0 });
    await manager.start();
    const repos = manager.getRepositories();
    const submodule = repos.find(repo => repo.worktreePath === worktree);
    expect(submodule).toBeDefined();
    expect(submodule?.isSubmodule).toBe(true);
    manager.dispose();
  });

  async function createRepo(name: string) {
    const repoRoot = path.join(tempDir, name);
    await fs.mkdir(path.join(repoRoot, '.git', 'refs', 'heads'), { recursive: true });
    await fs.writeFile(path.join(repoRoot, '.git', 'HEAD'), 'ref: refs/heads/main', 'utf8');
    await fs.writeFile(
      path.join(repoRoot, '.git', 'refs/heads/main'),
      '1111111111111111111111111111111111111111',
      'utf8'
    );
    return repoRoot;
  }
});
