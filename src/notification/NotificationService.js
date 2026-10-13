import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { doc, getFirestore, setDoc } from '@react-native-firebase/firestore';
import { PermissionsAndroid, Platform } from 'react-native';

const maskToken = token => {
  const value = String(token || '');
  return value.length > 8
    ? `${value.slice(0, 4)}…${value.slice(-4)}`
    : '[unavailable]';
};

class NotificationService {
  async requestPermission(uid) {
    try {
      if (Platform.OS === 'android') {
        if (Number(Platform.Version) >= 33) {
          const permission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );

          if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log('[FCM] Android notification permission not granted');
            return;
          }
        }

        await this.getToken(uid);
        return;
      }

      const messagingInstance = getMessaging();
      const authStatus = await requestPermission(messagingInstance);

      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        return;
      }

      await this.getToken(uid);
    } catch (error) {
      console.log('Permission error:', error);
    }
  }

  async getToken(uid) {
    try {
      if (!uid) return null;

      const token = await getToken(getMessaging());

      await setDoc(
        doc(getFirestore(), 'customers', uid),
        { fcmToken: token },
        { merge: true },
      );

      console.log('[FCM] Customer token registration saved', {
        documentPath: `customers/${uid}`,
        token: maskToken(token),
      });
      return token;
    } catch (error) {
      console.log('FCM token error:', error);
    }
  }

  subscribeToTokenRefresh(uid) {
    if (!uid) return () => {};

    let active = true;
    const unsubscribe = onTokenRefresh(getMessaging(), async token => {
      if (!active) return;

      try {
        await setDoc(
          doc(getFirestore(), 'customers', uid),
          { fcmToken: token },
          { merge: true },
        );
        console.log('[FCM] Refreshed customer token registration saved', {
          documentPath: `customers/${uid}`,
          token: maskToken(token),
        });
      } catch (error) {
        console.log('[FCM] Refreshed token registration failed:', error?.code || 'unknown');
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }

  async createChannel() {
    if (Platform.OS !== 'android') return;

    await notifee.createChannel({
      id: 'default',
      name: 'Default',
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });
    console.log('[Notifee] Android channel ready', { channelId: 'default' });
  }

  async displayNotification(remoteMessage) {
    try {
      await this.createChannel();

      const data = remoteMessage?.data || {};
      const notification = remoteMessage?.notification || {};

      const title = data.title || notification.title || 'New Notification';
      const body = data.body || notification.body || '';

      await notifee.displayNotification({
        title,
        body,
        data: {
          orderId: String(data.orderId || ''),
          status: String(data.status || ''),
          screen: String(data.screen || 'TrackOrderScreen'),
        },
        android: {
          channelId: 'default',
          pressAction: {
            id: 'default',
          },
        },
      });
      console.log('[Notifee] Notification displayed', {
        orderId: String(data.orderId || ''),
      });
    } catch (error) {
      console.error('[Notifee] Notification display failed', {
        code: error?.code || 'unknown',
        message: error?.message || 'unknown',
      });
    }
  }
}

export default new NotificationService();
