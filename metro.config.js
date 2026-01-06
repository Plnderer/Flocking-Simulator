// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { resolve } = require('metro-resolver');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'zustand' || moduleName.startsWith('zustand/')) {
        // Force CJS exports for zustand to avoid import.meta.env in web bundles.
        return resolve({ ...context, isESMImport: false }, moduleName, platform);
    }

    if (typeof defaultResolveRequest === 'function') {
        return defaultResolveRequest(context, moduleName, platform);
    }

    return resolve(context, moduleName, platform);
};

module.exports = config;
