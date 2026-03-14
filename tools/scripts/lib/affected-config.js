const path = require('node:path');

function resolveBaseAndHead(env = process.env) {
  const base = env.NX_BASE ?? env.NEXUS_AFFECTED_BASE ?? 'origin/main';
  const head = env.NX_HEAD ?? env.NEXUS_AFFECTED_HEAD ?? 'HEAD';
  return { base, head };
}

function buildAffectedArgs(env = process.env, additionalTargets = []) {
  const { base, head } = resolveBaseAndHead(env);
  const targets = additionalTargets.length ? additionalTargets : ['lint', 'test'];
  const args = ['affected', '--base', base, '--head', head, '--parallel', env.NEXUS_AFFECTED_PARALLEL ?? '3'];
  targets.forEach(target => {
    args.push('--target', target);
  });
  return args;
}

function getNxBinary() {
  if (process.env.NEXUS_NX_BIN) return process.env.NEXUS_NX_BIN;
  if (process.platform === 'win32') return 'npx.cmd';
  return 'npx';
}

function getNxCommandArgs(baseCommand = 'nx', nxArgs = []) {
  if (baseCommand === 'npx' || baseCommand === 'npx.cmd') {
    return ['nx', ...nxArgs];
  }
  return nxArgs;
}

module.exports = {
  resolveBaseAndHead,
  buildAffectedArgs,
  getNxBinary,
  getNxCommandArgs
};
