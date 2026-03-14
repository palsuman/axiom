import fs from 'node:fs';
import path from 'node:path';

export type WorkspaceFolderEntry = {
  path: string;
  name: string;
  originalPath?: string;
};

export type WorkspaceTaskType = 'shell' | 'npm' | 'nx';

export interface WorkspaceTaskDefinition {
  readonly id: string;
  readonly label?: string;
  readonly type: WorkspaceTaskType;
  readonly command: string;
  readonly options?: Record<string, unknown>;
}

export type WorkspaceDescriptor = {
  primary: string;
  roots: string[];
  label: string;
  descriptorPath?: string;
  folders: WorkspaceFolderEntry[];
  settings?: Record<string, unknown>;
  tasks?: WorkspaceTaskDefinition[];
};

type VsCodeDescriptor = {
  folders?: Array<{ path: string; name?: string }>;
  name?: string;
};

type NexusWorkspaceFile = {
  version?: number;
  name?: string;
  folders?: Array<{ path: string; name?: string }>;
  settings?: Record<string, unknown>;
  tasks?: Array<Partial<WorkspaceTaskDefinition>>;
};

const DESCRIPTOR_EXTENSIONS = ['.nexus-workspace.json', '.code-workspace'];

export function isWorkspaceDescriptorFile(targetPath: string) {
  return DESCRIPTOR_EXTENSIONS.some(ext => targetPath.toLowerCase().endsWith(ext));
}

export function loadWorkspaceDescriptor(targetPath: string): WorkspaceDescriptor {
  const resolved = path.resolve(targetPath);
  let stats: fs.Stats;
  try {
    stats = fs.statSync(resolved);
  } catch (error) {
    throw new Error(`Workspace target does not exist: ${resolved}`);
  }
  if (stats.isDirectory()) {
    const folder = buildFolderEntry(resolved, path.basename(resolved) || resolved, resolved);
    return {
      primary: folder.path,
      roots: [folder.path],
      label: folder.name,
      folders: [folder]
    };
  }
  if (!stats.isFile()) {
    throw new Error(`Workspace target must be a folder or descriptor file: ${resolved}`);
  }
  if (!isWorkspaceDescriptorFile(resolved)) {
    // treat regular file as single-root (for e.g. file-based workspace)
    const parent = path.dirname(resolved);
    const folder = buildFolderEntry(parent, path.basename(parent) || parent, parent);
    return {
      primary: folder.path,
      roots: [folder.path],
      label: folder.name,
      folders: [folder]
    };
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  const parsed = parseDescriptor(raw, resolved);
  const descriptorDir = path.dirname(resolved);
  const folders = buildFolderEntries(parsed.folders ?? [], descriptorDir);
  if (!folders.length) {
    throw new Error(`Workspace descriptor ${resolved} must declare at least one folder`);
  }
  const primary = folders[0].path;
  const settings = parsed.settings;
  const tasks = parsed.tasks;
  return {
    primary,
    roots: folders.map(folder => folder.path),
    label: parsed.name ?? inferDescriptorLabel(resolved, primary),
    descriptorPath: resolved,
    folders,
    settings,
    tasks
  };
}

function parseDescriptor(raw: string, filePath: string): {
  name?: string;
  folders?: Array<{ path: string; name?: string }>;
  settings?: Record<string, unknown>;
  tasks?: WorkspaceTaskDefinition[];
} {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.nexus-workspace.json')) {
    return parseNexusWorkspace(raw, filePath);
  }
  return parseVsCodeWorkspace(raw, filePath);
}

function parseVsCodeWorkspace(raw: string, filePath: string): {
  name?: string;
  folders?: Array<{ path: string; name?: string }>;
} {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Descriptor is not a JSON object');
    }
    const vscode = parsed as VsCodeDescriptor;
    return {
      name: vscode.name,
      folders: vscode.folders
    };
  } catch (error) {
    throw new Error(`Failed to parse workspace descriptor ${filePath}: ${(error as Error).message}`);
  }
}

function parseNexusWorkspace(raw: string, filePath: string) {
  try {
    const parsed = JSON.parse(raw) as NexusWorkspaceFile;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Descriptor is not a JSON object');
    }
    const folders = parsed.folders;
    if (!Array.isArray(folders)) {
      throw new Error('Descriptor must include a folders array');
    }
    const tasks = normalizeTaskDefinitions(parsed.tasks ?? [], filePath);
    return {
      name: parsed.name,
      folders,
      settings: parsed.settings,
      tasks
    };
  } catch (error) {
    throw new Error(`Failed to parse workspace descriptor ${filePath}: ${(error as Error).message}`);
  }
}

function normalizeTaskDefinitions(tasks: Array<Partial<WorkspaceTaskDefinition>>, filePath: string): WorkspaceTaskDefinition[] {
  return tasks.map((task, index) => {
    if (!task || typeof task !== 'object') {
      throw new Error(`Task entry at index ${index} in ${filePath} is invalid`);
    }
    const id = task.id;
    const command = task.command;
    if (!id || typeof id !== 'string') {
      throw new Error(`Task entry at index ${index} must define a string id`);
    }
    if (!command || typeof command !== 'string') {
      throw new Error(`Task "${id}" must define a string command`);
    }
    return {
      id,
      command,
      type: (task.type as WorkspaceTaskType) ?? 'shell',
      label: task.label,
      options: task.options
    };
  });
}

function buildFolderEntries(folders: Array<{ path: string; name?: string }>, descriptorDir: string): WorkspaceFolderEntry[] {
  const entries: WorkspaceFolderEntry[] = [];
  const seen = new Set<string>();
  folders.forEach(folder => {
    const normalized = normalizeFolderPath(folder.path, descriptorDir);
    if (!normalized) {
      return;
    }
    const absolutePath = path.resolve(normalized);
    if (seen.has(absolutePath)) {
      return;
    }
    seen.add(absolutePath);
    const resolvedName = folder.name ?? (path.basename(absolutePath) || absolutePath);
    entries.push(buildFolderEntry(absolutePath, resolvedName, folder.path));
  });
  return entries;
}

function normalizeFolderPath(folderPath: string | undefined, baseDir: string) {
  if (!folderPath || typeof folderPath !== 'string') return undefined;
  const expanded = folderPath.replace(/^\~/, () => path.join(process.env.HOME || '', ''));
  if (path.isAbsolute(expanded)) {
    return path.normalize(expanded);
  }
  return path.normalize(path.join(baseDir, expanded));
}

function inferDescriptorLabel(descriptorPath: string, primary: string) {
  const base = path.basename(descriptorPath).replace(path.extname(descriptorPath), '');
  if (base && base !== 'nexus-workspace') return base;
  return path.basename(primary) || primary;
}

function buildFolderEntry(pathValue: string, name: string, originalPath?: string): WorkspaceFolderEntry {
  return {
    path: path.resolve(pathValue),
    name,
    originalPath
  };
}
