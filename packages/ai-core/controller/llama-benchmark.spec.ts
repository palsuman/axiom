import { runLlamaHealthBenchmark } from './llama-benchmark';

describe('runLlamaHealthBenchmark', () => {
  it('summarizes successful latency samples', async () => {
    const values = [10, 18, 12, 30, 24];
    const probe = jest.fn(async () => ({
      ok: true,
      checkedAt: Date.now(),
      latencyMs: values.shift(),
      statusCode: 200
    }));

    const result = await runLlamaHealthBenchmark(probe, {
      iterations: 4,
      warmupIterations: 1
    });

    expect(probe).toHaveBeenCalledTimes(5);
    expect(result.summary).toEqual({
      successes: 4,
      failures: 0,
      minLatencyMs: 12,
      maxLatencyMs: 30,
      avgLatencyMs: 21,
      p50LatencyMs: 18,
      p95LatencyMs: 30
    });
  });

  it('records failures without latency percentiles', async () => {
    const probe = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        checkedAt: 1,
        error: 'connection refused'
      })
      .mockResolvedValueOnce({
        ok: true,
        checkedAt: 2,
        latencyMs: 14,
        statusCode: 200
      });

    const result = await runLlamaHealthBenchmark(probe, {
      iterations: 2,
      warmupIterations: 0
    });

    expect(result.summary).toEqual({
      successes: 1,
      failures: 1,
      minLatencyMs: 14,
      maxLatencyMs: 14,
      avgLatencyMs: 14,
      p50LatencyMs: 14,
      p95LatencyMs: 14
    });
    expect(result.samples[0]).toMatchObject({
      ok: false,
      error: 'connection refused'
    });
  });
});
