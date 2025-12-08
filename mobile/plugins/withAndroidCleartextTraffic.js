const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidCleartextTraffic(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    
    if (!androidManifest.application) {
      androidManifest.application = [{ $: {} }];
    }
    
    const application = androidManifest.application[0];
    
    // Add usesCleartextTraffic attribute
    if (!application.$) {
      application.$ = {};
    }
    application.$['android:usesCleartextTraffic'] = 'true';
    
    return config;
  });
};

