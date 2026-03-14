import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadWorkspaceDescriptor, isWorkspaceDescriptorFile } from './workspace-descriptor';

describe('workspace descriptor', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-workspace-descriptor-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects descriptor extensions', () => {
    expect(isWorkspaceDescriptorFile('/tmp/foo.nexus-workspace.json')).toBe(true);
    expect(isWorkspaceDescriptorFile('/tmp/foo.CODE-workspace')).toBe(true);
    expect(isWorkspaceDescriptorFile('/tmp/project')).toBe(false);
  });

  it('returns single-root descriptor for folders', () => {
    const descriptor = loadWorkspaceDescriptor(tempDir);
    expect(descriptor.primary).toBe(path.resolve(tempDir));
    expect(descriptor.roots).toEqual([path.resolve(tempDir)]);
    expect(descriptor.label).toBe(path.basename(tempDir));
    expect(descriptor.folders).toHaveLength(1);
    expect(descriptor.folders[0]).toMatchObject({ path: path.resolve(tempDir) });
    expect(descriptor.settings).toBeUndefined();
  });

  it('parses multi-root descriptor file with settings and tasks', () => {
    const projectA = path.join(tempDir, 'project-a');
    const projectB = path.join(tempDir, 'project-b');
    fs.mkdirSync(projectA, { recursive: true });
    fs.mkdirSync(projectB, { recursive: true });
    const descriptorPath = path.join(tempDir, 'sample.nexus-workspace.json');
    fs.writeFileSync(
      descriptorPath,
      JSON.stringify({
        name: 'sample-workspace',
        folders: [{ path: './project-a', name: 'API' }, { path: projectB }],
        settings: { 'files.exclude': { '**/dist': true } },
        tasks: [
          { id: 'build-all', command: 'yarn build' },
          { id: 'test', type: 'npm', command: 'npm run test', label: 'Run Tests' }
        ]
      }),
      'utf8'
    );
    const descriptor = loadWorkspaceDescriptor(descriptorPath);
    expect(descriptor.descriptorPath).toBe(descriptorPath);
    expect(descriptor.label).toBe('sample-workspace');
    expect(descriptor.roots).toEqual([projectA, projectB]);
    expect(descriptor.primary).toBe(projectA);
    expect(descriptor.settings).toEqual({ 'files.exclude': { '**/dist': true } });
    expect(descriptor.tasks).toEqual([
      { id: 'build-all', command: 'yarn build', type: 'shell', label: undefined, options: undefined },
      { id: 'test', command: 'npm run test', type: 'npm', label: 'Run Tests', options: undefined }
    ]);
    expect(descriptor.folders).toHaveLength(2);
    expect(descriptor.folders[0].name).toBe('API');
  });

  it('parses VS Code descriptor fallback', () => {
    const descriptorPath = path.join(tempDir, 'sample.code-workspace');
    fs.writeFileSync(
      descriptorPath,
      JSON.stringify({
        name: 'legacy',
        folders: [{ path: '.' }]
      }),
      'utf8'
    );
    const descriptor = loadWorkspaceDescriptor(descriptorPath);
    expect(descriptor.label).toBe('legacy');
    expect(descriptor.folders).toHaveLength(1);
    expect(descriptor.settings).toBeUndefined();
    expect(descriptor.tasks).toBeUndefined();
  });

  it('throws when descriptor has no folders', () => {
    const descriptorPath = path.join(tempDir, 'broken.nexus-workspace.json');
    fs.writeFileSync(descriptorPath, JSON.stringify({ folders: [] }), 'utf8');
    expect(() => loadWorkspaceDescriptor(descriptorPath)).toThrow(/must declare at least one folder/);
  });
});
