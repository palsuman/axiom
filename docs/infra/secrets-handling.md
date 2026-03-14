# Secrets & Environment Handling

1. `.env.example` documents base variables and must remain secret-free.
2. Local `.env` (ignored) feeds tooling via `tools/scripts/run-with-env.mjs`.
3. Future secrets integrate with OS Keychain; placeholder doc stored here.
