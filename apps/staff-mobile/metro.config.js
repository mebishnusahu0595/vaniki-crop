const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all workspace packages and node_modules
config.watchFolders = [
  projectRoot,
  path.resolve(workspaceRoot, 'packages'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Let Metro know where to resolve packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Enable symlinks for pnpm support
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

// Ensure Metro knows this is the project root (not the workspace root)
config.projectRoot = projectRoot;

// Fix "Cannot use import.meta outside a module" on web
// newArchEnabled uses hermes transform profile which emits import.meta
// but the web HTML loads the bundle as a regular script (not type="module")
const originalGetTransformOptions =
  config.transformer?.getTransformOptions;

config.transformer = {
  ...config.transformer,
  getTransformOptions: async (entryPoints, options, getDependenciesOf) => {
    const baseOptions = originalGetTransformOptions
      ? await originalGetTransformOptions(entryPoints, options, getDependenciesOf)
      : {};

    if (options?.platform === 'web') {
      return {
        ...baseOptions,
        transform: {
          ...baseOptions?.transform,
          experimentalImportSupport: false,
          inlineRequires: true,
          unstable_transformProfile: 'default',
        },
      };
    }

    return baseOptions;
  },
};

module.exports = withNativeWind(config, {
  input: './global.css',
});
