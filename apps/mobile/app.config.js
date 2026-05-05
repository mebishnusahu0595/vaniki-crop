const appJson = require('./app.json');

const isStaffApp = process.env.EXPO_PUBLIC_APP_VARIANT === 'staff';

module.exports = {
  expo: {
    ...appJson.expo,
    name: isStaffApp ? 'Vaniki Staff' : appJson.expo.name,
    slug: isStaffApp ? 'vanikicrop-staff' : appJson.expo.slug,
    description: isStaffApp
      ? 'Vaniki Staff delivery app for assigned delivery tasks, OTP verification, proof upload, and cancellation reporting.'
      : appJson.expo.description,
    scheme: isStaffApp ? 'vanikistaff' : appJson.expo.scheme,
    extra: {
      ...appJson.expo.extra,
      appVariant: isStaffApp ? 'staff' : 'customer',
    },
  },
};
