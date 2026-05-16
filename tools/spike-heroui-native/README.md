# Spike — HeroUI Native + Uniwind + Tailwind v4 on Expo Web

**Purpose**: Verify the precondition of ADR 002 — that `heroui-native` (OSS v1.0.2) renders correctly on Expo Web (`react-native-web`) when paired with Uniwind + Tailwind v4.

This is **isolated from the main app** (`apps/mobile/`) — the spike's own `pnpm-workspace`-excluded folder, so installing here will not pollute the monorepo lockfile.

## Run

```bash
cd tools/spike-heroui-native
pnpm install --ignore-workspace
pnpm export:web        # produces ./dist
pnpm web               # interactive dev server, browser at http://localhost:8081
pnpm ios               # iOS simulator (requires Xcode)
```

## Verification matrix (mirrors ADR 002 spike acceptance table)

| # | Check | Pass criterion |
|:--|:--|:--|
| 1 | `pnpm install` | No unresolved peer dep conflicts |
| 2 | Metro / Uniwind boot | `pnpm web` starts; no bundler error |
| 3 | Web build | `pnpm export:web` exits 0; `dist/` populated |
| 4 | Web visual | Button / Card / Switch render, look like RN counterpart |
| 5 | iOS visual | Same components render in simulator |

Record results in `docs/adr/002-ui-library-decision.md` → "Spike 执行记录" section, then promote ADR status from "提议" to "已接受" with the chosen branch (A or B).

## Dispose

After deciding, this folder can either be:
- **Kept** as historical reproducer (zero cost — it is excluded from workspace)
- **Removed**: `git rm -rf tools/spike-heroui-native`
