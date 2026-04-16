#!/bin/sh
set -e

echo "[entrypoint] running prisma migrate deploy..."
node ./node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma

echo "[entrypoint] starting: $*"
exec "$@"
