import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LlamaModelRegistryService } from './llama-model-registry-service';
import { createMockEnv } from '../test-utils/mock-env';

describe('LlamaModelRegistryService', () => {
  it('discovers GGUF models and derives metadata from filenames', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-model-registry-'));
    const env = createMockEnv({ nexusDataDir: root });
    const modelDir = path.join(root, 'ai', 'models');
    await fs.mkdir(modelDir, { recursive: true });
    await fs.writeFile(path.join(modelDir, 'DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf'), 'model-data');
    await fs.writeFile(path.join(modelDir, 'README.txt'), 'ignore me');

    const service = new LlamaModelRegistryService(env);
    const snapshot = await service.listModels();

    expect(snapshot.modelRoot).toBe(modelDir);
    expect(snapshot.models).toHaveLength(1);
    expect(snapshot.models[0]).toMatchObject({
      fileName: 'DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
      displayName: 'DeepSeek R1 Distill Qwen 7B Q4 K M',
      family: 'DeepSeek R1 Distill Qwen',
      parameterScale: '7B',
      quantization: 'Q4_K_M',
      source: 'discovered',
      format: 'gguf',
      ready: true
    });
  });

  it('imports model directories and persists registry metadata', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-model-import-'));
    const env = createMockEnv({ nexusDataDir: root });
    const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-model-source-'));
    await fs.mkdir(path.join(sourceDir, 'quantized'), { recursive: true });
    await fs.writeFile(path.join(sourceDir, 'quantized', 'CodeLlama-13B-Q5_K_M.gguf'), 'weights');

    const telemetry = { track: jest.fn() };
    const service = new LlamaModelRegistryService(env, { telemetry, now: () => 1_710_000_000_000 });

    const result = await service.importModel({
      sourcePath: sourceDir,
      mode: 'copy'
    });

    expect(result.imported).toHaveLength(1);
    expect(result.imported[0]).toMatchObject({
      relativePath: path.join('quantized', 'CodeLlama-13B-Q5_K_M.gguf'),
      source: 'imported',
      sourcePath: sourceDir,
      importedAt: 1_710_000_000_000,
      quantization: 'Q5_K_M'
    });

    const importedPath = path.join(root, 'ai', 'models', 'quantized', 'CodeLlama-13B-Q5_K_M.gguf');
    await expect(fs.readFile(importedPath, 'utf8')).resolves.toBe('weights');
    await expect(fs.readFile(path.join(root, 'ai', 'model-registry.json'), 'utf8')).resolves.toContain('"relativePath": "quantized/CodeLlama-13B-Q5_K_M.gguf"');
    expect(telemetry.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ai.model_registry.import'
      })
    );
  });

  it('rejects imports when no GGUF models are present', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-model-empty-'));
    const env = createMockEnv({ nexusDataDir: root });
    const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-model-source-empty-'));
    await fs.writeFile(path.join(sourceDir, 'note.txt'), 'no models here');

    const service = new LlamaModelRegistryService(env);

    await expect(
      service.importModel({
        sourcePath: sourceDir,
        mode: 'copy'
      })
    ).rejects.toThrow(`No .gguf models found in ${sourceDir}`);
  });
});
