#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveBaseAndHead,
  buildAffectedArgs,
  getNxBinary,
  getNxCommandArgs
} from './lib/affected-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..', '..');

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: workspaceRoot,
    env: { ...process.env }
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const { base, head } = resolveBaseAndHead(process.env);
console.log(`[affected] base=${base} head=${head}`);

const nxBinary = getNxBinary();

// Print affected graph summary
const printArgs = ['print-affected', '--base', base, '--head', head, '--select', 'projects'];
run(nxBinary, getNxCommandArgs(nxBinary, printArgs));

// Enforce lint/test on affected
const affectedArgs = buildAffectedArgs(process.env);
run(nxBinary, getNxCommandArgs(nxBinary, affectedArgs));
