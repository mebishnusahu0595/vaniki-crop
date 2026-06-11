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
 * We exclude that integration so the lib is never packaged. AVIF images fall
 * back to Android's built-in AVIF decoder (API 31+); the app does not rely on
 * Glide-decoded AVIF.
 */
const withGlide16KBPageFix = (config) => {
  // Patch app/build.gradle to exclude non-16KB-compliant Glide native libs
  config = withAppBuildGradle(config, (mod) => {
    const gradle = mod.modResults.contents;

    const glideExclusionBlock = `
// ─── 16KB Page Size Fix ───────────────────────────────────────────────
// libavif_android.so (org.aomedia.avif.android:avif, pulled by Glide's
// avif-integration) is only 4KB-aligned and fails Google Play's 16KB check.
// Exclude it from packaging to prevent crashes and Google Play Console rejections.
// The avif-integration Java classes remain in the classpath to avoid NoClassDefFoundError.
android {
    packagingOptions {
        jniLibs {
            excludes += ["**/libavif_android.so"]
        }
    }
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
