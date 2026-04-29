#!/usr/bin/env bash
# Start the Banking Transactions API
# Usage: ./demo/run.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

PORT="${PORT:-3000}" npm start