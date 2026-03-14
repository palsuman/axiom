#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const envFile = path.join(repoRoot, '.env');
if (fs.existsSync(envFile)) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: envFile });
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('[run-with-env] No command specified');
  process.exit(1);
}

const label = args.shift();
const child = spawn(args[0], args.slice(1), {
  stdio: 'inherit',
  env: { ...process.env, NX_TASK_LABEL: label }
});

child.on('exit', code => process.exit(code ?? 0));
