import { getApp } from '@react-native-firebase/app';
import {
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
} from '@react-native-firebase/app-check';

let appCheckInstance;

// Initialize only when the AI feature is used. This module is imported by the
// navigator at startup, so initialization must not run during module loading.
export function getAppCheckInstance() {
  if (!appCheckInstance) {
    const provider = new ReactNativeFirebaseAppCheckProvider({
     android: {
  provider: 'playIntegrity',
},
      apple: { provider: 'debug' },
    });

    appCheckInstance = initializeAppCheck(getApp(), {
      provider,
      isTokenAutoRefreshEnabled: true,
    });
  }

  return appCheckInstance;
}
