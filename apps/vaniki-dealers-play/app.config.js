const appJson = require('./app.json');
const { withAppBuildGradle } = require('@expo/config-plugins');

const withGlide16KBPageFix = (config) => {
  config = withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;

    gradle = gradle.replace(
      /\n?\/\/ ─── 16KB Page Size Fix ─+[\s\S]*?\/\/ ─+\n/,
      '\n'
    );

    const avifForceBlock = `
// ─── 16KB Page Size Fix (avif force) ──────────────────────────────────
configurations.all {
    resolutionStrategy {
        force "org.aomedia.avif.android:avif:1.1.1.14d8e3c4"
    }
}
// ─────────────────────────────────────────────────────────────────────
`;

    if (!gradle.includes('16KB Page Size Fix (avif force)')) {
      gradle = gradle.replace(
        /^(dependencies\s*\{)/m,
        `${avifForceBlock}\n$1`
      );
    }

    mod.modResults.contents = gradle;
    return mod;
  });

  return config;
};

module.exports = {
  expo: {
    ...appJson.expo,
    plugins: [
      ...(appJson.expo.plugins || []),
      withGlide16KBPageFix,
    ],
    extra: {
      ...appJson.expo.extra,
      appVariant: 'dealer',
      eas: {
        projectId: '2db8ff2d-1cfa-452f-9bf6-157bc791d7d1',
      },
    },
  },
};
