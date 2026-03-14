#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

if ! command -v yarn >/dev/null 2>&1; then
  echo "[setup] yarn not found. Please install Yarn 1.22.22 (e.g. corepack prepare yarn@1.22.22 --activate)."
  exit 1
fi

YARN_VERSION=$(yarn --version)
if [ "$YARN_VERSION" != "1.22.22" ]; then
  echo "[setup] Expected yarn 1.22.22 but found $YARN_VERSION"
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "[setup] git is required."
  exit 1
fi

echo "[setup] Installing dependencies..."
yarn install --check-files

if command -v brew >/dev/null 2>&1 && ! command -v cmake >/dev/null 2>&1; then
  echo "[setup] Installing cmake via brew (required for llama.cpp)"
  brew install cmake
fi

mkdir -p .nexus

echo "[setup] Repository ready."
