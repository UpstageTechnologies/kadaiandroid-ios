import React, { useEffect, useState, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
  Animated,
  Easing,
  Share,
  useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  doc,
  getFirestore,
  onSnapshot,
  getDoc,
} from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { AuthContext } from '../../context/AuthContext';
import { TEXTURED_DARK, TEXTURED_LIGHT } from '../../components/liquidGlass/theme';
import { triggerHaptic } from '../../components/liquidGlass/safeHaptics';

export default function TrackOrderScreen({ route, navigation }) {
  const db = getFirestore();
  const { user } = useContext(AuthContext);
  const rawOrderId = route?.params?.orderId || route?.params?.order;
  const initialOrderId =
    typeof rawOrderId === 'object' && rawOrderId !== null
      ? String(rawOrderId?.orderId || rawOrderId?.id || '')
      : (rawOrderId ? String(rawOrderId) : '');
  const [activeOrderId, setActiveOrderId] = useState(initialOrderId);
  const routeOrderId = initialOrderId;
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();

  // Local state - instant pre-hydration if order object was passed in route params
  const passedOrder =
    typeof rawOrderId === 'object' && rawOrderId !== null
      ? rawOrderId
      : (route?.params?.order && typeof route?.params?.order === 'object' ? route?.params?.order : null);

  const [orderData, setOrderData] = useState(passedOrder);
  const [loading, setLoading] = useState(!passedOrder || !passedOrder.status);
  const [language, setLanguage] = useState('en');
  const [themePreference, setThemePreference] = useState('dark');
  const [, setTimerTick] = useState(0);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const radarScaleAnim = useRef(new Animated.Value(1)).current;
  const radarOpacityAnim = useRef(new Animated.Value(0.85)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Mount Transition & Radar Beacon Loop
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 420,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
    ]).start();

    const radarLoop = Animated.loop(
      Animated.parallel([
        Animated.timing(radarScaleAnim, {
          toValue: 1.85,
          duration: 1800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(radarOpacityAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    radarLoop.start();

    return () => radarLoop.stop();
  }, [fadeAnim, slideAnim, radarScaleAnim, radarOpacityAnim]);

  // Periodic 15s timer tick for live delivery countdown accuracy
  useEffect(() => {
    const timer = setInterval(() => {
      setTimerTick(t => t + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Load language & theme preference
  useEffect(() => {
    AsyncStorage.getItem('@kadai_theme_preference').then(pref => {
      if (pref && ['system', 'light', 'dark'].includes(pref)) {
        setThemePreference(pref);
      }
    }).catch(() => {});

    AsyncStorage.getItem('@kadai_app_language').then(lang => {
      if (lang && ['en', 'ta'].includes(lang)) {
        setLanguage(lang);
      }
    }).catch(() => {});
  }, []);

  const isDarkMode =
    themePreference === 'system'
      ? systemColorScheme === 'dark'
      : themePreference === 'dark';
  const isTamil = language === 'ta';
  const theme = isDarkMode ? TEXTURED_DARK : TEXTURED_LIGHT;

  // Real-time Firestore Listener with instant cache pre-hydration & fallback
  useEffect(() => {
    let isMounted = true;
    let unsubUserOrder = null;

    const resolveAndListen = async () => {
      let targetId = activeOrderId || routeOrderId;

      // 1. If no ID provided via route params, recover from last order cache
      if (!targetId) {
        try {
          const cachedStr = await AsyncStorage.getItem('@kadai_last_order');
          if (cachedStr) {
            const cached = JSON.parse(cachedStr);
            if (cached && (cached.orderId || cached.id)) {
              targetId = cached.orderId || cached.id;
              if (isMounted) {
                setActiveOrderId(targetId);
                setOrderData(cached);
                setLoading(false);
              }
            }
          }
        } catch (e) {}
      } else {
        // ID is present: pre-fill from cache immediately if matches, preventing blank loading spinner
        try {
          const cachedStr = await AsyncStorage.getItem('@kadai_last_order');
          if (cachedStr) {
            const cached = JSON.parse(cachedStr);
            if (cached && (cached.orderId === targetId || cached.id === targetId)) {
              if (isMounted) {
                setOrderData(cached);
                setLoading(false);
              }
            }
          }
        } catch (e) {}
      }

      // If still no ID found anywhere, check order history
      if (!targetId) {
        try {
          const historyStr = await AsyncStorage.getItem('@kadai_orders_history');
          if (historyStr) {
            const history = JSON.parse(historyStr);
            if (Array.isArray(history) && history.length > 0) {
              const latest = history[0];
              targetId = latest.orderId || latest.id;
              if (isMounted) {
                setActiveOrderId(targetId);
                setOrderData(latest);
                setLoading(false);
              }
            }
          }
        } catch (e) {}
      }

      if (!targetId) {
        if (isMounted) setLoading(false);
        return;
      }

      // Helper function to check root /orders and local storage
      const checkRootAndCache = async id => {
        try {
          const rootOrderRef = doc(db, 'orders', id);
          const rootSnap = await getDoc(rootOrderRef);
          if (rootSnap.exists() && isMounted) {
            setOrderData(rootSnap.data());
            setLoading(false);
            return;
          }
        } catch (rootErr) {
          console.log('Root order check note:', rootErr?.message);
        }

        try {
          const cachedStr = await AsyncStorage.getItem('@kadai_last_order');
          if (cachedStr && isMounted) {
            const parsed = JSON.parse(cachedStr);
            if (parsed && (parsed.orderId === id || parsed.id === id)) {
              setOrderData(parsed);
              setLoading(false);
              return;
            }
          }
        } catch (cacheErr) {}

        if (isMounted) setLoading(false);
      };

      // 2. Attach live snapshot listener
      if (user?.uid) {
        const userOrderRef = doc(db, 'customers', user.uid, 'orders', targetId);
        unsubUserOrder = onSnapshot(
          userOrderRef,
          snapshot => {
            if (!isMounted) return;
            if (snapshot.exists()) {
              setOrderData(snapshot.data());
              setLoading(false);
            } else {
              checkRootAndCache(targetId);
            }
          },
          error => {
            console.log('Customer Order Snapshot note:', error?.message);
            checkRootAndCache(targetId);
          }
        );
      } else {
        checkRootAndCache(targetId);
      }
    };

    resolveAndListen();

    return () => {
      isMounted = false;
      if (unsubUserOrder) unsubUserOrder();
    };
  }, [db, user, activeOrderId, routeOrderId]);

  // Status order & overall progress calculation
  const statusOrder = ['Order Placed', 'Accepted', 'Packed', 'Out For Delivery', 'Delivered'];

  const getOverallProgressRatio = status => {
    const s = (status || '').toLowerCase();
    if (s.includes('deliver')) return 1.0;
    if (s.includes('out') || s.includes('way') || s.includes('transit')) return 0.8;
    if (s.includes('pack')) return 0.55;
    if (s.includes('accept')) return 0.35;
    return 0.15; // Placed
  };

  useEffect(() => {
    if (orderData?.status) {
      const targetRatio = getOverallProgressRatio(orderData.status);
      Animated.timing(progressAnim, {
        toValue: targetRatio,
        duration: 600,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }).start();
    }
  }, [orderData?.status, progressAnim]);

  // Delivery countdown & estimated ETA calculation
  const getDeliveryCountdown = order => {
    if (!order) return { text: '', mins: 0, statusLabel: '' };
    const s = (order.status || '').toLowerCase();
    if (s.includes('deliver')) {
      return {
        text: isTamil ? '✨ டெலிவரி செய்யப்பட்டது' : '✨ Delivered Successfully',
        mins: 0,
        statusLabel: isTamil ? 'ஆர்டர் வந்து சேர்ந்தது' : 'Package Delivered',
        badgeColor: '#16A34A',
        isDelivered: true,
      };
    }
    if (s.includes('reject') || s.includes('cancel')) {
      return {
        text: isTamil ? '❌ ஆர்டர் ரத்து செய்யப்பட்டது' : '❌ Order Cancelled',
        mins: 0,
        statusLabel: isTamil ? 'ரத்து செய்யப்பட்டது' : 'Cancelled',
        badgeColor: '#EF4444',
        isCancelled: true,
      };
    }

    const createdTime = order.createdAt ? new Date(order.createdAt).getTime() : Date.now();
    const elapsedMins = Math.max(0, Math.floor((Date.now() - createdTime) / 60000));
    const baseTarget = (order.deliveryScope === 'global' || order.marketType === 'global') ? 45 : 20;

    let remaining = Math.max(2, baseTarget - elapsedMins);
    if (s.includes('out') || s.includes('way') || s.includes('transit')) {
      remaining = Math.min(remaining, 6);
    } else if (s.includes('pack') || s.includes('ready')) {
      remaining = Math.min(remaining, 12);
    } else if (s.includes('accept')) {
      remaining = Math.min(remaining, 16);
    }

    // Expected ETA window formatted string
    const etaDate = new Date(createdTime + baseTarget * 60000);
    const etaTimeString = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      mins: remaining,
      text: isTamil
        ? `⚡ ~${remaining} நிமிடம் மீதமுள்ளது`
        : `⚡ ~${remaining} mins left for delivery`,
      etaWindow: `${etaTimeString}`,
      statusLabel: s.includes('out')
        ? (isTamil ? 'டெலிவரிக்கு புறப்பட்டது' : 'Out for Express Delivery')
        : s.includes('pack')
        ? (isTamil ? 'பொருட்கள் பேக் செய்யப்பட்டது' : 'Items Packed & Ready')
        : s.includes('accept')
        ? (isTamil ? 'கடைக்காரரால் ஏற்கப்பட்டது' : 'Order Accepted by Store')
        : (isTamil ? 'ஆர்டர் பதிவு செய்யப்பட்டது' : 'Order Placed & Dispatched'),
      badgeColor: '#22C55E',
    };
  };

  // Timeline steps for individual shops
  const getShopTimelineSteps = (shop, mainOrder) => {
    const currentStatus = shop.status || mainOrder.status || 'Order Placed';
    const lastStatus = shop.lastStatus || mainOrder.lastStatus || '';

    const hasPendingMsg =
      (shop.status === 'Pending' || mainOrder.status === 'Pending') &&
      ((shop.pendingMessage && shop.pendingMessage.trim() !== '') ||
        (mainOrder.pendingMessage && mainOrder.pendingMessage.trim() !== ''));

    const baseSteps = [
      {
        key: 'Order Placed',
        title: isTamil ? 'ஆர்டர் பெறப்பட்டது' : 'Order Placed',
        desc: isTamil ? 'கடை உங்கள் ஆர்டரைப் பெற்றது' : 'Shop received your order request',
        icon: 'receipt-outline',
      },
      {
        key: 'Accepted',
        title: isTamil ? 'ஏற்கப்பட்டது' : 'Order Accepted',
        desc: isTamil ? 'கடைக்காரர் ஆர்டரை உறுதி செய்தார்' : 'Shop confirmed and accepted your order',
        icon: 'thumbs-up-outline',
      },
      {
        key: 'Packed',
        title: isTamil ? 'பேக் செய்யப்பட்டது' : 'Packed & Ready',
        desc: isTamil ? 'பொருட்கள் தயாராக வைக்கப்பட்டுள்ளன' : 'Items packed securely and ready for pickup',
        icon: 'cube-outline',
      },
      {
        key: 'Out For Delivery',
        title: isTamil ? 'டெலிவரிக்கு புறப்பட்டது' : 'Out For Delivery',
        desc: isTamil ? 'டெலிவரி பார்ட்னர் புறப்பட்டுவிட்டார்' : 'Delivery partner picked package from shop',
        icon: 'bicycle-outline',
      },
      {
        key: 'Delivered',
        title: isTamil ? 'டெலிவரி முடிந்தது' : 'Package Delivered',
        desc: isTamil ? 'ஆர்டர் உங்களிடம் வெற்றிகரமாக சேர்ந்தது' : 'Order delivered successfully to your doorstep',
        icon: 'checkmark-circle-outline',
      },
    ];

    const effectiveActiveStatus = currentStatus === 'Pending' ? lastStatus : currentStatus;
    let activeIndex = statusOrder.indexOf(effectiveActiveStatus);
    if (activeIndex === -1) activeIndex = 0;

    const lastActiveIndex = statusOrder.indexOf(lastStatus);

    let delayTargetIndex = -1;
    if (hasPendingMsg) {
      if (lastActiveIndex !== -1) {
        delayTargetIndex = lastActiveIndex + 1;
      } else {
        delayTargetIndex = activeIndex + 1;
      }
      if (delayTargetIndex >= statusOrder.length) delayTargetIndex = statusOrder.length - 1;
    }

    return baseSteps.map((step, index) => {
      let done = false;
      let current = false;
      const showPendingDelay = hasPendingMsg && index === delayTargetIndex;

      if (hasPendingMsg) {
        if (lastActiveIndex !== -1) {
          done = index <= lastActiveIndex;
        } else {
          done = index <= activeIndex;
        }
        current = false;
      } else {
        done = index <= activeIndex;
        current = effectiveActiveStatus === step.key;
      }

      return {
        ...step,
        done,
        current,
        showPendingDelay,
      };
    });
  };

  const formatDateTime = isoString => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return `${date.toLocaleDateString()} • ${date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch (e) {
      return isoString;
    }
  };

  const handleCopyOrderId = () => {
    const idToCopy = orderData?.orderId || orderData?.id || activeOrderId || routeOrderId;
    Toast.show({
      type: 'success',
      text1: isTamil ? 'ஆர்டர் எண் நகலெடுக்கப்பட்டது!' : 'Order ID Copied!',
      text2: `#${idToCopy}`,
      position: 'top',
      visibilityTime: 2200,
    });
  };

  const handleShareJourney = async () => {
    const idToShare = orderData?.orderId || orderData?.id || activeOrderId || routeOrderId;
    try {
      await Share.share({
        title: `Kadai App Order #${idToShare}`,
        message: `🚚 Track my Kadai live delivery #${idToShare}: Status is "${
          orderData?.status || 'Active'
        }". Delivered within ~15-20 mins!`,
      });
    } catch (err) {
      console.log('Share error:', err);
    }
  };

  // Loading State
  if (loading) {
    return (
      <View
        style={[
          styles.centerContainer,
          { backgroundColor: isDarkMode ? '#080E0A' : '#F8FAFC' },
        ]}
      >
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={isDarkMode ? '#080E0A' : '#F8FAFC'}
        />
        <View style={styles.radarWrapper}>
          <Animated.View
            style={[
              styles.radarRing,
              {
                borderColor: theme.neonGreen,
                transform: [{ scale: radarScaleAnim }],
                opacity: radarOpacityAnim,
              },
            ]}
          />
          <View
            style={[
              styles.radarCore,
              { backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF', borderColor: theme.neonGreen },
            ]}
          >
            <ActivityIndicator size="small" color={theme.neonGreen} />
          </View>
        </View>
        <Text style={[styles.loadingTitle, { color: theme.textWhite }]}>
          {isTamil ? 'நேரலை ஜி.பி.எஸ் ரேடார் இணைகிறது...' : 'Connecting to Live Delivery Radar...'}
        </Text>
        <Text style={[styles.loadingSubtitle, { color: theme.textMuted }]}>
          #{String(activeOrderId || routeOrderId || 'Live Order')}
        </Text>
      </View>
    );
  }

  // Not Found State
  if (!orderData) {
    return (
      <View
        style={[
          styles.centerContainer,
          { backgroundColor: isDarkMode ? '#080E0A' : '#F8FAFC' },
        ]}
      >
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={isDarkMode ? '#080E0A' : '#F8FAFC'}
        />
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
              borderColor: theme.glassBorder,
            },
          ]}
        >
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={[styles.emptyCardTitle, { color: theme.textWhite }]}>
            {isTamil ? 'ஆர்டர் தகவல்கள் கிடைக்கவில்லை' : 'Order Journey Not Found'}
          </Text>
          <Text style={[styles.emptyCardDesc, { color: theme.textMuted }]}>
            {isTamil
              ? `ஆர்டர் #${String(activeOrderId || routeOrderId || '')} கணக்கில் கண்டறியப்படவில்லை.`
              : `Order #${String(activeOrderId || routeOrderId || '')} was not found or was completed.`}
          </Text>
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: theme.neonGreen }]}
            onPress={() => {
              navigation.navigate('CustomerHome');
            }}
          >
            <Ionicons name="home-outline" size={18} color="#050906" />
            <Text style={styles.primaryActionBtnText}>
              {isTamil ? 'முகப்புக்குச் செல்' : 'Back to Home'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const deliveryInfo = getDeliveryCountdown(orderData);
  const shopsList = orderData.orderedShops && orderData.orderedShops.length > 0
    ? orderData.orderedShops
    : [orderData];

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[
        styles.safeArea,
        { backgroundColor: isDarkMode ? '#080E0A' : '#F8FAFC' },
      ]}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#080E0A' : '#F8FAFC'}
      />

      {/* 1. TOP LIQUID GLASS NAVIGATION BAR */}
      <View
        style={[
          styles.topHeaderBar,
          {
            backgroundColor: isDarkMode ? 'rgba(8, 14, 10, 0.92)' : 'rgba(248, 250, 252, 0.95)',
            borderBottomColor: theme.glassBorderSubtle,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.headerCircleBtn,
            {
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
              borderColor: theme.glassBorder,
            },
          ]}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('CustomerHome');
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={theme.textWhite} />
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={[styles.headerMainTitle, { color: theme.textWhite }]}>
            {isTamil ? 'நேரலை ஆர்டர் பயணம்' : 'Live Order Journey'}
          </Text>
          <View style={styles.liveRadarPulseRow}>
            <View style={[styles.livePulseBeaconDot, { backgroundColor: theme.neonGreen }]} />
            <Text style={[styles.liveRadarPulseText, { color: theme.neonGreen }]}>
              {isTamil ? 'நேரலை ஜி.பி.எஸ் கண்காணிப்பு' : 'Live Express Tracking'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[
              styles.orderIdPillBtn,
              {
                backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.12)' : 'rgba(22, 163, 74, 0.08)',
                borderColor: theme.glassBorder,
              },
            ]}
            onPress={handleCopyOrderId}
            activeOpacity={0.7}
          >
            <Text style={[styles.orderIdPillText, { color: theme.neonGreen }]}>
              #{String(orderData?.orderId || orderData?.id || activeOrderId || routeOrderId || '')}
            </Text>
            <Ionicons name="copy-outline" size={13} color={theme.neonGreen} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerCircleBtn,
              {
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                borderColor: theme.glassBorder,
              },
            ]}
            onPress={handleShareJourney}
            activeOpacity={0.7}
          >
            <Ionicons name="share-social-outline" size={18} color={theme.textWhite} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. MAIN SCROLLABLE JOURNEY CONTENT */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        {/* HERO CARD: LIVE ETA COUNTDOWN & RADAR */}
        <View
          style={[
            styles.heroDeliveryCard,
            {
              backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
              borderColor: theme.glassBorder,
            },
          ]}
        >
          {/* Top Row: Radar Beacon & Time Left */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroRadarContainer}>
              <Animated.View
                style={[
                  styles.heroRadarPulseRing,
                  {
                    borderColor: theme.neonGreen,
                    transform: [{ scale: radarScaleAnim }],
                    opacity: radarOpacityAnim,
                  },
                ]}
              />
              <View
                style={[
                  styles.heroRadarCenterBadge,
                  { backgroundColor: isDarkMode ? '#16281C' : '#DCFCE7' },
                ]}
              >
                <Ionicons
                  name={deliveryInfo.isDelivered ? 'checkmark-circle' : 'bicycle'}
                  size={24}
                  color={theme.neonGreen}
                />
              </View>
            </View>

            <View style={styles.heroTimeLeftCol}>
              <View
                style={[
                  styles.heroTimeBadge,
                  {
                    backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.16)' : 'rgba(22, 163, 74, 0.12)',
                    borderColor: theme.neonGreen,
                  },
                ]}
              >
                <Ionicons name="flash" size={14} color={theme.neonGreen} />
                <Text style={[styles.heroTimeBadgeText, { color: theme.neonGreen }]}>
                  {deliveryInfo.text}
                </Text>
              </View>

              <Text style={[styles.heroStatusHeading, { color: theme.textWhite }]}>
                {deliveryInfo.statusLabel}
              </Text>

              {orderData.createdAt ? (
                <Text style={[styles.heroOrderTimeSub, { color: theme.textMuted }]}>
                  {isTamil ? 'பதிவு செய்யப்பட்ட நேரம்: ' : 'Ordered: '}
                  {formatDateTime(orderData.createdAt)}
                  {deliveryInfo.etaWindow ? ` • Est: ${deliveryInfo.etaWindow}` : ''}
                </Text>
              ) : null}
            </View>
          </View>

          {/* 5-STAGE SEGMENTED PROGRESS BAR */}
          <View style={styles.segmentedProgressWrapper}>
            <View
              style={[
                styles.progressTrackBackground,
                { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' },
              ]}
            >
              <Animated.View
                style={[
                  styles.progressTrackFill,
                  {
                    backgroundColor: theme.neonGreen,
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>

            {/* Stepper Node Icons */}
            <View style={styles.progressNodesRow}>
              {[
                { key: 'Order Placed', icon: 'receipt-outline', label: isTamil ? 'பதிவானது' : 'Placed' },
                { key: 'Accepted', icon: 'thumbs-up-outline', label: isTamil ? 'ஏற்கப்பட்டது' : 'Accepted' },
                { key: 'Packed', icon: 'cube-outline', label: isTamil ? 'பேக்' : 'Packed' },
                { key: 'Out For Delivery', icon: 'bicycle-outline', label: isTamil ? 'வழியில்' : 'On the Way' },
                { key: 'Delivered', icon: 'checkmark-circle-outline', label: isTamil ? 'சேர்ந்தது' : 'Delivered' },
              ].map((stepItem, idx) => {
                const currentStatus = orderData.status || 'Order Placed';
                const currentIdx = statusOrder.indexOf(currentStatus);
                const isDone = idx <= currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <View key={stepItem.key} style={styles.progressNodeItem}>
                    <View
                      style={[
                        styles.progressNodeCircle,
                        {
                          backgroundColor: isCurrent
                            ? theme.neonGreen
                            : isDone
                            ? isDarkMode
                              ? '#1C3324'
                              : '#DCFCE7'
                            : isDarkMode
                            ? '#111D15'
                            : '#F1F5F9',
                          borderColor: isDone ? theme.neonGreen : isDarkMode ? '#223828' : '#CBD5E1',
                        },
                      ]}
                    >
                      <Ionicons
                        name={stepItem.icon}
                        size={13}
                        color={isCurrent ? '#050906' : isDone ? theme.neonGreen : isDarkMode ? '#64748B' : '#94A3B8'}
                      />
                    </View>
                    <Text
                      style={[
                        styles.progressNodeLabel,
                        {
                          color: isCurrent
                            ? theme.neonGreen
                            : isDone
                            ? theme.textWhite
                            : isDarkMode
                            ? '#64748B'
                            : '#94A3B8',
                          fontWeight: isCurrent ? '800' : '600',
                        },
                      ]}
                    >
                      {stepItem.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* SECTION: STORE-SPECIFIC TIMELINE JOURNEY */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.textWhite }]}>
            {isTamil ? 'கடைகள் & ஆர்டர் முன்னேற்றம்' : 'Store Timelines & Progress'}
          </Text>
          <View style={[styles.counterBadge, { backgroundColor: isDarkMode ? '#132018' : '#E2E8F0' }]}>
            <Text style={[styles.counterBadgeText, { color: theme.neonGreen }]}>
              {shopsList.length} {shopsList.length === 1 ? 'Store' : 'Stores'}
            </Text>
          </View>
        </View>

        {shopsList.map((shop, sIdx) => {
          const shopCurrentStatus = shop.status || orderData.status || 'Order Placed';
          const shopSteps = getShopTimelineSteps(shop, orderData);
          const isPending = shopCurrentStatus === 'Pending';
          const isRejected = shopCurrentStatus === 'Rejected';

          return (
            <View
              key={shop.shopId || sIdx}
              style={[
                styles.shopJourneyCard,
                {
                  backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              {/* Store Identity Header */}
              <View style={[styles.shopCardHeader, { borderBottomColor: theme.glassBorderSubtle }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <View
                    style={[
                      styles.storeIconBox,
                      { backgroundColor: isDarkMode ? '#16281C' : '#F0FDF4' },
                    ]}
                  >
                    <Ionicons name="storefront-outline" size={16} color={theme.neonGreen} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.shopNameTitle, { color: theme.textWhite }]} numberOfLines={1}>
                      {shop.shopName || 'Upstage Express Store'}
                    </Text>
                    <Text style={[styles.shopDeliveryScopeText, { color: theme.textMuted }]}>
                      {shop.marketType === 'global'
                        ? (isTamil ? 'அகில இந்தியா கூரியர்' : 'Pan-India Express')
                        : (isTamil ? 'உள்ளூர் விரைவு டெலிவரி (< 3 km)' : 'Local Hyperlocal (15-20 mins)')}
                    </Text>
                  </View>
                </View>

                {/* Status Pill */}
                <View
                  style={[
                    styles.shopStatusPill,
                    {
                      backgroundColor: isRejected
                        ? 'rgba(239, 68, 68, 0.15)'
                        : isPending
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(34, 197, 94, 0.15)',
                      borderColor: isRejected ? '#EF4444' : isPending ? '#F59E0B' : theme.neonGreen,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.shopStatusPillText,
                      { color: isRejected ? '#EF4444' : isPending ? '#F59E0B' : theme.neonGreen },
                    ]}
                  >
                    {isPending ? 'Delayed' : shopCurrentStatus}
                  </Text>
                </View>
              </View>

              {/* Rejected Banner if Store Rejected */}
              {isRejected ? (
                <View style={styles.rejectedAlertBox}>
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                  <Text style={styles.rejectedAlertText}>
                    {isTamil
                      ? 'இந்த கடை உங்கள் ஆர்டரை ரத்து செய்துள்ளது.'
                      : 'This store has cancelled or rejected your order requirement.'}
                  </Text>
                </View>
              ) : (
                /* Dynamic Vertical Timeline */
                <View style={styles.timelineVerticalBox}>
                  {shopSteps.map((step, stepIdx) => (
                    <View key={step.key}>
                      <View style={styles.timelineRow}>
                        {/* Left column: Node & Vertical Line */}
                        <View style={styles.timelineColLeft}>
                          <View
                            style={[
                              styles.timelineStepDot,
                              step.done && {
                                backgroundColor: theme.neonGreen,
                                borderColor: theme.neonGreen,
                              },
                              step.current && [
                                styles.timelineStepDotCurrent,
                                { borderColor: theme.neonGreen },
                              ],
                              step.showPendingDelay && {
                                borderColor: '#F59E0B',
                                backgroundColor: '#F59E0B',
                              },
                            ]}
                          >
                            {step.done && !step.current && !step.showPendingDelay ? (
                              <Ionicons name="checkmark" size={11} color="#050906" />
                            ) : step.current ? (
                              <View
                                style={[
                                  styles.timelineCurrentCore,
                                  { backgroundColor: theme.neonGreen },
                                ]}
                              />
                            ) : null}
                          </View>

                          {stepIdx < shopSteps.length - 1 && (
                            <View
                              style={[
                                styles.timelineVerticalLine,
                                {
                                  backgroundColor: step.done
                                    ? theme.neonGreen
                                    : isDarkMode
                                    ? '#223828'
                                    : '#E2E8F0',
                                },
                              ]}
                            />
                          )}
                        </View>

                        {/* Right column: Title, Desc, and Timing */}
                        <View style={styles.timelineColRight}>
                          <Text
                            style={[
                              styles.timelineStepTitle,
                              {
                                color: step.current
                                  ? theme.neonGreen
                                  : step.done
                                  ? theme.textWhite
                                  : isDarkMode
                                  ? '#64748B'
                                  : '#94A3B8',
                                fontWeight: step.current ? '800' : '600',
                              },
                            ]}
                          >
                            {step.title}
                          </Text>
                          <Text style={[styles.timelineStepDesc, { color: theme.textMuted }]}>
                            {step.desc}
                          </Text>
                        </View>
                      </View>

                      {/* Store Delay Alert Card (Flipkart/Blinkit Style) */}
                      {step.showPendingDelay && (
                        <View
                          style={[
                            styles.delayWarningBox,
                            {
                              backgroundColor: isDarkMode ? '#24180A' : '#FFFBEB',
                              borderColor: '#F59E0B',
                            },
                          ]}
                        >
                          <View style={styles.delayWarningHeader}>
                            <Ionicons name="time-outline" size={16} color="#F59E0B" />
                            <Text style={styles.delayWarningTitle}>
                              {isTamil ? 'கடைக்காரரின் அறிவிப்பு' : 'Store Delivery Update'}
                            </Text>
                          </View>
                          <Text style={styles.delayWarningMessage}>
                            "{shop.pendingMessage || orderData.pendingMessage}"
                          </Text>
                          {(shop.pendingUntil || orderData.pendingUntil) && (
                            <Text style={styles.delayWarningResume}>
                              {isTamil ? 'எதிர்பார்க்கப்படும் நேரம்: ' : 'Expected Resume: '}
                              {formatDateTime(shop.pendingUntil || orderData.pendingUntil)}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Store Items List */}
              {shop.items && shop.items.length > 0 && (
                <View
                  style={[
                    styles.shopItemsBox,
                    { borderTopColor: theme.glassBorderSubtle, backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#F8FAFC' },
                  ]}
                >
                  <Text style={[styles.shopItemsSectionTitle, { color: theme.textSecondary }]}>
                    {isTamil ? 'ஆர்டர் செய்யப்பட்ட பொருட்கள்:' : 'Ordered Items:'}
                  </Text>
                  {shop.items.map((item, itmIdx) => (
                    <View key={item.id || itmIdx} style={styles.shopItemRow}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.shopItemQtyBadge, { color: theme.neonGreen }]}>
                          {item.qty || 1}x
                        </Text>
                        <Text style={[styles.shopItemName, { color: theme.textWhite }]} numberOfLines={1}>
                          {item.itemName || item.name}
                        </Text>
                      </View>
                      <Text style={[styles.shopItemPrice, { color: theme.textWhite }]}>
                        ₹{Number(item.price || 0) * Number(item.qty || 1)}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.shopSubtotalRow}>
                    <Text style={[styles.shopSubtotalLabel, { color: theme.textMuted }]}>
                      {isTamil ? 'கடை மொத்தம்' : 'Store Subtotal'}
                    </Text>
                    <Text style={[styles.shopSubtotalValue, { color: theme.neonGreen }]}>
                      ₹{shop.subTotal || shop.shopTotal || orderData.totalAmount || 0}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* 3. DELIVERY ADDRESS CARD */}
        <View
          style={[
            styles.deliveryAddressCard,
            {
              backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
              borderColor: theme.glassBorder,
            },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={[
                  styles.addressIconWrap,
                  { backgroundColor: isDarkMode ? '#16281C' : '#DCFCE7' },
                ]}
              >
                <Ionicons name="location-outline" size={18} color={theme.neonGreen} />
              </View>
              <Text style={[styles.cardHeaderTitle, { color: theme.textWhite }]}>
                {isTamil ? 'டெலிவரி முகவரி' : 'Delivery Address'}
              </Text>
            </View>
          </View>

          <View style={styles.addressBody}>
            <Text style={[styles.customerRecipientName, { color: theme.textWhite }]}>
              {orderData.customerName || user?.displayName || 'Valued Customer'}
            </Text>
            {orderData.customerPhone || orderData.customerMobile ? (
              <Text style={[styles.customerPhoneText, { color: theme.textMuted }]}>
                📞 {orderData.customerPhone || orderData.customerMobile}
              </Text>
            ) : null}

            <Text style={[styles.addressTextContent, { color: theme.textSecondary }]}>
              {typeof orderData.deliveryAddress === 'object'
                ? orderData.deliveryAddress?.formattedAddress ||
                  `${orderData.deliveryAddress?.line1 || ''}, ${orderData.deliveryAddress?.city || ''}`
                : orderData.deliveryAddress || 'Standard Home Delivery'}
            </Text>

            {orderData.instruction ? (
              <View
                style={[
                  styles.deliveryInstructionPill,
                  { backgroundColor: isDarkMode ? '#16281C' : '#F1F5F9' },
                ]}
              >
                <Ionicons name="notifications-outline" size={13} color={theme.neonGreen} />
                <Text style={[styles.instructionText, { color: theme.textWhite }]}>
                  {orderData.instruction}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 4. BILL & PAYMENT SUMMARY CARD */}
        <View
          style={[
            styles.billSummaryCard,
            {
              backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
              borderColor: theme.glassBorder,
            },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={[
                  styles.addressIconWrap,
                  { backgroundColor: isDarkMode ? '#16281C' : '#DCFCE7' },
                ]}
              >
                <Ionicons name="receipt-outline" size={18} color={theme.neonGreen} />
              </View>
              <Text style={[styles.cardHeaderTitle, { color: theme.textWhite }]}>
                {isTamil ? 'கட்டண விவரங்கள்' : 'Payment & Bill Breakdown'}
              </Text>
            </View>

            <View
              style={[
                styles.payMethodBadge,
                { backgroundColor: isDarkMode ? '#16281C' : '#F1F5F9' },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={12} color={theme.neonGreen} />
              <Text style={[styles.payMethodText, { color: theme.neonGreen }]}>
                {orderData.paymentMethod || 'Cash on Delivery'}
              </Text>
            </View>
          </View>

          <View style={styles.billRowsContainer}>
            <View style={styles.billRow}>
              <Text style={[styles.billRowLabel, { color: theme.textMuted }]}>
                {isTamil ? 'பொருட்கள் தொகை' : 'Items Subtotal'}
              </Text>
              <Text style={[styles.billRowValue, { color: theme.textWhite }]}>
                ₹{Number(orderData.totalAmount || orderData.total || 0)}
              </Text>
            </View>

            <View style={styles.billRow}>
              <Text style={[styles.billRowLabel, { color: theme.textMuted }]}>
                {isTamil ? 'டெலிவரி கட்டணம்' : 'Hyperlocal Delivery'}
              </Text>
              <Text style={[styles.billRowValue, { color: theme.neonGreen }]}>
                {isTamil ? 'இலவசம் (FREE)' : 'FREE Express'}
              </Text>
            </View>

            <View style={[styles.billTotalRow, { borderTopColor: theme.glassBorderSubtle }]}>
              <Text style={[styles.billTotalLabel, { color: theme.textWhite }]}>
                {isTamil ? 'மொத்த கட்டணம்' : 'Grand Total Paid'}
              </Text>
              <Text style={[styles.billTotalValue, { color: theme.neonGreen }]}>
                ₹{Number(orderData.totalAmount || orderData.total || 0).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>
      </Animated.ScrollView>

      {/* 5. FLOATING BOTTOM ACTION BAR */}
      <View
        style={[
          styles.bottomActionBar,
          {
            backgroundColor: isDarkMode ? 'rgba(8, 14, 10, 0.94)' : 'rgba(255, 255, 255, 0.96)',
            borderTopColor: theme.glassBorderSubtle,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 14,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.continueShoppingBtn,
            {
              backgroundColor: theme.neonGreen,
            },
          ]}
          onPress={() => {
            navigation.navigate('CustomerHome');
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="bag-handle-outline" size={18} color="#050906" />
          <Text style={styles.continueShoppingBtnText}>
            {isTamil ? 'தொடர்ந்து ஷாப்பிங் செய்ய' : 'Continue Shopping'}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#050906" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  radarWrapper: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  radarRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
  },
  radarCore: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyCard: {
    width: '100%',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  emptyCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyCardDesc: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  primaryActionBtnText: {
    color: '#050906',
    fontWeight: '800',
    fontSize: 14,
  },
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerMainTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  liveRadarPulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  livePulseBeaconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveRadarPulseText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderIdPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  orderIdPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  heroDeliveryCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  heroRadarContainer: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRadarPulseRing: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
  },
  heroRadarCenterBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTimeLeftCol: {
    flex: 1,
  },
  heroTimeBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  heroTimeBadgeText: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroStatusHeading: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  heroOrderTimeSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  segmentedProgressWrapper: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  progressTrackBackground: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
    marginHorizontal: 8,
  },
  progressTrackFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressNodesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  progressNodeItem: {
    alignItems: 'center',
    width: 60,
  },
  progressNodeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  progressNodeLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  counterBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  counterBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  shopJourneyCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  shopCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
  },
  storeIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopNameTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  shopDeliveryScopeText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  shopStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  shopStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  rejectedAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: '#FEF2F2',
  },
  rejectedAlertText: {
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  timelineVerticalBox: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 52,
  },
  timelineColLeft: {
    alignItems: 'center',
    width: 22,
    marginRight: 12,
  },
  timelineStepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  timelineStepDotCurrent: {
    backgroundColor: 'rgba(34, 197, 94, 0.25)',
  },
  timelineCurrentCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineVerticalLine: {
    width: 2,
    flex: 1,
    marginTop: -2,
    marginBottom: -2,
  },
  timelineColRight: {
    flex: 1,
    paddingTop: 1,
  },
  timelineStepTitle: {
    fontSize: 13,
  },
  timelineStepDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  delayWarningBox: {
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  delayWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  delayWarningTitle: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '800',
  },
  delayWarningMessage: {
    color: '#D97706',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  delayWarningResume: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  shopItemsBox: {
    padding: 14,
    borderTopWidth: 1,
  },
  shopItemsSectionTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  shopItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  shopItemQtyBadge: {
    fontSize: 12,
    fontWeight: '800',
    width: 24,
  },
  shopItemName: {
    fontSize: 12.5,
    fontWeight: '500',
    flex: 1,
  },
  shopItemPrice: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  shopSubtotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
    marginTop: 8,
  },
  shopSubtotalLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  shopSubtotalValue: {
    fontSize: 14,
    fontWeight: '900',
  },
  deliveryAddressCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addressIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTitle: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  addressBody: {
    paddingLeft: 40,
  },
  customerRecipientName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  customerPhoneText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  addressTextContent: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
  deliveryInstructionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  instructionText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  billSummaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  payMethodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  payMethodText: {
    fontSize: 11,
    fontWeight: '800',
  },
  billRowsContainer: {
    gap: 8,
    marginTop: 4,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  billRowLabel: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  billRowValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  billTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  billTotalLabel: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  billTotalValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  continueShoppingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  continueShoppingBtnText: {
    color: '#050906',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
