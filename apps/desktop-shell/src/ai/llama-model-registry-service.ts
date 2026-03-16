import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  LlamaModelImportRequest,
  LlamaModelImportResponse,
  LlamaModelListRequest,
  LlamaModelListResponse,
  LlamaModelRecord
} from '@nexus/contracts/ipc';
import type { NexusEnv } from '@nexus/platform/config/env';

type TelemetrySink = {
  track: (payload: {
    name: string;
    scope: 'main';
    level: 'info';
    attributes?: Record<string, string | number | boolean>;
    measurements?: Record<string, number>;
  }) => unknown;
};

type RegistryEntry = {
  relativePath: string;
  sourcePath?: string;
  importedAt?: number;
  displayName?: string;
};

type RegistryDocument = {
  version: 1;
  updatedAt: number;
  entries: RegistryEntry[];
};

type FileSystem = Pick<
  typeof fs,
  'access' | 'copyFile' | 'mkdir' | 'readdir' | 'readFile' | 'rename' | 'stat' | 'writeFile'
>;

type DirentLike = {
  name: string;
  isDirectory: () => boolean;
  isFile: () => boolean;
};

type StatsLike = {
  size: number;
  mtimeMs: number;
  isDirectory: () => boolean;
  isFile: () => boolean;
};

type LlamaModelRegistryServiceOptions = {
  telemetry?: TelemetrySink;
  fs?: FileSystem;
  now?: () => number;
};

const REGISTRY_VERSION = 1;

export class LlamaModelRegistryService {
  private readonly modelRoot: string;
  private readonly registryPath: string;
  private readonly telemetry?: TelemetrySink;
  private readonly fs: FileSystem;
  private readonly now: () => number;

  constructor(env: NexusEnv, options: LlamaModelRegistryServiceOptions = {}) {
    this.modelRoot = path.join(env.nexusDataDir, 'ai', 'models');
    this.registryPath = path.join(env.nexusDataDir, 'ai', 'model-registry.json');
    this.telemetry = options.telemetry;
    this.fs = options.fs ?? fs;
    this.now = options.now ?? Date.now;
  }

  async listModels(request: LlamaModelListRequest = {}): Promise<LlamaModelListResponse> {
    void request;
    await this.fs.mkdir(this.modelRoot, { recursive: true });
    const registry = await this.readRegistry();
    const discoveredAt = this.now();
    const files = await this.collectModelFiles(this.modelRoot);
    const models = await Promise.all(
      files.map(async absolutePath => {
        const stats = await this.fs.stat(absolutePath);
        return this.createModelRecord(
          absolutePath,
          stats,
          registry.entriesByRelativePath.get(sanitizeRelativeModelPath(path.relative(this.modelRoot, absolutePath)))
        );
      })
    );

    models.sort((left, right) => left.displayName.localeCompare(right.displayName) || left.relativePath.localeCompare(right.relativePath));

    this.track(
      'ai.model_registry.list',
      {
        modelCount: models.length,
        refresh: Boolean(request.refresh)
      },
      {
        discoveredAt
      }
    );

    return {
      modelRoot: this.modelRoot,
      registryPath: this.registryPath,
      discoveredAt,
      models
    };
  }

  async importModel(request: LlamaModelImportRequest): Promise<LlamaModelImportResponse> {
    const sourcePath = path.resolve(request.sourcePath);
    const stats = await this.fs.stat(sourcePath);
    await this.fs.mkdir(this.modelRoot, { recursive: true });

    const imports = stats.isDirectory()
      ? await this.importDirectory(sourcePath, request)
      : [await this.importFile(sourcePath, request)];

    const registry = await this.readRegistry();
    const entryMap = new Map(registry.entries.map(entry => [entry.relativePath, entry] as const));

    imports.forEach(entry => {
      entryMap.set(entry.relativePath, {
        relativePath: entry.relativePath,
        sourcePath,
        importedAt: this.now(),
        displayName: request.label && imports.length === 1 ? request.label.trim() : undefined
      });
    });

    await this.writeRegistry({
      version: REGISTRY_VERSION,
      updatedAt: this.now(),
      entries: [...entryMap.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    });

    const snapshot = await this.listModels({ refresh: true });
    const imported = snapshot.models.filter(model => imports.some(entry => entry.relativePath === model.relativePath));

    this.track(
      'ai.model_registry.import',
      {
        mode: request.mode ?? 'copy',
        importedCount: imported.length,
        skippedCount: 0
      },
      {
        bytes: imported.reduce((total, model) => total + model.sizeBytes, 0)
      }
    );

    return {
      modelRoot: this.modelRoot,
      imported,
      skipped: []
    };
  }

  private async importDirectory(sourcePath: string, request: LlamaModelImportRequest) {
    const files = await this.collectModelFiles(sourcePath);
    if (!files.length) {
      throw new Error(`No .gguf models found in ${sourcePath}`);
    }

    const imported: Array<{ relativePath: string }> = [];
    for (const file of files) {
      const relativeSourcePath = path.relative(sourcePath, file);
      const targetPath = await this.copyIntoModelRoot(file, relativeSourcePath, request.mode ?? 'copy');
      imported.push({
        relativePath: sanitizeRelativeModelPath(path.relative(this.modelRoot, targetPath))
      });
    }
    return imported;
  }

  private async importFile(sourcePath: string, request: LlamaModelImportRequest) {
    this.assertSupportedModelFile(sourcePath);
    const targetPath = await this.copyIntoModelRoot(sourcePath, path.basename(sourcePath), request.mode ?? 'copy');
    return {
      relativePath: sanitizeRelativeModelPath(path.relative(this.modelRoot, targetPath))
    };
  }

  private async copyIntoModelRoot(sourcePath: string, suggestedRelativePath: string, mode: 'copy' | 'move') {
    const sanitizedRelativePath = sanitizeRelativeModelPath(suggestedRelativePath);
    const targetPath = await this.reserveTargetPath(sanitizedRelativePath);
    await this.fs.mkdir(path.dirname(targetPath), { recursive: true });
    if (mode === 'move') {
      await this.fs.rename(sourcePath, targetPath);
    } else {
      await this.fs.copyFile(sourcePath, targetPath);
    }
    return targetPath;
  }

  private async reserveTargetPath(relativePathValue: string) {
    const parsed = path.parse(relativePathValue);
    let attempt = 0;
    while (true) {
      const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
      const candidateRelativePath = path.join(parsed.dir, `${parsed.name}${suffix}${parsed.ext}`);
      const candidate = path.join(this.modelRoot, candidateRelativePath);
      try {
        await this.fs.access(candidate);
        attempt += 1;
      } catch {
        return candidate;
      }
    }
  }

  private async collectModelFiles(root: string): Promise<string[]> {
    const entries = (await this.fs.readdir(root, { withFileTypes: true })) as unknown as DirentLike[];
    const files: string[] = [];
    for (const entry of entries) {
      const absolutePath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.collectModelFiles(absolutePath)));
        continue;
      }
      if (entry.isFile() && isSupportedModelFile(absolutePath)) {
        files.push(absolutePath);
      }
    }
    return files;
  }

  private async readRegistry() {
    try {
      const contents = await this.fs.readFile(this.registryPath, 'utf8');
      const document = JSON.parse(contents) as Partial<RegistryDocument>;
      const entries = Array.isArray(document.entries)
        ? document.entries
            .filter((entry): entry is RegistryEntry => Boolean(entry && typeof entry.relativePath === 'string'))
            .map(entry => ({
              relativePath: sanitizeRelativeModelPath(entry.relativePath),
              sourcePath: typeof entry.sourcePath === 'string' ? entry.sourcePath : undefined,
              importedAt: typeof entry.importedAt === 'number' ? entry.importedAt : undefined,
              displayName: typeof entry.displayName === 'string' ? entry.displayName : undefined
            }))
        : [];
      return {
        entries,
        entriesByRelativePath: new Map(entries.map(entry => [entry.relativePath, entry] as const))
      };
    } catch {
      return {
        entries: [] as RegistryEntry[],
        entriesByRelativePath: new Map<string, RegistryEntry>()
      };
    }
  }

  private async writeRegistry(document: RegistryDocument) {
    await this.fs.mkdir(path.dirname(this.registryPath), { recursive: true });
    await this.fs.writeFile(this.registryPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }

  private createModelRecord(absolutePath: string, stats: StatsLike, registryEntry?: RegistryEntry): LlamaModelRecord {
    const relativePathValue = sanitizeRelativeModelPath(path.relative(this.modelRoot, absolutePath));
    const fileName = path.basename(absolutePath);
    const metadata = deriveModelMetadata(fileName);
    const issues: string[] = [];
    if (stats.size <= 0) {
      issues.push('Model file is empty.');
    }
    if (!isSupportedModelFile(absolutePath)) {
      issues.push('Unsupported model format.');
    }

    return {
      id: toModelId(relativePathValue),
      path: absolutePath,
      relativePath: relativePathValue,
      fileName,
      displayName: registryEntry?.displayName ?? metadata.displayName,
      source: registryEntry?.importedAt ? 'imported' : 'discovered',
      format: 'gguf',
      sizeBytes: stats.size,
      modifiedAt: Math.round(stats.mtimeMs),
      importedAt: registryEntry?.importedAt,
      sourcePath: registryEntry?.sourcePath,
      family: metadata.family,
      parameterScale: metadata.parameterScale,
      quantization: metadata.quantization,
      ready: issues.length === 0,
      issues
    };
  }

  private assertSupportedModelFile(sourcePath: string) {
    if (!isSupportedModelFile(sourcePath)) {
      throw new Error(`Unsupported model file: ${sourcePath}`);
    }
  }

  private track(name: string, attributes: Record<string, string | number | boolean>, measurements?: Record<string, number>) {
    this.telemetry?.track({
      name,
      scope: 'main',
      level: 'info',
      attributes,
      measurements
    });
  }
}

function isSupportedModelFile(modelPath: string) {
  return path.extname(modelPath).toLowerCase() === '.gguf';
}

function sanitizeRelativeModelPath(relativePathValue: string) {
  const normalized = relativePathValue.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.posix.normalize(normalized);
  if (resolved.startsWith('../')) {
    throw new Error(`Invalid model path: ${relativePathValue}`);
  }
  return resolved;
}

function toModelId(relativePathValue: string) {
  return sanitizeRelativeModelPath(relativePathValue).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function deriveModelMetadata(fileName: string) {
  const baseName = fileName.replace(/\.gguf$/i, '');
  const parameterScale = baseName.match(/(?:^|[-_.])(\d+(?:\.\d+)?[bmk])(?:$|[-_.])/i)?.[1]?.toUpperCase();
  const quantization = baseName.match(/(?:^|[-_.])((?:iq|q)\d+(?:_[a-z0-9]+)*)$/i)?.[1]?.toUpperCase();
  let familySource = baseName;
  if (parameterScale) {
    familySource = familySource.replace(
      new RegExp(`(?:^|[-_.\\s])${escapeRegExp(parameterScale)}(?:$|[-_.\\s])`, 'i'),
      ' '
    );
  }
  if (quantization) {
    familySource = familySource.replace(new RegExp(`(?:^|[-_.\\s])${escapeRegExp(quantization)}$`, 'i'), ' ');
  }
  return {
    displayName: prettifyModelName(baseName),
    family: prettifyModelName(familySource) || undefined,
    parameterScale,
    quantization
  };
}

function prettifyModelName(value: string) {
  return value
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
