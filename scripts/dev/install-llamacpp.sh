#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname "$0")/../.." && pwd)"
mkdir -p "$REPO_ROOT/.nexus"
cd "$REPO_ROOT/.nexus"

if [ ! -d llama.cpp ]; then
  git clone https://github.com/ggerganov/llama.cpp.git
fi
cd llama.cpp
make LLAMA_OPENBLAS=1
