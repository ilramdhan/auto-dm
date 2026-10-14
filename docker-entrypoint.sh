#!/bin/sh
set -e
if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  node ./migrate.mjs
fi
exec node server.js
