const { getDefaultConfig } = require('expo/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('cjs');

module.exports = withSentryConfig(config);
