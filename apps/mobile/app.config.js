const appJson = require('./app.json');
const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Fix for the 16KB Android page-size requirement (Google Play, Android 15+).
 *
 * On Expo SDK 53 / RN 0.79.6 every bundled native lib is 16KB-aligned
 * (verified: React Native core, Fresco 3.6.0 image libs, penfeizhou GIF 3.0.5).
 * The ONE remaining 4KB-aligned lib is libavif_android.so, which Glide pulls in
 * transitively via `com.github.bumptech.glide:avif-integration` ->
 * `org.aomedia.avif.android:avif` (0.11.x ships a 4KB .so).
 *
 * Do NOT exclude the .so from packaging: Glide's avif-integration prepends an
 * AVIF decoder whose handles() check calls into the native lib for EVERY image,
 * so a missing libavif_android.so throws UnsatisfiedLinkError and blanks all
 * remote images (expo-image). Instead, force the 1.1.1.14d8e3c4 release of the
 * avif lib, whose .so is 16KB-aligned and API-compatible with Glide 4.16.
 */
const withGlide16KBPageFix = (config) => {
  // Patch app/build.gradle to force the 16KB-aligned avif native lib
  config = withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;

    // Remove the old (broken) exclusion block from previously generated projects
    gradle = gradle.replace(
      /\n?\/\/ ─── 16KB Page Size Fix ─+[\s\S]*?\/\/ ─+\n/,
      '\n'
    );

    const avifForceBlock = `
// ─── 16KB Page Size Fix (avif force) ──────────────────────────────────
// Glide's avif-integration pulls org.aomedia.avif.android:avif 0.11.x whose
// libavif_android.so is only 4KB-aligned and fails Google Play's 16KB check.
// Force the 16KB-aligned release instead so the AVIF decoder keeps working
// and image loading via Glide/expo-image is not broken.
configurations.all {
    resolutionStrategy {
        force "org.aomedia.avif.android:avif:1.1.1.14d8e3c4"
    }
}
// ─────────────────────────────────────────────────────────────────────
`;

    // Only add if not already present
    if (!gradle.includes('16KB Page Size Fix (avif force)')) {
      // Insert before the dependencies block
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
      appVariant: 'customer',
    },
  },
};
