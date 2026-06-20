const fs = require('fs');
const path = require('path');

const gradlePath = path.join(__dirname, './apps/mobile/android/app/build.gradle');
if (!fs.existsSync(gradlePath)) {
  console.error('build.gradle not found at ' + gradlePath);
  process.exit(1);
}

let content = fs.readFileSync(gradlePath, 'utf8');

// 1. Replace reactAndroidLibs with expoLibs
content = content.replace(/reactAndroidLibs/g, 'expoLibs');

// 2. Add keystore properties loading
if (!content.includes('keystorePropertiesFile')) {
  // Find jscFlavor declaration
  const jscRegex = /def jscFlavor = .+/;
  const match = content.match(jscRegex);
  if (match) {
    const target = match[0];
    const replacement = `${target}\n\ndef keystorePropertiesFile = file('../local.properties')\ndef keystoreProperties = new Properties()\nif (keystorePropertiesFile.exists()) {\n    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))\n}\n`;
    content = content.replace(target, replacement);
  }
}

// 3. Add signingConfigs.release
if (!content.includes('MYAPP_RELEASE_STORE_FILE')) {
  const target = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;
  const replacement = `    signingConfigs {
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
  content = content.replace(target, replacement);
}

// 4. Update release buildType to use release signingConfig
if (content.includes('signingConfig signingConfigs.debug')) {
  const target = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;
  const replacement = `        release {
            signingConfig signingConfigs.release`;
  content = content.replace(target, replacement);
  
  // Also handle if the comment is slightly different or absent in some templates
  const fallbackTarget = `        release {
            signingConfig signingConfigs.debug`;
  const fallbackReplacement = `        release {
            signingConfig signingConfigs.release`;
  content = content.replace(fallbackTarget, fallbackReplacement);
}

fs.writeFileSync(gradlePath, content, 'utf8');
console.log('Successfully patched build.gradle!');
