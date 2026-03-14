export type DebugProtocolRequest = {
  seq: number;
  type: 'request';
  command: string;
  arguments?: Record<string, unknown>;
};

export type DebugProtocolResponse = {
  seq: number;
  type: 'response';
  request_seq: number;
  success: boolean;
  command: string;
  message?: string;
  body?: Record<string, unknown>;
};

export type DebugProtocolEvent = {
  seq: number;
  type: 'event';
  event: string;
  body?: Record<string, unknown>;
};

export type DebugProtocolMessage = DebugProtocolRequest | DebugProtocolResponse | DebugProtocolEvent;

const HEADER_DELIMITER = Buffer.from('\r\n\r\n', 'utf8');

export function serializeDebugProtocolMessage(message: DebugProtocolMessage) {
  const payload = JSON.stringify(message);
  const contentLength = Buffer.byteLength(payload, 'utf8');
  return `Content-Length: ${contentLength}\r\n\r\n${payload}`;
}

export class DebugProtocolMessageParser {
  private buffer = Buffer.alloc(0);

  push(chunk: string | Buffer): DebugProtocolMessage[] {
    const nextChunk = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
    this.buffer = this.buffer.length === 0 ? nextChunk : Buffer.concat([this.buffer, nextChunk]);

    const messages: DebugProtocolMessage[] = [];
    while (this.buffer.length) {
      const headerEnd = this.buffer.indexOf(HEADER_DELIMITER);
      if (headerEnd < 0) {
        break;
      }

      const headersText = this.buffer.subarray(0, headerEnd).toString('utf8');
      const contentLength = readContentLength(headersText);
      const payloadStart = headerEnd + HEADER_DELIMITER.length;
      const payloadEnd = payloadStart + contentLength;
      if (this.buffer.length < payloadEnd) {
        break;
      }

      const payloadText = this.buffer.subarray(payloadStart, payloadEnd).toString('utf8');
      let payload: unknown;
      try {
        payload = JSON.parse(payloadText);
      } catch (error) {
        throw new Error(`Invalid debug adapter payload: ${(error as Error).message}`);
      }
      messages.push(assertDebugProtocolMessage(payload));
      this.buffer = this.buffer.subarray(payloadEnd);
    }

    return messages;
  }
}

function readContentLength(headers: string) {
  const match = /(?:^|\r\n)Content-Length:\s*(\d+)\s*(?:\r\n|$)/i.exec(headers);
  if (!match) {
    throw new Error('Debug adapter message is missing Content-Length header');
  }
  const parsed = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid Content-Length header: ${match[1]}`);
  }
  return parsed;
}

function assertDebugProtocolMessage(value: unknown): DebugProtocolMessage {
  if (!isRecord(value) || typeof value.type !== 'string' || typeof value.seq !== 'number') {
    throw new Error('Debug adapter payload must include numeric seq and string type fields');
  }

  if (value.type === 'request') {
    if (typeof value.command !== 'string' || value.command.length === 0) {
      throw new Error('Debug adapter request payload must include a command');
    }
    return {
      seq: value.seq,
      type: 'request',
      command: value.command,
      arguments: isRecord(value.arguments) ? value.arguments : undefined
    };
  }

  if (value.type === 'response') {
    if (typeof value.command !== 'string' || typeof value.request_seq !== 'number' || typeof value.success !== 'boolean') {
      throw new Error('Debug adapter response payload is missing required fields');
    }
    return {
      seq: value.seq,
      type: 'response',
      request_seq: value.request_seq,
      success: value.success,
      command: value.command,
      message: typeof value.message === 'string' ? value.message : undefined,
      body: isRecord(value.body) ? value.body : undefined
    };
  }

  if (value.type === 'event') {
    if (typeof value.event !== 'string' || value.event.length === 0) {
      throw new Error('Debug adapter event payload must include an event name');
    }
    return {
      seq: value.seq,
      type: 'event',
      event: value.event,
      body: isRecord(value.body) ? value.body : undefined
    };
  }

  throw new Error(`Unsupported debug adapter payload type: ${value.type}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
