export type LlamaHealthBenchmarkSample = {
  iteration: number;
  ok: boolean;
  checkedAt: number;
  latencyMs?: number;
  statusCode?: number;
  error?: string;
};

export type LlamaHealthBenchmarkSummary = {
  successes: number;
  failures: number;
  minLatencyMs?: number;
  maxLatencyMs?: number;
  avgLatencyMs?: number;
  p50LatencyMs?: number;
  p95LatencyMs?: number;
};

export type LlamaHealthBenchmarkResult = {
  iterations: number;
  warmupIterations: number;
  samples: LlamaHealthBenchmarkSample[];
  summary: LlamaHealthBenchmarkSummary;
};

export type LlamaHealthCheckResult = {
  ok: boolean;
  checkedAt: number;
  latencyMs?: number;
  statusCode?: number;
  error?: string;
};

export type LlamaHealthBenchmarkOptions = {
  iterations?: number;
  warmupIterations?: number;
};

export async function runLlamaHealthBenchmark(
  probe: () => Promise<LlamaHealthCheckResult>,
  options: LlamaHealthBenchmarkOptions = {}
): Promise<LlamaHealthBenchmarkResult> {
  const iterations = normalizeCount(options.iterations, 5, 'iterations');
  const warmupIterations = normalizeCount(options.warmupIterations, 1, 'warmupIterations');

  for (let iteration = 0; iteration < warmupIterations; iteration += 1) {
    await probe();
  }

  const samples: LlamaHealthBenchmarkSample[] = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const result = await probe();
    samples.push({
      iteration: iteration + 1,
      ok: result.ok,
      checkedAt: result.checkedAt,
      latencyMs: result.latencyMs,
      statusCode: result.statusCode,
      error: result.error
    });
  }

  return {
    iterations,
    warmupIterations,
    samples,
    summary: summarizeLatency(samples)
  };
}

function summarizeLatency(samples: LlamaHealthBenchmarkSample[]): LlamaHealthBenchmarkSummary {
  const latencies = samples
    .filter(sample => sample.ok && typeof sample.latencyMs === 'number')
    .map(sample => sample.latencyMs as number)
    .sort((left, right) => left - right);

  const successes = samples.filter(sample => sample.ok).length;
  const failures = samples.length - successes;

  if (!latencies.length) {
    return {
      successes,
      failures
    };
  }

  const total = latencies.reduce((sum, value) => sum + value, 0);
  return {
    successes,
    failures,
    minLatencyMs: latencies[0],
    maxLatencyMs: latencies[latencies.length - 1],
    avgLatencyMs: Number((total / latencies.length).toFixed(2)),
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95)
  };
}

function percentile(values: number[], ratio: number) {
  const index = Math.max(0, Math.ceil(values.length * ratio) - 1);
  return values[index];
}

function normalizeCount(value: number | undefined, fallback: number, label: string) {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
}
