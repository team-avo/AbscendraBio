#!/bin/sh
set -e

# Apply migrations (safe on a restored DB — already-applied migrations are skipped)
echo "[entrypoint] running prisma migrate deploy..."
npx prisma migrate deploy

# Seed only on an explicit opt-in (fresh install). Skip when restoring a prod dump.
if [ "$RUN_SEED" = "true" ]; then
  echo "[entrypoint] seeding lot-management + wholesale-pricing..."
  node prisma/seed-lot-management.js || true
  node prisma/seed-wholesale-pricing.js || true
fi

echo "[entrypoint] starting API..."
exec node server.js
