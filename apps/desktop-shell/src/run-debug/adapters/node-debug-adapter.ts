import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';

import {
  DebugProtocolMessageParser,
  serializeDebugProtocolMessage,
  type DebugProtocolMessage,
  type DebugProtocolRequest,
  type DebugProtocolResponse
} from '@nexus/platform/run-debug/debug-adapter-protocol';

type BreakpointMap = Map<string, number[]>;

type StopState = {
  reason: 'entry' | 'breakpoint';
  line: number;
  sourcePath?: string;
};

type AdapterRuntime = {
  sequence: number;
  target?: ChildProcessWithoutNullStreams;
  targetProgram?: string;
  targetCwd?: string;
  stopOnEntry: boolean;
  breakpoints: BreakpointMap;
  lastStop?: StopState;
  terminated: boolean;
  stopEmitted: boolean;
};

const runtime: AdapterRuntime = {
  sequence: 1,
  stopOnEntry: false,
  breakpoints: new Map<string, number[]>(),
  terminated: false,
  stopEmitted: false
};

const parser = new DebugProtocolMessageParser();

process.stdin.on('data', chunk => {
  const messages = parser.push(chunk);
  messages.forEach(message => {
    if (message.type === 'request') {
      void handleRequest(message);
    }
  });
});

process.stdin.on('end', () => {
  shutdown();
});

process.on('SIGTERM', () => {
  shutdown();
});

async function handleRequest(request: DebugProtocolRequest) {
  switch (request.command) {
    case 'initialize':
      sendResponse(request, {
        supportsConfigurationDoneRequest: true,
        supportsTerminateRequest: true,
        supportsRestartRequest: false
      });
      sendEvent('initialized');
      return;

    case 'launch': {
      try {
        const args = (request.arguments ?? {}) as Record<string, unknown>;
        launchTarget(args);
        sendResponse(request, {});
      } catch (error) {
        sendResponse(request, {}, false, (error as Error).message);
      }
      return;
    }

    case 'attach':
      sendResponse(request, {}, false, 'Attach requests are not supported by the Nexus MVP node adapter');
      return;

    case 'setBreakpoints': {
      const args = (request.arguments ?? {}) as Record<string, unknown>;
      const sourcePath = readSourcePath(args);
      const breakpointLines = readBreakpointLines(args);
      runtime.breakpoints.set(sourcePath ?? '', breakpointLines);
      sendResponse(request, {
        breakpoints: breakpointLines.map(line => ({ verified: true, line }))
      });
      return;
    }

    case 'configurationDone':
      sendResponse(request, {});
      maybeEmitSyntheticStop();
      return;

    case 'threads':
      sendResponse(request, {
        threads: runtime.target ? [{ id: 1, name: 'Main Thread' }] : []
      });
      return;

    case 'stackTrace':
      sendResponse(request, {
        stackFrames: buildStackFrames(),
        totalFrames: buildStackFrames().length
      });
      return;

    case 'evaluate': {
      const args = (request.arguments ?? {}) as Record<string, unknown>;
      sendResponse(request, evaluateExpression(args));
      return;
    }

    case 'continue':
      runtime.lastStop = undefined;
      sendResponse(request, { allThreadsContinued: true });
      sendEvent('continued', { threadId: 1, allThreadsContinued: true });
      return;

    case 'disconnect': {
      const terminate =
        typeof request.arguments?.terminateDebuggee === 'boolean' ? request.arguments.terminateDebuggee : true;
      if (terminate) {
        stopTarget();
      }
      sendResponse(request, {});
      sendTerminated();
      shutdown();
      return;
    }

    default:
      sendResponse(request, {}, false, `Unsupported request: ${request.command}`);
  }
}

function launchTarget(args: Record<string, unknown>) {
  if (runtime.target) {
    stopTarget();
  }

  const program = readRequiredString(args, 'program');
  const cwd = readOptionalString(args, 'cwd') ?? process.cwd();
  const launchArgs = readStringArray(args, 'args');
  const env = readStringRecord(args, 'env');
  const stopOnEntry = typeof args.stopOnEntry === 'boolean' ? args.stopOnEntry : false;

  const resolvedProgram = path.isAbsolute(program) ? program : path.resolve(cwd, program);
  runtime.stopOnEntry = stopOnEntry;
  runtime.stopEmitted = false;
  runtime.lastStop = undefined;
  runtime.targetProgram = resolvedProgram;
  runtime.targetCwd = cwd;
  runtime.terminated = false;

  const target = spawn(process.execPath, [resolvedProgram, ...launchArgs], {
    cwd,
    env: {
      ...process.env,
      ...env
    },
    stdio: 'pipe'
  });

  runtime.target = target;

  target.stdout.on('data', chunk => {
    sendEvent('output', {
      category: 'stdout',
      output: chunk.toString('utf8')
    });
  });

  target.stderr.on('data', chunk => {
    sendEvent('output', {
      category: 'stderr',
      output: chunk.toString('utf8')
    });
  });

  target.on('exit', (code, signal) => {
    runtime.target = undefined;
    sendEvent('exited', {
      exitCode: typeof code === 'number' ? code : 0,
      signal: signal ?? undefined
    });
    sendTerminated();
  });

  target.on('error', error => {
    sendEvent('output', {
      category: 'stderr',
      output: `[adapter] failed to start target: ${error.message}\n`
    });
    sendTerminated();
  });
}

function maybeEmitSyntheticStop() {
  if (runtime.stopEmitted) {
    return;
  }

  const sourcePath = runtime.targetProgram;
  const sourceBreakpoints = sourcePath ? runtime.breakpoints.get(sourcePath) ?? runtime.breakpoints.get('') : runtime.breakpoints.get('');

  const stop = runtime.stopOnEntry
    ? { reason: 'entry' as const, line: 1, sourcePath }
    : sourceBreakpoints && sourceBreakpoints.length > 0
      ? { reason: 'breakpoint' as const, line: sourceBreakpoints[0], sourcePath }
      : undefined;

  if (!stop) {
    return;
  }

  runtime.stopEmitted = true;
  runtime.lastStop = stop;

  setTimeout(() => {
    if (runtime.terminated) {
      return;
    }
    sendEvent('stopped', {
      reason: stop.reason,
      threadId: 1,
      allThreadsStopped: true
    });
  }, 15);
}

function buildStackFrames() {
  if (!runtime.lastStop) {
    return [];
  }
  return [
    {
      id: 1,
      name: runtime.lastStop.reason === 'entry' ? 'entry' : 'breakpoint',
      source: runtime.lastStop.sourcePath
        ? {
            name: path.basename(runtime.lastStop.sourcePath),
            path: runtime.lastStop.sourcePath
          }
        : undefined,
      line: runtime.lastStop.line,
      column: 1
    }
  ];
}

function evaluateExpression(args: Record<string, unknown>) {
  const expression = readOptionalString(args, 'expression') ?? '';
  const normalized = expression.trim();
  if (!normalized) {
    return {
      result: 'Expression is empty',
      type: 'string'
    };
  }

  switch (normalized) {
    case 'process.pid':
      return {
        result: runtime.target?.pid ? String(runtime.target.pid) : '0',
        type: 'number'
      };
    case 'process.cwd()':
    case 'cwd':
      return {
        result: runtime.targetCwd ?? process.cwd(),
        type: 'string'
      };
    case 'program':
      return {
        result: runtime.targetProgram ?? '',
        type: 'string'
      };
    case 'stopReason':
      return {
        result: runtime.lastStop?.reason ?? 'running',
        type: 'string'
      };
    case 'args.length':
      return {
        result: String(process.argv.length),
        type: 'number'
      };
    default:
      if (/^-?\d+(\.\d+)?$/.test(normalized)) {
        return {
          result: normalized,
          type: 'number'
        };
      }
      if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
        return {
          result: normalized.slice(1, -1),
          type: 'string'
        };
      }
      return {
        result: `Unavailable in Nexus MVP adapter: ${normalized}`,
        type: 'string'
      };
  }
}

function readSourcePath(args: Record<string, unknown>) {
  const source = args.source;
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const pathCandidate = (source as Record<string, unknown>).path;
    if (typeof pathCandidate === 'string' && pathCandidate.trim()) {
      return pathCandidate;
    }
  }
  return runtime.targetProgram;
}

function readBreakpointLines(args: Record<string, unknown>) {
  const breakpoints = args.breakpoints;
  if (!Array.isArray(breakpoints)) {
    return [];
  }
  return breakpoints
    .map(entry => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>).line : undefined))
    .filter((line): line is number => typeof line === 'number' && Number.isInteger(line) && line > 0);
}

function readRequiredString(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`launch.${key} must be a non-empty string`);
  }
  return value.trim();
}

function readOptionalString(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized || undefined;
}

function readStringArray(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(entry => (typeof entry === 'string' ? entry : ''))
    .map(entry => entry.trim())
    .filter(Boolean);
}

function readStringRecord(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const normalized: Record<string, string> = {};
  Object.entries(value as Record<string, unknown>).forEach(([entryKey, entryValue]) => {
    if (typeof entryValue === 'string') {
      normalized[entryKey] = entryValue;
    }
  });
  return normalized;
}

function sendTerminated() {
  if (runtime.terminated) {
    return;
  }
  runtime.terminated = true;
  sendEvent('terminated', {});
}

function stopTarget() {
  if (runtime.target && !runtime.target.killed) {
    runtime.target.kill('SIGTERM');
  }
  runtime.target = undefined;
}

function shutdown() {
  stopTarget();
}

function sendResponse(
  request: DebugProtocolRequest,
  body: Record<string, unknown>,
  success = true,
  message?: string
) {
  const response: DebugProtocolResponse = {
    seq: nextSequence(),
    type: 'response',
    request_seq: request.seq,
    success,
    command: request.command,
    body,
    message
  };
  writeMessage(response);
}

function sendEvent(event: string, body: Record<string, unknown> = {}) {
  writeMessage({
    seq: nextSequence(),
    type: 'event',
    event,
    body
  });
}

function nextSequence() {
  const current = runtime.sequence;
  runtime.sequence += 1;
  return current;
}

function writeMessage(message: DebugProtocolMessage) {
  process.stdout.write(serializeDebugProtocolMessage(message));
}
