import React, { useEffect, useState } from 'react';
import { AppState, Platform, LogBox } from 'react-native';

// Permanently suppress LogBox warning toast banners across app launch and runtime
LogBox.ignoreAllLogs();
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
} from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';

import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import AppNavigator, {
  navigationRef,
} from './src/app/navigation/AppNavigator';
import NotificationService from './src/notification/NotificationService';
import { LaunchMotionGraphic } from './src/components/liquidGlass/LaunchMotionGraphic';

export default function App() {
  const [showLaunchGraphic, setShowLaunchGraphic] = useState(true);
  useEffect(() => {
    let isMounted = true;
    const navigationRefAny = navigationRef as any;
    const messagingInstance = getMessaging();
    const retryTimers: ReturnType<typeof setTimeout>[] = [];
    const recentlyOpened = new Map<string, number>();

    if (Platform.OS === 'android') {
      NotificationService.createChannel().catch(error => {
        console.log('[Notifications] Android channel creation note:', error?.code || 'unknown');
      });
    }

    const openOrder = (orderId?: string) => {
      if (!orderId || !isMounted) {
        return;
      }

      const lastOpenedAt = recentlyOpened.get(orderId) || 0;
      if (Date.now() - lastOpenedAt < 2000) return;
      recentlyOpened.set(orderId, Date.now());

      const navigateWhenReady = (attempt = 0) => {
        if (!isMounted) {
          return;
        }

        if (navigationRefAny.isReady()) {
          navigationRefAny.navigate('TrackOrderScreen', { orderId });
          return;
        }

        // Notification taps can arrive before the navigation tree mounts.
        if (attempt < 10) {
          retryTimers.push(setTimeout(() => navigateWhenReady(attempt + 1), 300));
        }
      };

      navigateWhenReady();
    };

    const openPendingOrder = async () => {
      try {
        const orderId = await AsyncStorage.getItem('pendingNotificationOrderId');
        if (!orderId || !isMounted) return;

        await AsyncStorage.removeItem('pendingNotificationOrderId');
        openOrder(orderId);
      } catch (error: any) {
        console.log('[Notifications] Pending notification read note:', error?.code || 'unknown');
      }
    };

    void openPendingOrder();
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') void openPendingOrder();
    });

    const unsubscribeMessage = onMessage(messagingInstance, async remoteMessage => {
      console.log('[FCM] Foreground message received', {
        messageId: remoteMessage?.messageId || 'unknown',
      });
      await NotificationService.displayNotification(remoteMessage);
    });

    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        const orderId = detail.notification?.data?.orderId;
        openOrder(typeof orderId === 'string' ? orderId : undefined);
      }
    });

    const unsubscribeOpened = onNotificationOpenedApp(messagingInstance, remoteMessage => {
      const orderId = remoteMessage.data?.orderId;
      openOrder(typeof orderId === 'string' ? orderId : undefined);
    });

    notifee
      .getInitialNotification()
      .then(initialNotification => {
        const orderId = initialNotification?.notification?.data?.orderId;
        openOrder(typeof orderId === 'string' ? orderId : undefined);
      })
      .catch(error => {
        console.log('Initial notification note:', error);
      });

    return () => {
      isMounted = false;
      retryTimers.forEach(clearTimeout);
      unsubscribeMessage();
      unsubscribeNotifee();
      unsubscribeOpened();
      appStateSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <AuthProvider>
          <ThemeProvider>
            <AppNavigator />
          </ThemeProvider>
        </AuthProvider>
      </NavigationContainer>
      {showLaunchGraphic && (
        <LaunchMotionGraphic onFinish={() => setShowLaunchGraphic(false)} />
      )}
    </SafeAreaProvider>
  );
}
