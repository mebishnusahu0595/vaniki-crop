const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const compatEntries = {
  react: path.resolve(workspaceRoot, 'node_modules/react/index.js'),
  'react/jsx-runtime': path.resolve(workspaceRoot, 'node_modules/react/jsx-runtime.js'),
  'react/jsx-dev-runtime': path.resolve(workspaceRoot, 'node_modules/react/jsx-dev-runtime.js'),
  'react-dom': path.resolve(workspaceRoot, 'node_modules/react-dom/index.js'),
  'react-dom/client': path.resolve(workspaceRoot, 'node_modules/react-dom/client.js'),
  zustand: path.resolve(workspaceRoot, 'node_modules/zustand/index.js'),
  'zustand/react': path.resolve(workspaceRoot, 'node_modules/zustand/react.js'),
  'zustand/vanilla': path.resolve(workspaceRoot, 'node_modules/zustand/vanilla.js'),
  'zustand/middleware': path.resolve(workspaceRoot, 'node_modules/zustand/middleware.js'),
};

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
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const compatEntry = compatEntries[moduleName];

  if (compatEntry) {
    return {
      filePath: compatEntry,
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

// Ensure Metro knows this is the project root (not the workspace root)
config.projectRoot = projectRoot;

// Fix "Cannot use import.meta outside a module" on web
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
  input: './src/global.css',
});
