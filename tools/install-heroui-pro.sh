#!/usr/bin/env bash
# Install HeroUI Pro native artifacts using HEROUI_AUTH_TOKEN from .env.dev.local.
# Usage:
#   bash /Users/boyang/Documents/Code/arc/tools/install-heroui-pro.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
# Node version pinned in .nvmrc (repo root)
nvm use >/dev/null

if [ ! -f .env.dev.local ]; then
  echo "Missing .env.dev.local — restore secrets first." >&2
  exit 1
fi

eval "$(
  python3 - <<'PY'
from pathlib import Path
import shlex
path = Path(".env.dev.local")
for line in path.read_text().splitlines():
    s = line.strip()
    if not s or s.startswith("#") or "=" not in s:
        continue
    k, v = s.split("=", 1)
    if k != "HEROUI_AUTH_TOKEN":
        continue
    v = v.strip().strip('"').strip("'")
    if not v:
        raise SystemExit("HEROUI_AUTH_TOKEN is empty in .env.dev.local")
    print(f"export HEROUI_AUTH_TOKEN={shlex.quote(v)}")
    break
else:
    raise SystemExit("HEROUI_AUTH_TOKEN not found in .env.dev.local")
PY
)"

python3 - <<'PY'
import os
t = os.environ.get("HEROUI_AUTH_TOKEN", "")
print(f"HEROUI_AUTH_TOKEN loaded (len={len(t)})")
PY

# Resolve local heroui-pro CLI (pnpm does not hoist it to root .bin)
CLI_JS="$(python3 - <<'PY'
from pathlib import Path
root = Path("node_modules/.pnpm")
candidates = sorted(root.glob("heroui-pro@*/node_modules/heroui-pro/dist/cli/index.js"))
if not candidates:
    raise SystemExit("heroui-pro CLI not found under node_modules/.pnpm — run pnpm install first")
print(candidates[-1])
PY
)"
echo "Using CLI: $CLI_JS"

echo "Running: heroui-pro install react-native --yes"
node "$CLI_JS" install react-native --yes

# Fallback: re-run package postinstall (also honors HEROUI_AUTH_TOKEN)
POSTINSTALL="$(python3 - <<'PY'
from pathlib import Path
root = Path("node_modules/.pnpm")
hits = sorted(root.glob("heroui-native-pro@*/node_modules/heroui-native-pro/dist/postinstall/index.js"))
print(hits[-1] if hits else "")
PY
)"
if [ -n "$POSTINSTALL" ]; then
  echo "Re-running heroui-native-pro postinstall..."
  node "$POSTINSTALL" || true
fi

echo "Verifying Pro package entries..."
python3 - <<'PY'
from pathlib import Path
need = ["empty-state", "number-field", "area-chart", "line-chart", "pie-chart"]
root = Path("node_modules/heroui-native-pro")
print("heroui-native-pro exists:", root.exists())
missing = []
for n in need:
    hits = list(Path("node_modules").rglob(n))
    # ignore deep noise; prefer package-local
    ok = any("heroui-native-pro" in str(h) for h in hits[:20]) or (root / n).exists()
    print(f"{n}:", "ok" if ok else "missing")
    if not ok:
        missing.append(n)
if missing:
    raise SystemExit(f"Pro components still missing: {', '.join(missing)}")
print("Pro components look present.")
PY

echo "Running pnpm typecheck..."
pnpm typecheck
echo "Running pnpm test..."
pnpm test
echo "✓ HeroUI Pro install + verification done"
