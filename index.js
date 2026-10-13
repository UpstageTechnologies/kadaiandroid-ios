/**
 * @format
 */

import { AppRegistry } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { EventType } from '@notifee/react-native';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

import NotificationService from './src/notification/NotificationService';
const messagingInstance = getMessaging();

setBackgroundMessageHandler(messagingInstance, async remoteMessage => {
  if (remoteMessage?.notification) {
    // Android displays notification payloads itself while backgrounded.
    // Let the OS show it instead of creating a duplicate Notifee notification.
    console.log('[FCM] Background notification payload left to Android');
    return;
  }

  console.log('[FCM] Background data message received', {
    messageId: remoteMessage?.messageId || 'unknown',
  });

  await NotificationService.displayNotification(remoteMessage);
});

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type !== EventType.PRESS) return;

  const orderId = detail.notification?.data?.orderId;
  if (typeof orderId === 'string' && orderId) {
    await AsyncStorage.setItem('pendingNotificationOrderId', orderId);
  }
});

AppRegistry.registerComponent(appName, () => App);
