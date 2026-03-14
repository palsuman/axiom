import {
  resolveBaseAndHead,
  buildAffectedArgs,
  getNxBinary,
  getNxCommandArgs
} from '../../../tools/scripts/lib/affected-config.js';

describe('affected config helpers', () => {
  it('resolves base/head with overrides', () => {
    const env = { NX_BASE: 'origin/develop', NX_HEAD: 'HEAD~1' };
    expect(resolveBaseAndHead(env)).toEqual({ base: 'origin/develop', head: 'HEAD~1' });
  });

  it('builds affected args with default targets', () => {
    const env = { NX_BASE: 'origin/main', NX_HEAD: 'HEAD' };
    const args = buildAffectedArgs(env);
    expect(args).toContain('--target');
    expect(args).toContain('lint');
  });

  it('selects npx binary on non-windows', () => {
    const bin = getNxBinary();
    expect(bin === 'npx' || bin === 'npx.cmd').toBe(true);
  });

  it('derives nx command args based on binary', () => {
    const args = getNxCommandArgs('npx', ['affected']);
    expect(args[0]).toBe('nx');
  });
});
