#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK="$REPO_ROOT/.git/hooks/pre-push"

cat > "$HOOK" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo "[pre-push] running coverage gate for homework-6..."
cd "$(git rev-parse --show-toplevel)/homework-6"
npm run test:cov --silent
npm run check-coverage
EOF

chmod +x "$HOOK"
echo "Installed pre-push hook at $HOOK"
