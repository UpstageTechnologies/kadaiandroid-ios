import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const nativeVoice = Platform.OS === 'android'
  ? NativeModules.RCTVoice
  : NativeModules.Voice;

const speechCallbacks = {
  onSpeechStart: null,
  onSpeechEnd: null,
  onSpeechError: null,
  onSpeechResults: null,
  onSpeechPartialResults: null,
};

const eventNames = Object.keys(speechCallbacks);
let subscriptions = [];

const ensureNativeModule = () => {
  if (!nativeVoice) {
    throw new Error('Speech recognition is not linked into this app build. Rebuild the native app and try again.');
  }
  return nativeVoice;
};

const attachListeners = () => {
  const module = ensureNativeModule();
  if (!subscriptions.length) {
    const emitter = new NativeEventEmitter(module);
    subscriptions = eventNames.map(eventName =>
      emitter.addListener(eventName, event => speechCallbacks[eventName]?.(event)),
    );
  }
};

const callNative = (methodName, args = []) => new Promise((resolve, reject) => {
  const module = ensureNativeModule();
  const method = module[methodName];
  if (typeof method !== 'function') {
    reject(new Error(`Speech recognition does not support ${methodName}.`));
    return;
  }

  method.call(module, ...args, error => {
    if (error) reject(new Error(String(error)));
    else resolve();
  });
});

const SpeechRecognition = {
  start: (locale, options = {}) => {
    attachListeners();
    return Platform.OS === 'android'
      ? callNative('startSpeech', [locale, {
          EXTRA_LANGUAGE_MODEL: 'LANGUAGE_MODEL_FREE_FORM',
          EXTRA_MAX_RESULTS: 5,
          EXTRA_PARTIAL_RESULTS: true,
          REQUEST_PERMISSIONS_AUTO: true,
          ...options,
        }])
      : callNative('startSpeech', [locale]);
  },
  stop: () => callNative('stopSpeech'),
  cancel: () => callNative('cancelSpeech'),
  destroy: () => callNative('destroySpeech'),
  isAvailable: () => new Promise((resolve, reject) => {
    const module = ensureNativeModule();
    if (typeof module.isSpeechAvailable !== 'function') {
      reject(new Error('Speech availability check is not supported on this device.'));
      return;
    }
    module.isSpeechAvailable((available, error) => {
      if (error) reject(new Error(String(error)));
      else resolve(Boolean(available));
    });
  }),
  removeAllListeners: () => {
    subscriptions.forEach(subscription => subscription.remove());
    subscriptions = [];
    eventNames.forEach(eventName => {
      speechCallbacks[eventName] = null;
    });
  },
};

eventNames.forEach(eventName => {
  Object.defineProperty(SpeechRecognition, eventName, {
    set: callback => {
      speechCallbacks[eventName] = callback;
    },
  });
});

export default SpeechRecognition;
