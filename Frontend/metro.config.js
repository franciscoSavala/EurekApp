// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Los tests e2e crean y borran archivos temporales (sesiones, cupos) que, si Metro los vigila, lo tiran.
config.resolver.blockList = [/(.*.spec.ts?)$/, /[\/]e2e[\/]\.sesiones[\/].*/, /[\/]test-results[\/].*/, /[\/]playwright-report[\/].*/];

module.exports = config;
