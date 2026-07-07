#!/usr/bin/env node
/**
 * EAS Build hook — ensure Skia prebuilt binaries exist before `pod install`.
 *
 * pnpm v10 blocks dependency postinstall scripts unless listed in
 * `pnpm.onlyBuiltDependencies`. This script is a belt-and-suspenders fallback
 * that runs `install-skia` explicitly on the EAS builder.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("[eas-post-install] app dir:", appDir);

execSync("npx install-skia", { cwd: appDir, stdio: "inherit" });

const require = createRequire(import.meta.url);
const skiaPkg = path.dirname(
  require.resolve("@shopify/react-native-skia/package.json", { paths: [appDir] }),
);
const iosLibs = path.join(skiaPkg, "libs", "ios");

if (!existsSync(iosLibs)) {
  console.error(
    "[eas-post-install] Skia libs/ios missing after install-skia:",
    iosLibs,
  );
  process.exit(1);
}

console.log("[eas-post-install] Skia libs verified:", iosLibs);
