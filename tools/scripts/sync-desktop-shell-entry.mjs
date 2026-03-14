#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const distRoot = path.resolve(repoRoot, 'dist/apps/desktop-shell');
const sourceMainPath = path.resolve(distRoot, 'apps/desktop-shell/main.js');
const targetMainPath = path.resolve(distRoot, 'main.js');

if (!fs.existsSync(sourceMainPath)) {
  process.exit(0);
}

const sourceMainContent = fs.readFileSync(sourceMainPath, 'utf8');
const mainHeader = sourceMainContent.startsWith('"use strict";')
  ? '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\n'
  : '';
const rewrittenMain = `${mainHeader}require("./apps/desktop-shell/src/main");\n`;
fs.writeFileSync(targetMainPath, rewrittenMain, 'utf8');
