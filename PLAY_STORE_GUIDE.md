# Google Play Store Upload & Keystore Guide for Vaniki Crop

This guide explains how to upload the built **Android App Bundle (AAB)** (`.aab` file) to the **Google Play Console**, how app signing keys work, and what you need to do step-by-step to release the app.

---

## 1. Understanding Signing Keys & Keystores

When releasing an Android app to the Play Store, security is maintained using **cryptographic signing keys**. 

### The Two Keys System:
1. **App Signing Key (Google Managed)**: 
   - Google manages this key in their secure infrastructure. When you upload your AAB, Google decrypts it using your upload key, and then re-signs it with this App Signing Key before delivering it to user devices.
2. **Upload Key (Your Local Keystore)**:
   - This is the private key used to sign your `.aab` file *before* uploading it to the Play Store.
   - For your project, this key is stored in: [apps/mobile/@mebishnusahu0595__vaniki-crop.jks](file:///home/bishnups/Documents/projects/Vaniki%20crop/apps/mobile/@mebishnusahu0595__vaniki-crop.jks).
   - EAS CLI uses this local keystore credentials stored securely in Expo's servers to sign the `.aab` locally.

> [!WARNING]
> **NEVER LOSE YOUR UPLOAD KEY (`.jks` file)**. If you lose this key or delete it, you will not be able to upload updates to the app unless you contact Google Play Support to reset your upload key. Keep `@mebishnusahu0595__vaniki-crop.jks` safe.

---

## 2. Preparing the Build for Play Store
The Google Play Store requires that every new upload has a higher **Version Code** (`versionCode`) than the previous one:
- **Previous Release (from your screenshots)**: Version `1.0.0` with **Version Code `4`**.
- **This Local Build**: Version `1.0.1` with **Version Code `5`** (configured in [app.json](file:///home/bishnups/Documents/projects/Vaniki%20crop/apps/mobile/app.json)).
- The target SDK is **35**, which is compliant with the latest Google Play Store requirements.

---

## 3. How to Upload the AAB to Google Play Console

Follow these steps to upload the built AAB file:

### Step 1: Open Google Play Console
1. Go to the [Google Play Console](https://play.google.com/console/).
2. Select your app **Vaniki Crop** from the "All apps" list.

### Step 2: Go to the Release Section
Depending on which track you want to release to, select it from the left-hand navigation pane under **Test and release**:
- **Production**: To release the app to all public users.
- **Closed testing (Alpha / Beta)**: To release to a restricted group of testers (this is where version `4 (1.0.0)` is currently active).

### Step 3: Create a New Release
1. Inside your chosen track (e.g., **Closed testing** -> **Alpha**), click the **Create new release** button (located in the top-right corner).
2. Under **App bundles**, click **Upload** or drag-and-drop the generated `.aab` file from your computer's root directory:
   - The file will be named something like `VanikiCrop-production-v1.0.1.aab` or `app-release.aab` in your root folder.

### Step 4: Add Release Details
1. **Release name**: This will automatically populate with `1.0.1` once the bundle finishes uploading successfully.
2. **Release notes**: Add a short description of what is new in this release for your users or testers. For example:
   ```text
   - Added secure login flow.
   - Updated connection to production API servers.
   - General performance improvements and bug fixes.
   ```

### Step 5: Save and Review
1. Click **Save as draft** at the bottom-right.
2. Click **Next** / **Review release** to check for any warnings or errors.
3. Review the targeted countries, version codes, and testers.

### Step 6: Rollout
- If it is in Closed Testing: Click **Start rollout to Closed testing**.
- If it is in Production: Click **Start rollout to Production**.

---

## 4. Troubleshooting Upload Errors

### Error: "Version code X has already been used."
- **Why**: You are trying to upload a build with a `versionCode` that already exists on Google Play.
- **Fix**: Open [app.json](file:///home/bishnups/Documents/projects/Vaniki%20crop/apps/mobile/app.json), increment the `versionCode` (e.g., from `5` to `6`), and run the build command again.

### Error: "The Android App Bundle was signed with the wrong key."
- **Why**: The keystore used to build the AAB locally doesn't match the upload key registered for this app on Google Play.
- **Fix**: Make sure you build using the production profile which uses your verified `@mebishnusahu0595__vaniki-crop.jks` signing credentials on Expo.
