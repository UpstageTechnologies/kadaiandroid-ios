import React, { useEffect, useState, useRef, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  collection,
  onSnapshot,
} from '@react-native-firebase/firestore';
import { AuthContext } from '../../context/AuthContext';
import { TEXTURED_DARK, TEXTURED_LIGHT } from './theme';

export default function FloatingLiveOrderTracker({ navigationRef }) {
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const { user } = useContext(AuthContext);

  const [activeOrder, setActiveOrder] = useState(null);
  const [currentRoute, setCurrentRoute] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [language, setLanguage] = useState('en');
  const [themePreference, setThemePreference] = useState('system');

  // Animations
  const slideAnim = useRef(new Animated.Value(120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const radarScale = useRef(new Animated.Value(1)).current;
  const radarOpacity = useRef(new Animated.Value(0.85)).current;

  // 1. Sync theme and language preferences
  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem('@kadai_theme_preference')
      .then(p => {
        if (isMounted && p && ['system', 'light', 'dark'].includes(p)) {
          setThemePreference(p);
        }
      })
      .catch(() => {});

    AsyncStorage.getItem('@kadai_language')
      .then(l => {
        if (isMounted && l && ['en', 'ta'].includes(l)) {
          setLanguage(l);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const isDarkMode =
    themePreference === 'system'
      ? systemColorScheme === 'dark'
      : themePreference === 'dark';
  const theme = isDarkMode ? TEXTURED_DARK : TEXTURED_LIGHT;
  const isTamil = language === 'ta';

  // 2. Track Navigation route changes to hide on TrackOrderScreen or Auth screens
  useEffect(() => {
    if (!navigationRef) return;

    const checkRoute = () => {
      try {
        if (navigationRef.isReady && navigationRef.isReady()) {
          const route = navigationRef.getCurrentRoute();
          setCurrentRoute(route?.name || '');
        }
      } catch (e) {}
    };

    checkRoute();

    const unsubscribe = navigationRef.addListener('state', () => {
      checkRoute();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [navigationRef]);

  // 3. Load active order from AsyncStorage cache & listen to Firestore updates
  useEffect(() => {
    let isMounted = true;

    // Fast-path: Check cached last order
    AsyncStorage.getItem('@kadai_last_order')
      .then(stored => {
        if (stored && isMounted) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && (parsed.orderId || parsed.id)) {
              const s = (parsed.status || '').toLowerCase();
              if (!['delivered', 'cancelled', 'rejected'].includes(s)) {
                setActiveOrder(parsed);
              }
            }
          } catch (e) {}
        }
      })
      .catch(() => {});

    // Live subscription to Firestore orders
    if (user?.uid) {
      const db = getFirestore();
      const ordersCol = collection(db, 'customers', user.uid, 'orders');
      const unsubscribe = onSnapshot(
        ordersCol,
        snapshot => {
          if (!isMounted) return;
          const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => {
            const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tB - tA;
          });

          // Find first active order (not completed or cancelled)
          const latestActive = list.find(o => {
            const s = (o.status || '').toLowerCase();
            return !['delivered', 'cancelled', 'rejected'].includes(s);
          });

          setActiveOrder(latestActive || null);
          if (latestActive) {
            setIsMinimized(false); // Reset to full capsule on active order
          }
        },
        err => console.log('Live order tracker snapshot note:', err?.message)
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    }

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  // 4. Radar pulsing animation loop
  useEffect(() => {
    const radarLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(radarScale, {
            toValue: 2.1,
            duration: 1300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(radarOpacity, {
            toValue: 0,
            duration: 1300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(radarScale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(radarOpacity, {
            toValue: 0.85,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(350),
      ])
    );

    radarLoop.start();
    return () => radarLoop.stop();
  }, []);

  // Determine if capsule should be visible
  const isExcludedRoute = [
    'TrackOrderScreen',
    'Login',
    'RegisterPhone',
    'RegisterOtp',
    'RegisterAddress',
    'RegisterDetails',
    'Onboarding',
  ].includes(currentRoute);

  const shouldShow = Boolean(activeOrder && !isExcludedRoute);

  // 5. Entrance / Exit animation
  useEffect(() => {
    if (shouldShow) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 120,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [shouldShow]);

  if (!activeOrder || isExcludedRoute) {
    return null;
  }

  // Helper calculations
  const orderId = activeOrder.orderId || activeOrder.id || '';
  const isGlobal =
    activeOrder.marketMode === 'global' ||
    activeOrder.marketType === 'global' ||
    activeOrder.deliveryScope === 'global' ||
    activeOrder.deliveryScope === 'courier' ||
    activeOrder.isGlobalMode === true;

  const shopName =
    activeOrder.orderedShops?.[0]?.shopName ||
    activeOrder.shopName ||
    (isTamil ? 'உள்ளூர் கடை' : 'Local Express Store');

  const itemCount =
    activeOrder.orderedShops?.reduce(
      (total, shop) => total + (shop.items?.reduce((s, it) => s + (Number(it.qty) || 1), 0) || 0),
      0
    ) ||
    (Array.isArray(activeOrder.items)
      ? activeOrder.items.reduce((s, it) => s + (Number(it?.qty) || 1), 0)
      : 1);

  // Status & ETA label
  const s = (activeOrder.status || '').toLowerCase();
  let statusHeadline = '';
  if (s.includes('out') || s.includes('way') || s.includes('transit')) {
    statusHeadline = isGlobal
      ? (isTamil ? '📦 வழியில் உள்ளது' : '📦 In Transit')
      : (isTamil ? '⚡ ~14 நிமி • வழியில் உள்ளது' : '⚡ ~14 mins • On the way');
  } else if (s.includes('pack') || s.includes('ready')) {
    statusHeadline = isTamil ? '📦 பொருட்கள் பேக் செய்யப்படுகிறது' : '📦 Items Packed & Ready';
  } else if (s.includes('accept')) {
    statusHeadline = isTamil ? '👍 கடைக்காரரால் ஏற்கப்பட்டது' : '👍 Order Accepted';
  } else {
    statusHeadline = isTamil ? '🎉 ஆர்டர் பதிவு செய்யப்பட்டது' : '🎉 Order Placed';
  }

  const handleOpenTracking = () => {
    if (navigationRef && navigationRef.isReady && navigationRef.isReady()) {
      navigationRef.navigate('TrackOrderScreen', { orderId });
    }
  };

  if (isMinimized) {
    return (
      <Animated.View
        style={[
          styles.minimizedWrapper,
          {
            bottom: Math.max(insets.bottom, 12) + 12,
            transform: [{ translateY: slideAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => setIsMinimized(false)}
          style={[
            styles.minimizedBubble,
            {
              backgroundColor: isDarkMode ? '#0A150E' : '#FFFFFF',
              borderColor: theme.neonGreen,
              shadowColor: theme.neonGreen,
            },
          ]}
          accessibilityLabel="Expand live order activity"
        >
          <Animated.View
            style={[
              styles.radarRing,
              {
                borderColor: theme.neonGreen,
                transform: [{ scale: radarScale }],
                opacity: radarOpacity,
              },
            ]}
          />
          <Ionicons
            name={isGlobal ? 'bus' : 'bicycle'}
            size={18}
            color={theme.neonGreen}
          />
          <View style={[styles.minimizedBadge, { backgroundColor: theme.neonGreen }]}>
            <Text style={styles.minimizedBadgeText}>
              {s.includes('out') || s.includes('way') ? '14m' : 'LIVE'}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      pointerEvents={shouldShow ? 'auto' : 'none'}
      style={[
        styles.capsuleWrapper,
        {
          bottom: Math.max(insets.bottom, 12) + 10,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handleOpenTracking}
        style={[
          styles.capsuleCard,
          {
            backgroundColor: isDarkMode ? '#0A150E' : '#FFFFFF',
            borderColor: theme.neonGreen,
            shadowColor: theme.neonGreen,
          },
        ]}
      >
        {/* Left: Pulsing Beacon Radar & Vehicle Icon */}
        <View style={styles.radarWrapper}>
          <Animated.View
            style={[
              styles.radarRing,
              {
                borderColor: theme.neonGreen,
                transform: [{ scale: radarScale }],
                opacity: radarOpacity,
              },
            ]}
          />
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDarkMode ? '#13281B' : '#DCFCE7',
                borderColor: theme.neonGreen,
              },
            ]}
          >
            <Ionicons
              name={isGlobal ? 'bus' : 'bicycle'}
              size={17}
              color={theme.neonGreen}
            />
          </View>
        </View>

        {/* Center: Live Status & Shop Detail */}
        <View style={styles.textColumn}>
          <View style={styles.headlineRow}>
            <View style={[styles.pulsingCoreDot, { backgroundColor: theme.neonGreen }]} />
            <Text
              style={[styles.headlineText, { color: theme.textWhite }]}
              numberOfLines={1}
            >
              {statusHeadline}
            </Text>
          </View>
          <Text
            style={[styles.subText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}
            numberOfLines={1}
          >
            {shopName} • {itemCount} {isTamil ? 'பொருட்கள்' : 'items'} • #{orderId}
          </Text>
        </View>

        {/* Right: Track CTA Pill */}
        <TouchableOpacity
          style={[styles.trackPill, { backgroundColor: theme.neonGreen }]}
          onPress={handleOpenTracking}
          activeOpacity={0.8}
        >
          <Text style={styles.trackPillText}>
            {isTamil ? 'கண்காணிக்க' : 'Track'}
          </Text>
          <Ionicons name="chevron-forward" size={13} color="#050906" />
        </TouchableOpacity>

        {/* Minimize Button */}
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={() => setIsMinimized(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Minimize live tracker"
        >
          <Ionicons
            name="chevron-down"
            size={16}
            color={isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  capsuleWrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  capsuleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1.4,
    paddingVertical: 9,
    paddingLeft: 12,
    paddingRight: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 9,
  },
  radarWrapper: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radarRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pulsingCoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headlineText: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subText: {
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 2,
  },
  trackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
  },
  trackPillText: {
    color: '#050906',
    fontSize: 11.5,
    fontWeight: '800',
  },
  dismissBtn: {
    padding: 4,
    marginLeft: 4,
  },
  minimizedWrapper: {
    position: 'absolute',
    right: 14,
    zIndex: 9999,
  },
  minimizedBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  minimizedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  minimizedBadgeText: {
    color: '#050906',
    fontSize: 8.5,
    fontWeight: '900',
  },
});
