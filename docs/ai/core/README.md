# AI Core (IDE-085, IDE-086)

## Purpose
- Provide the production-grade local AI runtime foundation for Nexus.
- Own the managed `llama.cpp` controller lifecycle and the local model discovery/import registry before prompt orchestration, streaming, and guardrail features are added.

## Ownership Boundary
- `packages/ai-core/controller/llama-controller.ts` owns subprocess startup, stop, restart policy, binary discovery, argument construction, output capture, and HTTP health probing.
- `packages/ai-core/controller/llama-benchmark.ts` owns the reusable benchmark harness for repeated health checks and latency summaries.
- `apps/desktop-shell/src/ai/llama-controller-service.ts` owns Electron-main integration: env wiring, relative model-path resolution, telemetry hooks, and typed IPC exposure.
- `apps/desktop-shell/src/ai/llama-model-registry-service.ts` owns recursive GGUF discovery, filename-derived metadata, import persistence, and typed registry IPC exposure.
- Renderer code does not spawn or inspect processes directly; it must go through preload IPC.

## Runtime Contract
- Default runtime root: `<NEXUS_DATA_DIR>/ai/llama.cpp`
- Legacy runtime fallback: `<NEXUS_HOME>/llama.cpp`
- Default model root for relative model paths: `<NEXUS_DATA_DIR>/ai/models`
- Registry metadata path: `<NEXUS_DATA_DIR>/ai/model-registry.json`
- Default health endpoint: `http://127.0.0.1:39281/health`
- Supported IPC channels:
  - `nexus:ai:controller:health`
  - `nexus:ai:controller:start`
  - `nexus:ai:controller:stop`
  - `nexus:ai:controller:benchmark`
  - `nexus:ai:model:list`
  - `nexus:ai:model:import`

## Model Registry Contract
- Discovery recursively scans `<NEXUS_DATA_DIR>/ai/models` for `.gguf` files.
- Registry entries expose:
  - canonical absolute path and relative path
  - display name derived from the file name unless an imported label overrides it
  - size, modified timestamp, inferred model family, parameter scale, and quantization tag
  - import provenance (`discovered` vs `imported`) and validation issues
- Import accepts either a single `.gguf` file or a directory tree containing one or more `.gguf` files.
- Directory imports preserve relative subfolders under the model root; collisions are de-duplicated with numeric suffixes.
- Imported model provenance is persisted in `model-registry.json` so later scans retain source metadata and display labels.
- Unsupported files are never exposed as runnable models; imports without any `.gguf` payload fail fast with a validation error.

## Start Contract
- Required: `modelPath`
- Optional runtime knobs:
  - `host`
  - `port`
  - `threads`
  - `contextSize`
  - `batchSize`
  - `gpuPreference` (`auto`, `cpu`, `gpu`)
  - `gpuLayers`
  - `restartOnCrash`
  - `extraArgs`
- `gpuPreference=cpu` forces `--n-gpu-layers 0`. Other GPU settings rely on the compiled llama.cpp backend and `gpuLayers`.

## Health + Restart Behavior
- The controller probes `/health` on the managed HTTP endpoint with `NEXUS_LLAMACPP_HEALTH_TIMEOUT_MS`.
- Unexpected exits transition through `crashed` and `restarting` states and retry with bounded backoff.
- Recent stdout/stderr lines are retained in-memory to support diagnostics without exposing raw process handles to the renderer.

## Environment
- `NEXUS_LLAMACPP_ROOT`
- `NEXUS_LLAMACPP_BINARY`
- `NEXUS_LLAMACPP_HOST`
- `NEXUS_LLAMACPP_PORT`
- `NEXUS_LLAMACPP_HEALTH_TIMEOUT_MS`

## Verification
- `./node_modules/.bin/jest --config apps/desktop-shell/jest.config.cjs --runInBand apps/desktop-shell/src/ai/llama-controller-service.spec.ts apps/desktop-shell/src/ai/llama-model-registry-service.spec.ts apps/desktop-shell/src/main.spec.ts`
- `./node_modules/.bin/jest --config packages/ai-core/jest.config.cjs --runInBand`
- `./node_modules/.bin/jest --config packages/contracts/jest.config.cjs --runInBand`
- `./node_modules/.bin/jest --config packages/platform/jest.config.cjs --runInBand`
- `./node_modules/.bin/jest --config apps/desktop-shell/jest.config.cjs --runInBand`
- `./node_modules/.bin/jest --config apps/workbench/jest.config.cjs --runInBand`
- `./node_modules/.bin/tsc -p apps/desktop-shell/tsconfig.app.json --noEmit`
- `./node_modules/.bin/tsc -p apps/workbench/tsconfig.app.json --noEmit`

## Next Tasks Unlocked
- `IDE-087` prompt orchestration
- `IDE-088` streaming and cancellation
- `IDE-091` safety and guardrails
