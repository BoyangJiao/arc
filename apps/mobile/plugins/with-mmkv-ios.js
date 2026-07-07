/**
 * react-native-mmkv v4 (NitroMmkv) needs MMKVCore with modular headers on iOS when
 * linked as static libraries — otherwise `pod install` fails on EAS / prebuild.
 *
 * @see https://github.com/mrousavy/react-native-mmkv/issues/881
 */
const { withPodfile } = require("expo/config-plugins");

const MMKV_POD_LINE = "pod 'MMKVCore', :modular_headers => true";

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withMmkvIos = (config) =>
  withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes(MMKV_POD_LINE)) {
      return config;
    }

    if (contents.includes("use_expo_modules!")) {
      config.modResults.contents = contents.replace(
        /use_expo_modules!\n/,
        `use_expo_modules!\n  ${MMKV_POD_LINE}\n`,
      );
      return config;
    }

    config.modResults.contents = `${contents}\n  ${MMKV_POD_LINE}\n`;
    return config;
  });

module.exports = withMmkvIos;
