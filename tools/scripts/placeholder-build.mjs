#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const project = process.argv[2] ?? 'unknown';
const distDir = path.join('dist', project);
fs.mkdirSync(distDir, { recursive: true });
const artifactPath = path.join(distDir, 'BUILD_INFO.txt');
const content = `Build artifact placeholder for ${project} generated on ${new Date().toISOString()}\n`;
fs.writeFileSync(artifactPath, content, 'utf8');
console.log(`[nx:${project}:build] ${content.trim()}`);
