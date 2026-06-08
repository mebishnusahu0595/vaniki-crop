const appJson = require('./app.json');
const { withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Fix for 16KB Android page size requirement.
 *
 * expo-image ships Glide 4.16.0 which includes libavif_android.so and
 * libanimation-decoder-gif.so — both non-compliant with 16KB page alignment.
 * Glide 4.16.0+ with the avif-integration fix is available from a patched build,
 * but the safest approach for SDK 52 is to:
 *  1. Exclude the non-compliant avif/gif native modules from Glide
 *  2. Force Glide to the latest 4.x version (4.16.0 has a fix in some builds)
 *
 * This is a targeted fix that does NOT require upgrading to SDK 53.
 */
const withGlide16KBPageFix = (config) => {
  // Patch app/build.gradle to exclude non-16KB-compliant Glide native libs
  config = withAppBuildGradle(config, (mod) => {
    const gradle = mod.modResults.contents;

    const glideExclusionBlock = `
// ─── 16KB Page Size Fix ───────────────────────────────────────────────
// Exclude Glide native libs that are not aligned to 16KB page boundaries.
// libavif_android.so and libanimation-decoder-gif.so from glide:avif-integration
// and glide:gif-library are non-compliant. We exclude them here and rely on
// Android's built-in AVIF/GIF support (Android 12+ / API 31+).
configurations.all {
    resolutionStrategy {
        force 'com.github.bumptech.glide:glide:4.16.0'
        force 'com.github.bumptech.glide:okhttp3-integration:4.16.0'
    }
    exclude group: 'com.github.bumptech.glide', module: 'avif-integration'
    exclude group: 'com.github.bumptech.glide', module: 'gif-library'
}
// ─────────────────────────────────────────────────────────────────────
`;

    // Only add if not already present
    if (!gradle.includes('16KB Page Size Fix')) {
      // Insert before the dependencies block
      mod.modResults.contents = gradle.replace(
        /^(dependencies\s*\{)/m,
        `${glideExclusionBlock}\n$1`
      );
    }

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
      appVariant: 'customer',
    },
  },
};
