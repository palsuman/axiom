import {
  DebugProtocolMessageParser,
  serializeDebugProtocolMessage,
  type DebugProtocolEvent,
  type DebugProtocolRequest
} from './debug-adapter-protocol';

describe('debug-adapter-protocol', () => {
  it('serializes messages with a DAP content-length header', () => {
    const payload: DebugProtocolRequest = {
      seq: 1,
      type: 'request',
      command: 'initialize',
      arguments: { clientID: 'nexus' }
    };

    const wire = serializeDebugProtocolMessage(payload);

    expect(wire).toMatch(/^Content-Length:\s+\d+\r\n\r\n\{/);
    expect(wire).toContain('"command":"initialize"');
  });

  it('parses full and chunked messages', () => {
    const parser = new DebugProtocolMessageParser();
    const event: DebugProtocolEvent = {
      seq: 2,
      type: 'event',
      event: 'stopped',
      body: { reason: 'breakpoint' }
    };
    const wire = serializeDebugProtocolMessage(event);

    const split = [wire.slice(0, 15), wire.slice(15, 41), wire.slice(41)];
    const parsed: DebugProtocolEvent[] = [];
    split.forEach(chunk => {
      parsed.push(...(parser.push(chunk) as DebugProtocolEvent[]));
    });

    expect(parsed).toEqual([event]);
  });

  it('parses multiple concatenated messages', () => {
    const parser = new DebugProtocolMessageParser();
    const first: DebugProtocolRequest = {
      seq: 1,
      type: 'request',
      command: 'threads'
    };
    const second: DebugProtocolEvent = {
      seq: 2,
      type: 'event',
      event: 'terminated'
    };

    const parsed = parser.push(`${serializeDebugProtocolMessage(first)}${serializeDebugProtocolMessage(second)}`);

    expect(parsed).toEqual([first, second]);
  });

  it('rejects payloads with missing required fields', () => {
    const parser = new DebugProtocolMessageParser();
    const invalidPayload = JSON.stringify({ seq: 1, type: 'request', command: '' });
    const invalidWire = `Content-Length: ${Buffer.byteLength(invalidPayload, 'utf8')}\r\n\r\n${invalidPayload}`;

    expect(() => parser.push(invalidWire)).toThrow(/must include a command/);
  });
});
