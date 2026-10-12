const { withEntitlementsPlist } = require("expo/config-plugins");

// Reminders are scheduled on-device; APNs is not used by this app.
// Do not require push or disabled Apple-login provisioning capabilities.
module.exports = function withLocalOnlyCapabilities(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults["aps-environment"];
    if (!mod.ios?.usesAppleSignIn) {
      delete mod.modResults["com.apple.developer.applesignin"];
    }
    return mod;
  });
};
