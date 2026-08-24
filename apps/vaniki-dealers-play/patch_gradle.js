const fs = require('fs');
const path = require('path');

const gradlePath = path.join(__dirname, 'android/app/build.gradle');

if (!fs.existsSync(gradlePath)) {
  console.error(`Error: ${gradlePath} does not exist. Run expo prebuild first.`);
  process.exit(1);
}

let content = fs.readFileSync(gradlePath, 'utf8');

// 1. Add keystorePropertiesFile loader
const loaderCode = `def keystorePropertiesFile = file('../local.properties')
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {`;

if (!content.includes('keystorePropertiesFile')) {
  content = content.replace('android {', loaderCode);
  console.log('Added keystorePropertiesFile loader to build.gradle');
}

// 2. Add release signingConfig
const debugSigningConfig = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

const customSigningConfig = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (keystoreProperties.containsKey('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(keystoreProperties['MYAPP_RELEASE_STORE_FILE'])
                storePassword keystoreProperties['MYAPP_RELEASE_STORE_PASSWORD']
                keyAlias keystoreProperties['MYAPP_RELEASE_KEY_ALIAS']
                keyPassword keystoreProperties['MYAPP_RELEASE_KEY_PASSWORD']
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
    }`;

if (content.includes(debugSigningConfig) && !content.includes('signingConfigs.release')) {
  content = content.replace(debugSigningConfig, customSigningConfig);
  console.log('Added release signingConfig to build.gradle');
} else if (!content.includes('signingConfigs.release')) {
  // Try alternative formatting (e.g. spaces/tabs)
  console.log('Warning: Standard debug signingConfigs block not found. Performing fallback replace...');
  content = content.replace(/signingConfigs\s*\{\s*debug\s*\{[^}]+\}\s*\}/, customSigningConfig);
}

// 3. Update release buildType to use release signingConfig
const releaseBuildTypeDebug = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

const releaseBuildTypeDebugSimple = `        release {
            signingConfig signingConfigs.debug`;

const releaseBuildTypeCustom = `        release {
            signingConfig signingConfigs.release`;

if (content.includes(releaseBuildTypeDebug)) {
  content = content.replace(releaseBuildTypeDebug, releaseBuildTypeCustom);
  console.log('Updated release buildType signingConfig (with comments) in build.gradle');
} else if (content.includes(releaseBuildTypeDebugSimple)) {
  content = content.replace(releaseBuildTypeDebugSimple, releaseBuildTypeCustom);
  console.log('Updated release buildType signingConfig (simple) in build.gradle');
}

fs.writeFileSync(gradlePath, content, 'utf8');
console.log('Successfully patched build.gradle for production release signing.');
