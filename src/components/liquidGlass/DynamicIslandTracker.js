import React, { useEffect, useState, useRef, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  useColorScheme,
  DeviceEventEmitter,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DynamicIslandTracker({ navigationRef }) {
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const { user } = useContext(AuthContext);

  const [activeOrder, setActiveOrder] = useState(null);
  const [currentRoute, setCurrentRoute] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [language, setLanguage] = useState('en');
  const [themePreference, setThemePreference] = useState('system');
  const [isHeaderPanelOpen, setIsHeaderPanelOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Dynamic Island Morph Animation: 0 = Compact Island Pill, 1 = Expanded Island Card
  const morphAnim = useRef(new Animated.Value(0)).current;

  // Radar Loop Animations
  const radarScale = useRef(new Animated.Value(1)).current;
  const radarOpacity = useRef(new Animated.Value(0.85)).current;
  const slideDownAnim = useRef(new Animated.Value(-80)).current;
  const islandOpacityAnim = useRef(new Animated.Value(0)).current;

  // Listen to header events so Dynamic Island seamlessly yields space when Location/Cart/Categories panel opens
  useEffect(() => {
    const panelSub = DeviceEventEmitter.addListener('KADAI_HEADER_PANEL_STATE', data => {
      setIsHeaderPanelOpen(Boolean(data?.isOpen));
    });
    const searchSub = DeviceEventEmitter.addListener('KADAI_HEADER_SEARCH_STATE', data => {
      setIsSearchOpen(Boolean(data?.isOpen));
    });

    return () => {
      panelSub.remove();
      searchSub.remove();
    };
  }, []);

  // 1. Sync theme & language preferences
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

  // 2. Track Navigation route to conceal when already on TrackOrderScreen or Auth screens
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

  // Reset expansion and morph animation whenever route changes (e.g. going to/from live tracking)
  useEffect(() => {
    setIsExpanded(false);
    morphAnim.setValue(0);
  }, [currentRoute]);

  // 3. Load active order from AsyncStorage cache & Firestore live subscription
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

          const latestActive = list.find(o => {
            const s = (o.status || '').toLowerCase();
            return !['delivered', 'cancelled', 'rejected'].includes(s);
          });

          setActiveOrder(latestActive || null);
        },
        err => console.log('Dynamic Island snapshot note:', err?.message)
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

  // 4. Looping Radar Beacon Animation
  useEffect(() => {
    const radarLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(radarScale, {
            toValue: 2.2,
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
        Animated.delay(400),
      ])
    );

    radarLoop.start();
    return () => radarLoop.stop();
  }, []);

  const isExcludedRoute = [
    'TrackOrderScreen',
    'Login',
    'RegisterPhone',
    'RegisterOtp',
    'RegisterAddress',
    'RegisterDetails',
    'Onboarding',
  ].includes(currentRoute);

  const isHomeScreen =
    !currentRoute ||
    currentRoute === 'CustomerHome' ||
    currentRoute === 'LegacyCustomerHome';

  // On HomeScreen, Live Tracking is docked right in the Header Row 2 next to Categories & Filters.
  // On all other screens (Cart, Orders, Shop, etc.), this floating Dynamic Island provides continuous tracking.
  const shouldShow = Boolean(activeOrder && !isExcludedRoute && !isHeaderPanelOpen && !isHomeScreen);

  // 5. Entrance / Exit slide animation from top
  useEffect(() => {
    if (shouldShow) {
      Animated.parallel([
        Animated.spring(slideDownAnim, {
          toValue: 0,
          tension: 70,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(islandOpacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideDownAnim, {
          toValue: -80,
          duration: 180,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(islandOpacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [shouldShow]);

  // 6. Dynamic Island Morphing: Compact <-> Expanded
  const toggleExpand = () => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    Animated.spring(morphAnim, {
      toValue,
      tension: 65,
      friction: 8,
      useNativeDriver: false,
    }).start();
  };

  const collapseIsland = () => {
    setIsExpanded(false);
    Animated.spring(morphAnim, {
      toValue: 0,
      tension: 75,
      friction: 8,
      useNativeDriver: false,
    }).start();
  };

  if (!activeOrder) {
    return null;
  }

  // Order Details Calculations
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

  const s = (activeOrder.status || '').toLowerCase();
  let statusBadgeText = '';
  let etaCountdownText = '';
  let stepIndex = 0;

  if (s.includes('deliver')) {
    statusBadgeText = isTamil ? 'டெலிவரி செய்யப்பட்டது' : 'Delivered';
    etaCountdownText = isTamil ? '✨ வந்து சேர்ந்தது' : '✨ Arrived';
    stepIndex = 3;
  } else if (s.includes('out') || s.includes('way') || s.includes('transit')) {
    statusBadgeText = isTamil ? 'வழியில் உள்ளது' : 'On the way';
    etaCountdownText = isGlobal
      ? (isTamil ? '📦 கூரியர் பயணத்தில்' : '📦 In Transit')
      : (isTamil ? '⚡ ~14 நிமி' : '⚡ ~14 mins');
    stepIndex = 2;
  } else if (s.includes('pack') || s.includes('ready')) {
    statusBadgeText = isTamil ? 'பொருட்கள் தயார்' : 'Packing Items';
    etaCountdownText = isTamil ? '📦 பேக் செய்யப்படுகிறது' : '📦 Store Packing';
    stepIndex = 1;
  } else {
    statusBadgeText = isTamil ? 'பதிவானது' : 'Order Placed';
    etaCountdownText = isTamil ? '🎉 ஆர்டர் தயார்' : '🎉 Store Preparing';
    stepIndex = 0;
  }

  const handleOpenTracking = () => {
    setIsExpanded(false);
    morphAnim.setValue(0);
    if (navigationRef && navigationRef.isReady && navigationRef.isReady()) {
      navigationRef.navigate('TrackOrderScreen', { orderId });
    }
  };

  // Interpolated Styles for Dynamic Morphing
  const islandWidth = morphAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [225, SCREEN_WIDTH - 24],
  });

  const islandHeight = morphAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 150],
  });

  const islandBorderRadius = morphAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [22, 26],
  });

  const compactOpacity = morphAnim.interpolate({
    inputRange: [0, 0.25],
    outputRange: [1, 0],
  });

  const expandedOpacity = morphAnim.interpolate({
    inputRange: [0.4, 1],
    outputRange: [0, 1],
  });

  // Floating Sub-Header Dock:
  // On stack screens, header is ~52px, so +58 leaves stack headers completely unobstructed.
  const baseTop = Math.max(insets.top, 10) + 58;

  const islandTop = baseTop + (isSearchOpen ? 46 : 0);

  return (
    <Animated.View
      pointerEvents={shouldShow ? 'auto' : 'none'}
      style={[
        styles.islandContainer,
        {
          top: islandTop,
          transform: [{ translateY: slideDownAnim }],
          opacity: islandOpacityAnim,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.islandBody,
          {
            width: islandWidth,
            height: islandHeight,
            borderRadius: islandBorderRadius,
            backgroundColor: isDarkMode ? '#050B07' : '#FFFFFF',
            borderColor: theme.neonGreen,
            shadowColor: theme.neonGreen,
          },
        ]}
      >
        {/* ================= COMPACT ISLAND STATE ================= */}
        <Animated.View
          pointerEvents={isExpanded ? 'none' : 'auto'}
          style={[
            styles.compactContentRow,
            {
              opacity: compactOpacity,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.compactTouchable}
            activeOpacity={0.88}
            onPress={toggleExpand}
          >
            {/* Left: Pulsing Radar Beacon + Vehicle Icon */}
            <View style={styles.compactLeftRadar}>
              <Animated.View
                style={[
                  styles.compactRadarRing,
                  {
                    borderColor: theme.neonGreen,
                    transform: [{ scale: radarScale }],
                    opacity: radarOpacity,
                  },
                ]}
              />
              <View
                style={[
                  styles.compactIconCircle,
                  {
                    backgroundColor: isDarkMode ? '#0F2618' : '#DCFCE7',
                    borderColor: theme.neonGreen,
                  },
                ]}
              >
                <Ionicons
                  name={isGlobal ? 'bus' : 'bicycle'}
                  size={14}
                  color={theme.neonGreen}
                />
              </View>
            </View>

            {/* Center: Live ETA Ticker */}
            <View style={styles.compactCenterTextWrap}>
              <Text
                style={[styles.compactEtaText, { color: theme.textWhite }]}
                numberOfLines={1}
              >
                {etaCountdownText} • {statusBadgeText}
              </Text>
            </View>

            {/* Right: Expand Chevron Pill */}
            <View style={[styles.compactExpandPill, { backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.18)' : '#DCFCE7' }]}>
              <Ionicons name="chevron-down" size={13} color={theme.neonGreen} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ================= EXPANDED ISLAND STATE ================= */}
        <Animated.View
          pointerEvents={isExpanded ? 'auto' : 'none'}
          style={[
            styles.expandedContentWrap,
            {
              opacity: expandedOpacity,
            },
          ]}
        >
          {/* Top Row: Header Badge & Collapse Button */}
          <View style={styles.expandedHeaderRow}>
            <View style={styles.expandedBadgeWrap}>
              <View style={[styles.pulsingCoreDot, { backgroundColor: theme.neonGreen }]} />
              <Text style={[styles.expandedBadgeText, { color: theme.neonGreen }]}>
                {isTamil ? 'நேரலை ஆர்டர் கண்காணிப்பு' : 'LIVE ORDER TRACKING'} • #{orderId}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.collapseBtn}
              onPress={collapseIsland}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-up" size={18} color={theme.neonGreen} />
            </TouchableOpacity>
          </View>

          {/* Middle Row: Large ETA Headline & Store Subtext */}
          <View style={styles.expandedHeroRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.expandedEtaHeadline, { color: theme.textWhite }]} numberOfLines={1}>
                {etaCountdownText} • {statusBadgeText}
              </Text>
              <Text style={[styles.expandedStoreSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                {shopName} • {itemCount} {isTamil ? 'பொருட்கள்' : 'items'}
              </Text>
            </View>

            {/* 1-Tap Track Live CTA */}
            <TouchableOpacity
              style={[styles.expandedTrackBtn, { backgroundColor: theme.neonGreen }]}
              onPress={handleOpenTracking}
              activeOpacity={0.82}
            >
              <Text style={styles.expandedTrackBtnText}>
                {isTamil ? 'வரைபடம்' : 'Track Live'}
              </Text>
              <Ionicons name="navigate" size={12} color="#050906" />
            </TouchableOpacity>
          </View>

          {/* Bottom Stepper Progress Bar */}
          <View style={styles.expandedStepperRow}>
            {[
              { label: isTamil ? 'பதிவானது' : 'Placed' },
              { label: isTamil ? 'தயாரானது' : 'Packed' },
              { label: isTamil ? 'வழியில்' : 'On the way' },
              { label: isTamil ? 'சேர்ந்தது' : 'Delivered' },
            ].map((step, idx) => {
              const isDone = idx <= stepIndex;
              const isCurrent = idx === stepIndex;
              return (
                <React.Fragment key={step.label}>
                  <View style={styles.stepNode}>
                    <View
                      style={[
                        styles.stepDot,
                        {
                          backgroundColor: isDone ? theme.neonGreen : isDarkMode ? '#1E2D22' : '#E2E8F0',
                          borderColor: isDone ? theme.neonGreen : isDarkMode ? '#2B4031' : '#CBD5E1',
                        },
                      ]}
                    >
                      {isDone && <Ionicons name="checkmark" size={8} color="#050906" />}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        {
                          color: isCurrent
                            ? theme.neonGreen
                            : isDone
                            ? theme.textWhite
                            : isDarkMode
                            ? '#64748B'
                            : '#94A3B8',
                          fontWeight: isCurrent ? '800' : '500',
                        },
                      ]}
                    >
                      {step.label}
                    </Text>
                  </View>
                  {idx < 3 && (
                    <View
                      style={[
                        styles.stepLine,
                        {
                          backgroundColor:
                            idx < stepIndex
                              ? theme.neonGreen
                              : isDarkMode
                              ? '#1A291E'
                              : '#E2E8F0',
                        },
                      ]}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  islandContainer: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 99999,
  },
  islandBody: {
    overflow: 'hidden',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 12,
  },
  /* Compact Island Styling */
  compactContentRow: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: '100%',
  },
  compactLeftRadar: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactRadarRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.2,
  },
  compactIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactCenterTextWrap: {
    flex: 1,
    paddingHorizontal: 8,
  },
  compactEtaText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  compactExpandPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Expanded Island Styling */
  expandedContentWrap: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  expandedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expandedBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulsingCoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  expandedBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  collapseBtn: {
    padding: 3,
  },
  expandedHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  expandedEtaHeadline: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  expandedStoreSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  expandedTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  expandedTrackBtnText: {
    color: '#050906',
    fontSize: 12,
    fontWeight: '800',
  },
  expandedStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepNode: {
    alignItems: 'center',
    gap: 2,
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 9.5,
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginBottom: 12,
    marginHorizontal: -2,
  },
});
