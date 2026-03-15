#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname "$0")/../.." && pwd)"
NEXUS_HOME="${NEXUS_HOME:-$REPO_ROOT/.nexus}"
NEXUS_DATA_DIR="${NEXUS_DATA_DIR:-$NEXUS_HOME}"
LLAMA_ROOT="${NEXUS_LLAMACPP_ROOT:-$NEXUS_DATA_DIR/ai/llama.cpp}"

mkdir -p "$(dirname "$LLAMA_ROOT")"

if [ ! -d "$LLAMA_ROOT" ]; then
  git clone https://github.com/ggerganov/llama.cpp.git "$LLAMA_ROOT"
fi

cd "$LLAMA_ROOT"
make LLAMA_OPENBLAS=1
