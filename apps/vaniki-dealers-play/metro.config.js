const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');
const fs = require('fs');

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

  if (
    moduleName.startsWith('.')
    && moduleName.endsWith('.js')
    && context.originModulePath?.includes(`${path.sep}packages${path.sep}shared${path.sep}src${path.sep}`)
  ) {
    const tsSourcePath = path.resolve(path.dirname(context.originModulePath), moduleName.replace(/\.js$/, '.ts'));
    if (fs.existsSync(tsSourcePath)) {
      return {
        filePath: tsSourcePath,
        type: 'sourceFile',
      };
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

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

const https = require('https');
const originalEnhanceMiddleware = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware, server) => {
    const customMiddleware = (req, res, next) => {
      if (req.url && req.url.startsWith('/api-proxy/')) {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('access-control-allow-origin', '*');
          res.setHeader('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
          res.setHeader('access-control-allow-headers', 'Content-Type, Authorization, X-Store-Id');
          res.end();
          return;
        }

        const targetPath = req.url.replace('/api-proxy/', '/api/');
        const targetUrl = new URL(`https://vanikicrop.com${targetPath}`);

        const headers = { ...req.headers };
        delete headers.host;
        delete headers.origin;
        delete headers.referer;

        const proxyReq = https.request(
          targetUrl,
          {
            method: req.method,
            headers: {
              ...headers,
              host: 'vanikicrop.com',
            },
          },
          (proxyRes) => {
            res.statusCode = proxyRes.statusCode || 200;
            Object.keys(proxyRes.headers).forEach((key) => {
              if (key !== 'access-control-allow-origin') {
                res.setHeader(key, proxyRes.headers[key]);
              }
            });
            res.setHeader('access-control-allow-origin', '*');
            res.setHeader('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            res.setHeader('access-control-allow-headers', 'Content-Type, Authorization, X-Store-Id');

            proxyRes.pipe(res);
          }
        );

        proxyReq.on('error', (err) => {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err.message }));
        });

        if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
          req.pipe(proxyReq);
        } else {
          proxyReq.end();
        }
        return;
      }

      return metroMiddleware(req, res, next);
    };

    return originalEnhanceMiddleware
      ? originalEnhanceMiddleware(customMiddleware, server)
      : customMiddleware;
  },
};

module.exports = withNativeWind(config, {
  input: './global.css',
});
