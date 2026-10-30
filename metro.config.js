const { getDefaultConfig } = require('expo/metro-config');
const { generate } = require('./scripts/lucide-shim');

const config = getDefaultConfig(__dirname);

// Load only the icons the app uses instead of all of lucide-react-native (see scripts/lucide-shim.js).
const lucideShim = generate();
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'lucide-react-native' && context.originModulePath !== lucideShim) {
    return { type: 'sourceFile', filePath: lucideShim };
  }
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
