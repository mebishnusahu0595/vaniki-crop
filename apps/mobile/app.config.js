const appJson = require('./app.json');

const isStaffApp = process.env.EXPO_PUBLIC_APP_VARIANT === 'staff';

module.exports = {
  expo: {
    ...appJson.expo,
    name: isStaffApp ? 'Vaniki Staff' : appJson.expo.name,
    description: isStaffApp
      ? 'Vaniki Staff delivery app for assigned delivery tasks, OTP verification, proof upload, and cancellation reporting.'
      : appJson.expo.description,
    scheme: isStaffApp ? 'vanikistaff' : appJson.expo.scheme,
    plugins: isStaffApp
      ? appJson.expo.plugins.filter(
          (p) => p !== '@react-native-firebase/app' && p !== '@react-native-firebase/auth'
        )
      : appJson.expo.plugins,
    android: {
      ...appJson.expo.android,
      package: isStaffApp ? 'com.vanikicrop.staff' : appJson.expo.android.package,
    },
    ios: {
      ...appJson.expo.ios,
      bundleIdentifier: isStaffApp ? 'com.vanikicrop.staff' : appJson.expo.ios.bundleIdentifier,
    },
    extra: {
      ...appJson.expo.extra,
      appVariant: isStaffApp ? 'staff' : 'customer',
    },
  },
};
