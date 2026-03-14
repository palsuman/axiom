#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 \"Title of decision\"" >&2
  exit 1
fi

TITLE="$1"
shift || true
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-')
SLUG=${SLUG##-}
SLUG=${SLUG%%-}
ADR_DIR="docs/adr"
mkdir -p "$ADR_DIR"
LATEST=$(ls "$ADR_DIR" 2>/dev/null | grep -E '^ADR-[0-9]{4}' | sort | tail -n1 || true)
if [ -z "$LATEST" ]; then
  NEXT_NUM=1
else
  NEXT_NUM=$(echo "$LATEST" | sed -E 's/^ADR-([0-9]{4}).*/\1/')
  NEXT_NUM=$((10#$NEXT_NUM + 1))
fi
NEXT_NUM_PADDED=$(printf '%04d' "$NEXT_NUM")
FILENAME="$ADR_DIR/ADR-$NEXT_NUM_PADDED-$SLUG.md"
if [ -f "$FILENAME" ]; then
  echo "ADR file $FILENAME already exists" >&2
  exit 1
fi
if [ -f "$ADR_DIR/TEMPLATE.md" ]; then
  sed "s/ADR-XXXX/ADR-$NEXT_NUM_PADDED/" "$ADR_DIR/TEMPLATE.md" > "$FILENAME"
else
  cat <<'EOF' > "$FILENAME"
# ADR-NNNN Title Goes Here

## Status
Proposed

## Context

## Decision

## Consequences
- 
EOF
  sed -i '' "s/ADR-NNNN/ADR-$NEXT_NUM_PADDED/" "$FILENAME"
  sed -i '' "s/Title Goes Here/$TITLE/" "$FILENAME"
fi
sed -i '' "s/Title Goes Here/$TITLE/" "$FILENAME" || true
echo "Created $FILENAME"
