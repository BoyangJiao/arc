const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// pnpm monorepo: resolve deps from app + workspace roots (https://docs.expo.dev/guides/monorepos/)
const defaultWatchFolders = config.watchFolders ?? [];
config.watchFolders = [
  ...defaultWatchFolders,
  ...defaultWatchFolders.includes(monorepoRoot) ? [] : [monorepoRoot],
];
const defaultNodeModulesPaths = config.resolver.nodeModulesPaths ?? [];
config.resolver.nodeModulesPaths = [
  ...defaultNodeModulesPaths,
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
].filter((p, i, arr) => arr.indexOf(p) === i);

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
  dtsFile: "./src/uniwind.d.ts",
});
