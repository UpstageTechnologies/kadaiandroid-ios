import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Image,
  Platform,
  Dimensions,
  ActivityIndicator,
  Alert,
  Easing,
  Modal,
  Keyboard,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { TEXTURED_DARK, TEXTURED_LIGHT } from './theme';
import { triggerHaptic } from './safeHaptics';
import { DeliveryLocationFlowModal } from './AddressManagementModals';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const FULL_BAR_WIDTH = screenWidth - 20; // 10px padding on each side from headerOuter

export const LiquidGlassHeader = ({
  userAddress = {},
  onUpdateLocation,
  userId,
  onAddressPress,
  marketMode = 'local',
  onToggleMarketMode,
  radiusKm = 3,
  onRadiusChange,
  cart = {},
  onUpdateCartQty,
  onClearCart,
  onPlaceOrder,
  onOpenAccount,
  onOpenVoice,
  searchQuery = '',
  onSearchChange,
  selectedCategory = null,
  onSelectCategory,
  categories = [],
  language = 'en',
  isDarkMode = true,
  navigation,
  selectedShop = null,
  sortBy = 'popular',
  onSortChange,
  selectedType = 'all',
  onSelectType,
  priceRange = 'all',
  onSelectPriceRange,
  lastOrder = null,
  activeOrders: passedActiveOrders = null,
  orders = [],
  onTrackOrder,
}) => {
  const isTamil = language === 'ta';
  const isGlobal = marketMode === 'global';
  const theme = isDarkMode ? TEXTURED_DARK : TEXTURED_LIGHT;
  const insets = useSafeAreaInsets();

  // Active expanding panel state: 'none' | 'location' | 'cart' | 'categories' | 'search'
  const [activePanel, setActivePanel] = useState('none');
  const panelAnim = useRef(new Animated.Value(0)).current;

  // Broadcast panel state changes so components like DynamicIslandTracker can yield space
  useEffect(() => {
    DeviceEventEmitter.emit('KADAI_HEADER_PANEL_STATE', {
      isOpen: activePanel !== 'none',
      panel: activePanel,
    });
  }, [activePanel]);

  // Checkout full-page expansion state & animated progress (0 = dropdown, 1 = whole page)
  const [isCheckoutExpanded, setIsCheckoutExpanded] = useState(false);
  const checkoutExpandAnim = useRef(new Animated.Value(0)).current;

  // Delivery Location Flow Modal (unified state preventing modal collisions)
  const [isLocationFlowOpen, setIsLocationFlowOpen] = useState(false);
  const [locationFlowStep, setLocationFlowStep] = useState('select'); // 'select' | 'add_details' | 'map'
  const [isLocationFlowOverlay, setIsLocationFlowOverlay] = useState(false);

  // Categories & Integrated Filters tab state: 'categories' | 'sort' | 'type' | 'price'
  const [categoriesTab, setCategoriesTab] = useState('categories');

  // Checkout form states
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState('UPI');
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay');
  const [deliveryInstruction, setDeliveryInstruction] = useState('door');
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState('');
  const [orderPlacing, setOrderPlacing] = useState(false);

  // Cart math
  const cartItemsArray = (Array.isArray(cart) ? cart : Object.values(cart || {})).filter(
    item => item && (Number(item.qty) || 0) > 0
  );
  const cartItemCount = cartItemsArray.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
  const cartTotal = cartItemsArray.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1),
    0
  );
  const deliveryFee = cartTotal >= 199 || cartTotal === 0 ? 0 : (isGlobal ? 45 : 25);
  const platformFee = cartTotal > 0 ? 2 : 0;
  const finalPayable = Math.max(0, cartTotal + deliveryFee + platformFee - appliedDiscount);

  // Helper calculations for Last Order Live Tracking in Location Chooser
  const lastOrderShopName =
    lastOrder?.orderedShops?.[0]?.shopName ||
    lastOrder?.shopName ||
    (isTamil ? 'அருகிலுள்ள கடை' : 'Local Express Store');

  const lastOrderItemCount =
    lastOrder?.orderedShops?.reduce(
      (total, shop) => total + (shop.items?.reduce((s, it) => s + (Number(it.qty) || 1), 0) || 0),
      0
    ) ||
    (Array.isArray(lastOrder?.items)
      ? lastOrder.items.reduce((s, it) => s + (Number(it?.qty) || 1), 0)
      : 1);

  // Centralized, robust status resolution helper
  const resolveOrderStatusInfo = (status, isGlobal = false) => {
    const s = String(status || '').toLowerCase().trim();

    // 1. In-Transit / Out for Delivery (MUST check before 'deliver' as 'out for delivery' contains 'deliver')
    if (
      s.includes('out') ||
      s.includes('way') ||
      s.includes('transit') ||
      s.includes('dispatched') ||
      s.includes('delivering') ||
      s.includes('on_the_way') ||
      s.includes('rider') ||
      s.includes('driver') ||
      s.includes('picked')
    ) {
      return {
        key: 'transit',
        stepIndex: 2,
        badgeText: isTamil ? 'வழியில்' : 'On the way',
        etaText: isGlobal
          ? (isTamil ? '📦 கூரியர்' : '📦 In Transit')
          : (isTamil ? '⚡ ~14 நிமி' : '⚡ ~14 mins'),
        dotColor: theme.neonGreen,
      };
    }

    // 2. Packing / Preparing / Accepted / Confirmed
    if (
      s.includes('pack') ||
      s.includes('ready') ||
      s.includes('accept') ||
      s.includes('confirm') ||
      s.includes('cook') ||
      s.includes('prepar')
    ) {
      return {
        key: 'packed',
        stepIndex: 1,
        badgeText: isTamil ? 'தயாராகிறது' : 'Packing',
        etaText: isTamil ? '📦 பேக்கிங்' : '📦 15 mins',
        dotColor: '#38BDF8',
      };
    }

    // 3. Strictly Delivered (order has completed and reached the customer)
    if (s === 'delivered' || s === 'completed' || s.endsWith('delivered')) {
      return {
        key: 'delivered',
        stepIndex: 3,
        badgeText: isTamil ? 'முடிந்தது' : 'Delivered',
        etaText: isTamil ? '✨ வந்து சேர்ந்தது' : '✨ Arrived',
        dotColor: theme.neonGreen,
      };
    }

    // 4. Default: Order Placed / Received
    return {
      key: 'placed',
      stepIndex: 0,
      badgeText: isTamil ? 'பதிவானது' : 'Placed',
      etaText: isTamil ? '🎉 ஆர்டர்' : '🎉 Preparing',
      dotColor: '#F59E0B',
    };
  };

  const getDeliveryCountdown = order => {
    if (!order) return { text: '', mins: 0 };
    const s = (order.status || '').toLowerCase().trim();
    if (s.includes('out') || s.includes('way') || s.includes('transit') || s.includes('dispatched') || s.includes('delivering')) {
      const createdTime = order.createdAt ? new Date(order.createdAt).getTime() : Date.now();
      const elapsedMins = Math.max(0, Math.floor((Date.now() - createdTime) / 60000));
      const remaining = Math.max(2, Math.min(14, 15 - elapsedMins));
      return {
        mins: remaining,
        text: isTamil ? `⚡ ~${remaining} நிமிடம் மீதமுள்ளது` : `⚡ ~${remaining} mins left for delivery`,
      };
    }
    if (s.includes('pack') || s.includes('ready')) {
      return { mins: 12, text: isTamil ? '📦 பொருட்கள் பேக்கிங்' : '📦 12 mins • Packing' };
    }
    if (s.includes('accept')) {
      return { mins: 16, text: isTamil ? '👍 ஆர்டர் ஏற்கப்பட்டது' : '👍 16 mins • Accepted' };
    }
    if (s === 'delivered' || s === 'completed' || s.endsWith('delivered')) {
      return { text: isTamil ? '✨ டெலிவரி செய்யப்பட்டது' : '✨ Delivered', mins: 0 };
    }
    if (s.includes('reject') || s.includes('cancel')) {
      return { text: isTamil ? '❌ ஆர்டர் ரத்து' : '❌ Cancelled', mins: 0 };
    }
    return {
      mins: 20,
      text: isTamil ? '🎉 ஆர்டர் பதிவு' : '🎉 Preparing order',
    };
  };

  const getMiniStepIndex = status => {
    const s = (status || '').toLowerCase().trim();
    if (s.includes('out') || s.includes('way') || s.includes('transit') || s.includes('dispatched') || s.includes('delivering')) return 2;
    if (s.includes('pack') || s.includes('ready') || s.includes('accept')) return 1;
    if (s === 'delivered' || s === 'completed' || s.endsWith('delivered')) return 3;
    return 0; // Placed
  };

  const deliveryCountdownInfo = getDeliveryCountdown(lastOrder);
  const miniStepIndex = getMiniStepIndex(lastOrder?.status);
  // Helper: determine if an order belongs to Global (Pan-India / Courier) or Local mode shopping
  const isOrderFromGlobalMode = order => {
    if (!order) return false;
    if (
      order.marketMode === 'global' ||
      order.marketType === 'global' ||
      order.deliveryScope === 'global' ||
      order.deliveryScope === 'courier' ||
      order.isGlobalMode === true
    ) {
      return true;
    }
    if (Array.isArray(order.orderedShops) && order.orderedShops.length > 0) {
      return order.orderedShops.every(s => s.marketType === 'global');
    }
    if (Array.isArray(order.items) && order.items.length > 0) {
      return order.items.every(it => it.marketType === 'global' || it.isGlobal === true);
    }
    return false;
  };

  // Derive list of all active orders matching current shopping mode
  const activeOrdersList = useMemo(() => {
    if (Array.isArray(passedActiveOrders) && passedActiveOrders.length > 0) {
      return passedActiveOrders.filter(o => {
        const st = (o.status || '').toLowerCase().trim();
        return !['delivered', 'completed', 'cancelled', 'rejected', 'failed'].includes(st);
      });
    }
    if (Array.isArray(orders) && orders.length > 0) {
      return orders.filter(o => {
        const st = (o.status || '').toLowerCase().trim();
        const isActive = !['delivered', 'completed', 'cancelled', 'rejected', 'failed'].includes(st);
        const matchesMode = isGlobal ? isOrderFromGlobalMode(o) : !isOrderFromGlobalMode(o);
        return isActive && matchesMode;
      });
    }
    if (lastOrder) {
      const st = (lastOrder.status || '').toLowerCase().trim();
      if (!['delivered', 'completed', 'cancelled', 'rejected', 'failed'].includes(st)) {
        const isGlob = isOrderFromGlobalMode(lastOrder);
        if (isGlobal ? isGlob : !isGlob) {
          return [lastOrder];
        }
      }
    }
    return [];
  }, [passedActiveOrders, orders, lastOrder, isGlobal]);

  const activeOrdersCount = activeOrdersList.length;
  const isOrderActive = activeOrdersCount > 0;
  const isMultiOrder = activeOrdersCount > 1;
  const primaryOrder = activeOrdersList[0] || lastOrder;
  const isGlobalOrder = isOrderFromGlobalMode(primaryOrder);

  // Dynamic notification state for the location capsule bar (notifies once, then reverts to default)
  const [locationNotification, setLocationNotification] = useState(null);
  const lastNotifiedKeyRef = useRef(null);
  const notifTimeoutRef = useRef(null);

  // Active filter count for badge indicator on Categories & Filters button
  const activeFilterCount =
    (selectedCategory ? 1 : 0) +
    (sortBy && sortBy !== 'popular' ? 1 : 0) +
    (selectedType && selectedType !== 'all' ? 1 : 0) +
    (priceRange && priceRange !== 'all' ? 1 : 0);

  // Subtle, minimal breathing glow animation across the whole Live Tracking Pill
  const pillGlowAnim = useRef(new Animated.Value(0.05)).current;

  useEffect(() => {
    if (!isOrderActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pillGlowAnim, {
          toValue: 0.22,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pillGlowAnim, {
          toValue: 0.04,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isOrderActive]);

  // Find urgent or transit order to highlight in compact mode
  const urgentOrder = useMemo(() => {
    if (activeOrdersList.length === 0) return primaryOrder;
    const inTransit = activeOrdersList.find(o => {
      const s = (o.status || '').toLowerCase().trim();
      return (
        s.includes('out') ||
        s.includes('way') ||
        s.includes('transit') ||
        s.includes('dispatched') ||
        s.includes('delivering')
      );
    });
    if (inTransit) return inTransit;
    const packing = activeOrdersList.find(o => {
      const s = (o.status || '').toLowerCase().trim();
      return s.includes('pack') || s.includes('ready') || s.includes('accept');
    });
    if (packing) return packing;
    return activeOrdersList[0];
  }, [activeOrdersList, primaryOrder]);

  // Smooth UI dynamic ticker transition state & animation for compact pill
  const [cycleIndex, setCycleIndex] = useState(0);
  const pillContentFadeAnim = useRef(new Animated.Value(1)).current;
  const pillContentTranslateY = useRef(new Animated.Value(0)).current;

  // Dynamic Island Morph Animation for Row 2 Live Tracking Pill
  const [isTrackingExpanded, setIsTrackingExpanded] = useState(false);
  const trackingMorphAnim = useRef(new Animated.Value(0)).current;

  // Cycle through active orders smoothly every 3.8 seconds when multiple orders exist
  useEffect(() => {
    if (!isMultiOrder || isTrackingExpanded) {
      setCycleIndex(0);
      return;
    }

    const interval = setInterval(() => {
      // Step 1: Smoothly slide up & fade out
      Animated.parallel([
        Animated.timing(pillContentFadeAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pillContentTranslateY, {
          toValue: -6,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCycleIndex(prev => (prev + 1) % activeOrdersList.length);
        pillContentTranslateY.setValue(6);

        // Step 2: Smoothly slide in from bottom & fade in
        Animated.parallel([
          Animated.timing(pillContentFadeAnim, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(pillContentTranslateY, {
            toValue: 0,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 3800);

    return () => clearInterval(interval);
  }, [isMultiOrder, activeOrdersList.length, isTrackingExpanded]);

  // Active displayed order on the compact pill (cycled or urgent)
  const activeOrderIndex = isMultiOrder ? (cycleIndex % activeOrdersList.length) : 0;
  const activeOrderNumber = activeOrderIndex + 1;
  const currentActiveOrder = isMultiOrder
    ? (activeOrdersList[activeOrderIndex] || urgentOrder || primaryOrder)
    : (urgentOrder || primaryOrder);

  const isCurrentGlobal = isOrderFromGlobalMode(currentActiveOrder);
  const currentOrderInfo = resolveOrderStatusInfo(currentActiveOrder?.status, isCurrentGlobal);
  const currentShopName = currentActiveOrder?.shopName || currentActiveOrder?.sellerName || currentActiveOrder?.storeName || currentActiveOrder?.items?.[0]?.shopName || (isTamil ? 'கடை' : 'Store');

  // Trigger smooth transition whenever single order status updates in real-time
  const lastSingleStatusRef = useRef(currentActiveOrder?.status);
  useEffect(() => {
    if (!isMultiOrder && lastSingleStatusRef.current !== currentActiveOrder?.status) {
      lastSingleStatusRef.current = currentActiveOrder?.status;
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pillContentFadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(pillContentTranslateY, { toValue: -5, duration: 180, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pillContentFadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(pillContentTranslateY, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [currentActiveOrder?.status, isMultiOrder]);

  // Dynamic counter & status text on the compact pill (e.g., "1 of 12 orders • On the way")
  const compactPrimaryLabel = isMultiOrder
    ? (isTamil
        ? `${activeOrderNumber}/${activeOrdersCount} ஆர்டர்கள்`
        : `${activeOrderNumber} of ${activeOrdersCount} orders`)
    : currentOrderInfo.etaText;
  const compactStatusLabel = currentOrderInfo.badgeText;
  const compactDisplayLabel = `${compactPrimaryLabel} • ${compactStatusLabel}`;

  const handleToggleTrackingExpand = () => {
    triggerHaptic('impactLight');
    if (activePanel !== 'none') {
      handleClosePanel();
    }
    if (isTrackingExpanded) {
      handleCollapseTracking();
      return;
    }
    setIsTrackingExpanded(true);
    Animated.spring(trackingMorphAnim, {
      toValue: 1,
      damping: 22,
      mass: 0.8,
      stiffness: 180,
      overshootClamping: true,
      useNativeDriver: false,
    }).start();
  };

  const handleCollapseTracking = () => {
    triggerHaptic('impactLight');
    Animated.spring(trackingMorphAnim, {
      toValue: 0,
      damping: 22,
      mass: 0.8,
      stiffness: 200,
      overshootClamping: true,
      useNativeDriver: false,
    }).start(() => {
      setIsTrackingExpanded(false);
    });
  };

  // Auto-collapse tracking when order is no longer active
  useEffect(() => {
    if (!isOrderActive && isTrackingExpanded) {
      setIsTrackingExpanded(false);
      trackingMorphAnim.setValue(0);
    }
  }, [isOrderActive]);

  // Dynamic measurement of Categories pill width so Live Tracking stretches to fill the entire remaining space
  const [categoriesWidth, setCategoriesWidth] = useState(146);

  const handleCategoriesLayout = useCallback(e => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 50 && Math.abs(w - categoriesWidth) > 1) {
      setCategoriesWidth(w);
    }
  }, [categoriesWidth]);

  // Live Tracking Pill compact width stretches from (categoriesWidth + 8px gap) to the right edge (right: 0)
  const compactTrackingWidth = Math.max(140, FULL_BAR_WIDTH - categoriesWidth - 8);

  // Interpolations for smooth morphing in Row 2 (Zero layout jumping, clamped bounds)
  const categoriesOpacity = isOrderActive
    ? trackingMorphAnim.interpolate({
        inputRange: [0, 0.35],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      })
    : 1;

  const trackingWidth = trackingMorphAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [compactTrackingWidth, FULL_BAR_WIDTH],
    extrapolate: 'clamp',
  });

  const expandedPanelHeight = isMultiOrder
    ? Math.min(270, 48 + (activeOrdersCount * 86))
    : 156;

  const trackingHeight = trackingMorphAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [38, expandedPanelHeight],
    extrapolate: 'clamp',
  });

  const trackingBorderRadius = trackingMorphAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [19, 20],
    extrapolate: 'clamp',
  });

  const compactOpacity = trackingMorphAnim.interpolate({
    inputRange: [0, 0.25],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const expandedOpacity = trackingMorphAnim.interpolate({
    inputRange: [0.35, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const trackingBorderColor = trackingMorphAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isDarkMode ? 'rgba(16, 185, 129, 0.55)' : 'rgba(16, 185, 129, 0.45)',
      '#10B981',
    ],
    extrapolate: 'clamp',
  });

  const trackingBgColor = trackingMorphAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isDarkMode ? '#0E3624' : '#DCFCE7',
      isDarkMode ? '#08120B' : '#FFFFFF',
    ],
    extrapolate: 'clamp',
  });

  // If market mode changes and current notification does not match mode, dismiss immediately
  useEffect(() => {
    if (isGlobal && !isGlobalOrder) {
      setLocationNotification(null);
    } else if (!isGlobal && isGlobalOrder) {
      setLocationNotification(null);
    }
  }, [isGlobal, isGlobalOrder]);

  useEffect(() => {
    if (!lastOrder) return;

    // Tracking of local mode shopping shouldn't show in Global mode
    if (isGlobal && !isGlobalOrder) {
      setLocationNotification(null);
      return;
    }

    // Tracking of global orders shouldn't show in Local mode
    if (!isGlobal && isGlobalOrder) {
      setLocationNotification(null);
      return;
    }

    const orderId = lastOrder.orderId || lastOrder.id;
    const orderStatus = (lastOrder.status || 'Order Placed').trim();
    const eventKey = `${orderId}_${orderStatus}_${isGlobal ? 'global' : 'local'}`;

    // If this exact order status was already notified, do not notify again
    if (lastNotifiedKeyRef.current === eventKey) return;

    // Check if this is an ancient or completed order on initial app mount
    const orderTime = lastOrder.createdAt ? new Date(lastOrder.createdAt).getTime() : 0;
    const isAncient = orderTime > 0 && Date.now() - orderTime > 10 * 60 * 1000;
    const isCompleted = ['delivered', 'cancelled', 'rejected'].includes(orderStatus.toLowerCase());

    // On cold start, if the latest order is already delivered or ancient, don't trigger notification
    if (lastNotifiedKeyRef.current === null && (isAncient || isCompleted)) {
      lastNotifiedKeyRef.current = eventKey;
      return;
    }

    lastNotifiedKeyRef.current = eventKey;

    const s = orderStatus.toLowerCase();
    let title = '';
    let subtitle = '';
    let badgeColor = theme.neonGreen;

    if (s.includes('out') || s.includes('way') || s.includes('transit') || s.includes('dispatched') || s.includes('delivering')) {
      title = isTamil ? '⚡ டெலிவரிக்கு புறப்பட்டது!' : '⚡ Out For Delivery!';
      subtitle = isTamil ? `~${deliveryCountdownInfo.mins} நிமிடம் • வழியில் உள்ளது` : `~${deliveryCountdownInfo.mins} mins left • On the way`;
      badgeColor = '#22C55E';
    } else if (s.includes('pack') || s.includes('ready')) {
      title = isTamil ? '📦 பொருட்கள் பேக் செய்யப்பட்டது' : '📦 Items Packed & Ready';
      subtitle = `${lastOrderShopName} • #${orderId}`;
      badgeColor = '#22C55E';
    } else if (s.includes('accept')) {
      title = isTamil ? '👍 கடைக்காரரால் ஏற்கப்பட்டது' : '👍 Order Accepted by Store';
      subtitle = `${lastOrderShopName} • #${orderId}`;
      badgeColor = '#22C55E';
    } else if (s === 'delivered' || s === 'completed' || s.endsWith('delivered')) {
      title = isTamil ? '✨ ஆர்டர் டெலிவரி செய்யப்பட்டது!' : '✨ Delivered Successfully!';
      subtitle = `#${orderId} • ${lastOrderShopName}`;
      badgeColor = '#10B981';
    } else if (s.includes('cancel') || s.includes('reject')) {
      title = isTamil ? '❌ ஆர்டர் ரத்து செய்யப்பட்டது' : '❌ Order Cancelled';
      subtitle = `#${orderId}`;
      badgeColor = '#EF4444';
    } else {
      title = isTamil ? '🎉 ஆர்டர் பதிவு செய்யப்பட்டது' : '🎉 Order Placed Successfully';
      subtitle = `#${orderId} • ${lastOrderShopName}`;
      badgeColor = '#22C55E';
    }

    // Set notification badge
    setLocationNotification({
      title,
      subtitle,
      badgeColor,
      orderId,
    });

    if (notifTimeoutRef.current) {
      clearTimeout(notifTimeoutRef.current);
    }

    // After 6 seconds, smoothly clear the notification and return to default location display
    notifTimeoutRef.current = setTimeout(() => {
      setLocationNotification(null);
    }, 6000);

    return () => {
      if (notifTimeoutRef.current) {
        clearTimeout(notifTimeoutRef.current);
      }
    };
  }, [lastOrder?.status, lastOrder?.orderId, lastOrder?.id, isGlobal, isGlobalOrder]);

  const displayAddress =
    userAddress?.formattedAddress ||
    userAddress?.fullAddress ||
    userAddress?.googleFormattedAddress ||
    [
      userAddress?.street,
      userAddress?.street !== userAddress?.area ? userAddress?.area : null,
      userAddress?.city,
      userAddress?.state,
    ]
      .filter(Boolean)
      .join(', ') ||
    (isTamil ? 'உங்கள் முகவரியைத் தேர்ந்தெடுக்கவும்' : 'Set delivery location');

  const displayStreetCityState =
    [
      userAddress?.street && userAddress?.street !== userAddress?.area
        ? userAddress?.street
        : userAddress?.area,
      userAddress?.city,
      userAddress?.state,
    ]
      .filter(Boolean)
      .join(', ') || displayAddress;

  const isLongAddress = (displayAddress || '').length > 34;
  const locationPanelHeight = isOrderActive
    ? (isLongAddress ? 440 : 424)
    : (isLongAddress ? 260 : 246);
  const cartPanelHeight = isLongAddress ? 440 : 424;

  const localRadiusOptions = [
    { value: 1, label: '1 km' },
    { value: 3, label: '3 km' },
    { value: 5, label: '5 km' },
    { value: 10, label: '10 km' },
  ];

  const globalRadiusOptions = [
    { value: 50, label: '50 km' },
    { value: 100, label: '100 km' },
    { value: 200, label: '200 km' },
    { value: 'all', label: isTamil ? 'அகில இந்தியா' : 'Pan-India' },
  ];

  // Target height tailored per panel:
  // - Location panel adapts dynamically: 246px when idle, 424px when live order tracking is active
  // - Cart panel uses 424px/440px for items & express checkout
  // - Filter panels (Categories, Sort, Type, Price) share unified 230px height for seamless tab switching
  const getPanelTargetHeight = panel => {
    switch (panel) {
      case 'location':
        return locationPanelHeight;
      case 'cart':
        return cartPanelHeight;
      case 'categories':
        return 340;
      case 'live_tracking':
        return 175;
      case 'sort':
      case 'type':
      case 'price':
        return 230;
      default:
        return 230;
    }
  };

  const targetHeight = getPanelTargetHeight(activePanel);

  // Toggle dropdown panels (silky smooth fluid animations, zero bounce or stutter on close)
  const togglePanel = panelName => {
    if (isTrackingExpanded) {
      handleCollapseTracking();
    }
    let targetPanel = panelName;
    if (['sort', 'type', 'price'].includes(panelName)) {
      setCategoriesTab(panelName);
      targetPanel = 'categories';
    }

    if (activePanel === targetPanel) {
      // Close smoothly: cubic-bezier deceleration that cleanly lands on 0 without sudden pop
      Animated.timing(panelAnim, {
        toValue: 0,
        duration: 190,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }).start(() => {
        setActivePanel('none');
        setIsCheckoutExpanded(false);
        checkoutExpandAnim.setValue(0);
      });
    } else if (activePanel !== 'none') {
      // Switch panel: swift cross-fade
      Animated.timing(panelAnim, {
        toValue: 0.85,
        duration: 60,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(() => {
        setActivePanel(targetPanel);
        setIsCheckoutExpanded(false);
        checkoutExpandAnim.setValue(0);
        Animated.timing(panelAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      });
    } else {
      // Open from closed state
      setActivePanel(targetPanel);
      setIsCheckoutExpanded(false);
      checkoutExpandAnim.setValue(0);
      panelAnim.setValue(0);
      Animated.timing(panelAnim, {
        toValue: 1,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  };

  const handleClosePanel = () => {
    Animated.timing(panelAnim, {
      toValue: 0,
      duration: 190,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    }).start(() => {
      setActivePanel('none');
      setIsCheckoutExpanded(false);
    });
  };

  // Open full-page express checkout
  const handleExpandToCheckout = () => {
    setIsCheckoutExpanded(true);
  };

  // Close full-page checkout back to cart
  const handleCollapseCheckout = () => {
    setIsCheckoutExpanded(false);
  };

  const handleApplyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (code === 'KADAI50' || code === 'LOCAL50') {
      const disc = Math.min(50, Math.round(cartTotal * 0.2));
      setAppliedDiscount(disc);
      setCouponMsg(isTamil ? `₹${disc} தள்ளுபடி வெற்றிகரமாக சேர்க்கப்பட்டது!` : `₹${disc} coupon discount applied!`);
    } else {
      setCouponMsg(isTamil ? 'செல்லுபடியாகாத குறியீடு (KADAI50 பயன்படுத்தவும்)' : 'Invalid code (Try KADAI50)');
    }
  };

  const handlePlaceOrderSubmit = async () => {
    if (cartItemsArray.length === 0) {
      Alert.alert(isTamil ? 'கார்ட் காலியாக உள்ளது' : 'Cart is empty');
      return;
    }
    setOrderPlacing(true);
    try {
      if (onPlaceOrder) {
        await onPlaceOrder({
          paymentMethod: checkoutPaymentMethod,
          upiApp: selectedUpiApp,
          deliveryInstruction,
          appliedDiscount,
          totalAmount: finalPayable,
        });
      }
      setIsCheckoutExpanded(false);
      handleClosePanel();
    } catch (e) {
      console.log('Order submit note:', e?.message);
    } finally {
      setOrderPlacing(false);
    }
  };

  // Animated interpolations: height, opacity, marginTop, and borderWidth
  // When panelAnim reaches 0, height = 0, marginTop = 0, borderWidth = 0, opacity = 0
  // Result: ZERO layout jump, completely eliminated stutter on collapse
  const panelHeight = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetHeight],
  });

  const panelOpacity = panelAnim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.5, 1],
  });

  const containerMarginTop = panelAnim.interpolate({
    inputRange: [0, 0.1, 1],
    outputRange: [0, 1, 6],
  });

  const containerBorderWidth = panelAnim.interpolate({
    inputRange: [0, 0.05, 1],
    outputRange: [0, 1, 1.5],
  });

  // Calculate safe expanded checkout height fitting completely within physical screen boundaries
  const topChromeHeight = 105; // Height of top search/profile bar + horizontal filter rail
  const bottomSafetyMargin = Math.max(insets.bottom, 14) + 10;
  const maxCheckoutHeight = Math.max(380, screenHeight - insets.top - topChromeHeight - bottomSafetyMargin);

  const checkoutContainerHeight = checkoutExpandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [targetHeight, maxCheckoutHeight],
  });

  const [showSearchInput, setShowSearchInput] = useState(Boolean(searchQuery));
  const searchInputRef = useRef(null);
  const searchAnim = useRef(new Animated.Value(searchQuery ? 1 : 0)).current;
  const [localSearchText, setLocalSearchText] = useState(searchQuery || '');
  const searchDebounceTimerRef = useRef(null);

  useEffect(() => {
    DeviceEventEmitter.emit('KADAI_HEADER_SEARCH_STATE', {
      isOpen: showSearchInput,
    });
  }, [showSearchInput]);

  // Sync local search text if parent searchQuery changes externally (e.g., voice input or reset)
  useEffect(() => {
    if (searchQuery !== localSearchText) {
      setLocalSearchText(searchQuery || '');
      if (searchQuery && !showSearchInput) {
        setShowSearchInput(true);
        Animated.timing(searchAnim, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      }
    }
  }, [searchQuery]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
    };
  }, []);

  // Instant local typing response (0ms keystroke lag) + debounced parent filtering
  const handleSearchTextChange = text => {
    setLocalSearchText(text);
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }
    searchDebounceTimerRef.current = setTimeout(() => {
      if (onSearchChange) {
        onSearchChange(text);
      }
    }, 160);
  };

  const handleClearSearchText = () => {
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }
    setLocalSearchText('');
    if (onSearchChange) {
      onSearchChange('');
    }
    searchInputRef.current?.focus();
  };

  const handleToggleSearch = () => {
    if (showSearchInput) {
      // Smooth collapse & dismiss keyboard
      Keyboard.dismiss();
      Animated.timing(searchAnim, {
        toValue: 0,
        duration: 160,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }).start(() => {
        setShowSearchInput(false);
        setLocalSearchText('');
        if (searchDebounceTimerRef.current) {
          clearTimeout(searchDebounceTimerRef.current);
        }
        if (onSearchChange) {
          onSearchChange('');
        }
      });
    } else {
      // Close other floating panels to avoid layout collision
      if (activePanel !== 'none') {
        handleClosePanel();
      }
      setShowSearchInput(true);
      Animated.timing(searchAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      // Fluid focus without blocking view mount
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Order fresh vegetables, fruits and groceries from neighborhood local stores on Upstage Kadai! https://kadai.upstage.in',
        title: 'Upstage Kadai App',
      });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  return (
    <View
      style={[
        styles.headerOuter,
        {
          backgroundColor: isDarkMode ? '#080E0A' : '#F8FAFC',
          borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      {/* 1. TOP BAR */}
      <View style={styles.topBar}>
        {/* Left: Profile / Account circular button */}
        <TouchableOpacity
          style={[
            styles.iconButton,
            {
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
              borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            },
          ]}
          onPress={() => {
            if (onOpenAccount) {
              onOpenAccount();
            }
          }}
          activeOpacity={0.8}
          accessibilityLabel="Account and Profile"
        >
          <Ionicons name="person-outline" size={20} color={isDarkMode ? '#FFFFFF' : '#0F172A'} />
        </TouchableOpacity>

        {/* Center: Location Chooser Capsule Pill & Smart Notification Area */}
        <TouchableOpacity
          style={[
            styles.centerLocationPill,
            {
              backgroundColor: locationNotification
                ? (isDarkMode ? 'rgba(34, 197, 94, 0.12)' : 'rgba(22, 163, 74, 0.08)')
                : (isDarkMode ? 'rgba(255,255,255,0.08)' : '#FFFFFF'),
              borderColor: locationNotification
                ? (locationNotification.badgeColor || theme.neonGreen)
                : activePanel === 'location'
                ? theme.neonGreen
                : (isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
            },
          ]}
          onPress={() => {
            if (locationNotification?.orderId) {
              if (onTrackOrder) {
                onTrackOrder(locationNotification.orderId);
              } else if (navigation) {
                navigation.navigate('TrackOrderScreen', { orderId: locationNotification.orderId });
              }
            } else {
              togglePanel('location');
            }
          }}
          activeOpacity={0.82}
        >
          <Text
            style={[
              styles.pillTitle,
              {
                color: locationNotification
                  ? (locationNotification.badgeColor || theme.neonGreen)
                  : (isDarkMode ? '#FFFFFF' : '#0F172A'),
              },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {locationNotification
              ? locationNotification.title
              : isGlobal
              ? (isTamil ? '⚡ அகில இந்திய டெலிவரி' : '⚡ Pan-India Delivery')
              : (isTamil ? '⚡ 15-20 நிமிடம் டெலிவரி' : '⚡ 15-20 Mins Delivery')}
          </Text>
          <View style={styles.pillSubRow}>
            {locationNotification ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                <View
                  style={[
                    styles.pulsingDot,
                    {
                      backgroundColor: locationNotification.badgeColor || theme.neonGreen,
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                    },
                  ]}
                />
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[
                    styles.pillAddress,
                    { color: isDarkMode ? '#A7F3D0' : '#166534', fontWeight: '600' },
                  ]}
                >
                  {locationNotification.subtitle}
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={styles.pillAddressWrapper}>
                  <Text style={[styles.pillTagText, { color: theme.neonGreen }]}>
                    {userAddress?.tag || 'Home'}
                  </Text>
                  <Text style={{ color: isDarkMode ? 'rgba(255,255,255,0.45)' : '#94A3B8' }}> • </Text>
                  <Text style={[styles.pillAddress, { color: isDarkMode ? 'rgba(255,255,255,0.75)' : '#64748B' }]}>
                    {displayAddress}
                  </Text>
                </Text>
              </View>
            )}
            <Ionicons
              name={activePanel === 'location' ? 'chevron-up' : 'chevron-down'}
              size={11}
              color={
                locationNotification
                  ? (locationNotification.badgeColor || theme.neonGreen)
                  : (isDarkMode ? 'rgba(255,255,255,0.7)' : '#64748B')
              }
              style={{ marginLeft: 3, flexShrink: 0 }}
            />
          </View>
        </TouchableOpacity>

        {/* Right Action Buttons */}
        <View style={styles.rightButtonsRow}>
          {/* Search Button */}
          <TouchableOpacity
            style={[
              styles.iconButton,
              {
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                borderColor: showSearchInput ? theme.neonGreen : (isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
              },
            ]}
            onPress={handleToggleSearch}
            activeOpacity={0.8}
            accessibilityLabel="Search"
          >
            <Ionicons name={showSearchInput ? 'close' : 'search-outline'} size={19} color={isDarkMode ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>

          {/* Cart Button */}
          <TouchableOpacity
            style={[
              styles.iconButton,
              {
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                borderColor: activePanel === 'cart' ? theme.neonGreen : (isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
              },
            ]}
            onPress={() => togglePanel('cart')}
            activeOpacity={0.8}
            accessibilityLabel="Cart"
          >
            <Ionicons name="cart-outline" size={19} color={isDarkMode ? '#FFFFFF' : '#0F172A'} />
            {cartItemCount > 0 && (
              <View style={[styles.cartBadge, { backgroundColor: theme.neonGreen }]}>
                <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. EXPANDABLE SEARCH INPUT (toggled by search icon) */}
      {showSearchInput && (
        <Animated.View
          style={[
            styles.searchBarBox,
            {
              backgroundColor: isDarkMode ? '#132018' : '#FFFFFF',
              borderColor: theme.glassBorder,
              height: searchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 38],
              }),
              opacity: searchAnim.interpolate({
                inputRange: [0, 0.2, 1],
                outputRange: [0, 0.5, 1],
              }),
              marginTop: searchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 4],
              }),
              marginBottom: searchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 4],
              }),
              borderWidth: searchAnim.interpolate({
                inputRange: [0, 0.1, 1],
                outputRange: [0, 1, 1],
              }),
              overflow: 'hidden',
            },
          ]}
        >
          <Ionicons name="search" size={16} color={theme.neonGreen} style={{ marginRight: 6 }} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}
            placeholder={isTamil ? 'உள்ளூர் பொருட்கள் தேடவும்...' : 'Search stores & items...'}
            placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.45)' : '#94A3B8'}
            value={localSearchText}
            onChangeText={handleSearchTextChange}
            returnKeyType="search"
            clearButtonMode="never"
          />
          {localSearchText ? (
            <TouchableOpacity onPress={handleClearSearchText} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={isDarkMode ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.aiVoiceBtn, { backgroundColor: theme.neonGreen }]}
            onPress={() => {
              if (onOpenVoice) onOpenVoice();
              else if (navigation) navigation.navigate('AIMicScreen');
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="mic" size={14} color="#050906" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* 3. ROW 2: CATEGORIES & FILTERS (INTEGRATED) + DYNAMIC LIVE TRACKING PILL */}
      <View style={styles.filterBarContainer}>
        {/* Transparent Backdrop to collapse tracking when tapping anywhere outside */}
        {isTrackingExpanded && (
          <TouchableOpacity
            style={styles.trackingBackdrop}
            activeOpacity={1}
            onPress={handleCollapseTracking}
          />
        )}

        {/* Categories & Integrated Filters Pill */}
        <Animated.View
          style={[
            styles.categoriesPillWrap,
            {
              opacity: categoriesOpacity,
            },
          ]}
          onLayout={handleCategoriesLayout}
          pointerEvents={isTrackingExpanded ? 'none' : 'auto'}
        >
          <TouchableOpacity
            style={[
              styles.matchingGlassPill,
              {
                backgroundColor: (activePanel === 'categories' || activeFilterCount > 0)
                  ? (isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7')
                  : (isDarkMode ? '#132018' : '#FFFFFF'),
                borderColor: (activePanel === 'categories' || activeFilterCount > 0)
                  ? theme.neonGreen
                  : (isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'),
              },
            ]}
            onPress={() => {
              if (isTrackingExpanded) {
                handleCollapseTracking();
              }
              togglePanel('categories');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.pillLeftContent}>
              <Ionicons
                name="grid-outline"
                size={13}
                color={(activePanel === 'categories' || activeFilterCount > 0) ? theme.neonGreen : (isDarkMode ? '#FFFFFF' : '#0F172A')}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.matchingPillText,
                  { color: (activePanel === 'categories' || activeFilterCount > 0) ? theme.neonGreen : (isDarkMode ? '#FFFFFF' : '#0F172A') },
                ]}
                numberOfLines={1}
              >
                {selectedCategory
                  ? (isTamil && selectedCategory.nameTa ? selectedCategory.nameTa : (selectedCategory.shortName || selectedCategory.name))
                  : (isTamil ? 'பிரிவுகள் & வடிகட்டி' : 'Categories & Filters')}
              </Text>

              {/* Active filter count badge */}
              {activeFilterCount > 0 && (
                <View style={[styles.filterBadgeCircle, { backgroundColor: theme.neonGreen }]}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </View>

            <Ionicons
              name={activePanel === 'categories' ? 'chevron-up' : 'chevron-down'}
              size={11}
              color={activePanel === 'categories' ? theme.neonGreen : (isDarkMode ? '#9CA3AF' : '#64748B')}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Live Order Tracking Dynamic Pill (shown when an order is active) */}
        {isOrderActive ? (
          <Animated.View
            style={[
              styles.trackingMorphCard,
              {
                width: trackingWidth,
                height: trackingHeight,
                borderRadius: trackingBorderRadius,
                backgroundColor: trackingBgColor,
                borderColor: trackingBorderColor,
              },
            ]}
          >
            {/* COMPACT VIEW (Matching Twin Pill) */}
            <Animated.View
              style={[
                styles.trackingCompactRow,
                { opacity: compactOpacity },
              ]}
              pointerEvents={isTrackingExpanded ? 'none' : 'auto'}
            >
              {/* Subtle, minimal whole-pill breathing glow overlay */}
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  backgroundColor: '#10B981',
                  opacity: pillGlowAnim,
                  borderRadius: 19,
                }}
              />

              <TouchableOpacity
                style={styles.trackingCompactTouchable}
                onPress={handleToggleTrackingExpand}
                activeOpacity={0.82}
              >
                <View style={styles.trackingCompactLeft}>
                  {/* Clean, minimal accent vehicle icon badge */}
                  <View style={styles.liveTrackingIconWrap}>
                    <View style={[styles.liveBeaconCore, { backgroundColor: '#10B981' }]}>
                      <Ionicons
                        name={isCurrentGlobal ? 'cube' : 'bicycle'}
                        size={10}
                        color="#050906"
                      />
                    </View>
                  </View>

                  <Animated.View
                    style={{
                      flex: 1,
                      minWidth: 0,
                      opacity: pillContentFadeAnim,
                      transform: [{ translateY: pillContentTranslateY }],
                    }}
                  >
                    <Text
                      style={[
                        styles.trackingPillText,
                        { color: isDarkMode ? '#ECFDF5' : '#065F46' },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      <Text style={{ color: isDarkMode ? '#FFFFFF' : '#064E3B', fontWeight: '800' }}>
                        {compactPrimaryLabel}
                      </Text>
                      <Text style={{ color: isDarkMode ? '#34D399' : '#059669', fontWeight: '800' }}>
                        {` • ${compactStatusLabel}`}
                      </Text>
                    </Text>
                  </Animated.View>
                </View>

                <Ionicons
                  name="chevron-down"
                  size={11}
                  color={isDarkMode ? '#34D399' : '#059669'}
                  style={{ marginLeft: 4, flexShrink: 0 }}
                />
              </TouchableOpacity>
            </Animated.View>

            {/* EXPANDED VIEW (Dynamic Island Card) */}
            <Animated.View
              style={[
                styles.trackingExpandedCard,
                { opacity: expandedOpacity },
              ]}
              pointerEvents={isTrackingExpanded ? 'auto' : 'none'}
            >
              {/* Top Row: Badge & Collapse Button */}
              <View style={styles.expandedHeaderRow}>
                <View style={styles.expandedBadgeWrap}>
                  <View style={[styles.pulsingCoreDot, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.expandedBadgeText, { color: '#10B981' }]}>
                    {isMultiOrder
                      ? (isTamil
                          ? `நேரலை கண்காணிப்பு • ${activeOrderNumber}/${activeOrdersCount} ஆர்டர்கள்`
                          : `LIVE ORDER TRACKING • ${activeOrderNumber} OF ${activeOrdersCount} ORDERS`)
                      : `${isTamil ? 'நேரலை கண்காணிப்பு' : 'LIVE ORDER TRACKING'} • #${lastOrder?.orderId || lastOrder?.id || ''}`}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.collapseBtn}
                  onPress={handleCollapseTracking}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-up" size={17} color="#10B981" />
                </TouchableOpacity>
              </View>

              {isMultiOrder ? (
                <ScrollView
                  style={styles.multiOrdersScroll}
                  contentContainerStyle={styles.multiOrdersScrollContent}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={activeOrdersCount > 2}
                  keyboardShouldPersistTaps="handled"
                >
                  {activeOrdersList.map((ord, idx) => {
                    const ordId = ord?.orderId || ord?.id || `ORD-${idx}`;
                    const ordShop = ord?.shopName || ord?.sellerName || ord?.storeName || ord?.items?.[0]?.shopName || (isTamil ? 'கடை' : 'Store');
                    const itemCount = (ord?.items && Array.isArray(ord.items)) ? ord.items.length : (ord?.totalItems || 1);
                    const totalAmount = ord?.total || ord?.totalAmount || ord?.grandTotal;
                    const isOrdGlobal = isOrderFromGlobalMode(ord);
                    const ordInfo = resolveOrderStatusInfo(ord?.status, isOrdGlobal);

                    return (
                      <TouchableOpacity
                        key={ordId || idx}
                        style={[
                          styles.multiOrderCard,
                          {
                            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                          },
                        ]}
                        activeOpacity={0.82}
                        onPress={() => {
                          handleCollapseTracking();
                          if (onTrackOrder) {
                            onTrackOrder(ordId);
                          } else if (navigation) {
                            navigation.navigate('TrackOrderScreen', {
                              orderId: ordId,
                              order: typeof ord === 'object' && ord !== null ? ord : undefined,
                            });
                          }
                        }}
                      >
                        {/* Store Icon */}
                        <View style={[styles.multiStoreIconWrap, { backgroundColor: isDarkMode ? '#1E2D22' : '#E6F4EA' }]}>
                          <Ionicons
                            name={isOrdGlobal ? 'cube' : 'bicycle'}
                            size={14}
                            color="#10B981"
                          />
                        </View>

                        {/* Details */}
                        <View style={styles.multiOrderInfo}>
                          <View style={styles.multiOrderTopRow}>
                            <Text style={[styles.multiStoreName, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
                              {ordShop}
                            </Text>
                            {totalAmount ? (
                              <Text style={[styles.multiOrderPrice, { color: '#10B981' }]}>
                                ₹{Math.round(totalAmount)}
                              </Text>
                            ) : null}
                          </View>

                          <View style={styles.multiOrderBottomRow}>
                            <View style={styles.multiStatusBadge}>
                              <View style={[styles.miniStatusDot, { backgroundColor: ordInfo.dotColor }]} />
                              <Text style={[styles.multiStatusText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
                                {ordInfo.badgeText} • {ordInfo.etaText}
                              </Text>
                            </View>
                            <Text style={[styles.multiOrderSubMeta, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
                              {isTamil ? `${idx + 1}/${activeOrdersCount}` : `${idx + 1} of ${activeOrdersCount}`} • #{String(ordId).slice(-6)}
                            </Text>
                          </View>
                        </View>

                        {/* Track CTA */}
                        <View style={[styles.multiTrackBtn, { backgroundColor: '#10B981' }]}>
                          <Text style={styles.multiTrackBtnText}>
                            {isTamil ? 'வரைபடம்' : 'Track'}
                          </Text>
                          <Ionicons name="navigate" size={10} color="#050906" style={{ marginLeft: 3 }} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <React.Fragment>
                  {/* Middle Row: Large ETA & Store Info + Track Live CTA */}
                  <View style={styles.expandedHeroRow}>
                    <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <Text style={[styles.expandedEtaHeadline, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
                        {currentOrderInfo.etaText} • {currentOrderInfo.badgeText}
                      </Text>
                      <Text style={[styles.expandedStoreSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                        {lastOrderShopName} • {lastOrderItemCount} {isTamil ? 'பொருட்கள்' : 'items'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.expandedTrackBtn, { backgroundColor: theme.neonGreen }]}
                      onPress={() => {
                        handleCollapseTracking();
                        const targetOrderId = lastOrder?.orderId || lastOrder?.id || (typeof lastOrder === 'string' ? lastOrder : '');
                        if (onTrackOrder) {
                          onTrackOrder(targetOrderId);
                        } else if (navigation) {
                          navigation.navigate('TrackOrderScreen', {
                            orderId: targetOrderId,
                            order: typeof lastOrder === 'object' && lastOrder !== null ? lastOrder : undefined,
                          });
                        }
                      }}
                      activeOpacity={0.82}
                    >
                      <Text style={styles.expandedTrackBtnText}>
                        {isTamil ? 'வரைபடம்' : 'Track Live'}
                      </Text>
                      <Ionicons name="navigate" size={12} color="#050906" />
                    </TouchableOpacity>
                  </View>

                  {/* Bottom Row: 4-Step Progress Stepper */}
                  <View style={styles.expandedStepperRow}>
                    {[
                      { key: 'placed', label: isTamil ? 'பதிவு' : 'Placed', icon: 'checkmark-circle' },
                      { key: 'packed', label: isTamil ? 'தயார்' : 'Packed', icon: 'cube' },
                      { key: 'transit', label: isTamil ? 'வழியில்' : 'On the Way', icon: 'bicycle' },
                      { key: 'delivered', label: isTamil ? 'டெலிவரி' : 'Delivered', icon: 'home' },
                    ].map((st, idx) => {
                      const isDone = currentOrderInfo.stepIndex >= idx;
                      const isCurrent = currentOrderInfo.stepIndex === idx;
                      return (
                        <React.Fragment key={st.key}>
                          <View style={{ alignItems: 'center' }}>
                            <View
                              style={[
                                styles.stepperDot,
                                {
                                  backgroundColor: isDone ? theme.neonGreen : (isDarkMode ? '#1E2D22' : '#E2E8F0'),
                                  borderColor: isCurrent ? '#FFFFFF' : 'transparent',
                                  borderWidth: isCurrent ? 2 : 0,
                                },
                              ]}
                            >
                              <Ionicons
                                name={st.icon}
                                size={10}
                                color={isDone ? '#050906' : (isDarkMode ? '#64748B' : '#94A3B8')}
                              />
                            </View>
                            <Text
                              style={[
                                styles.stepLabel,
                                {
                                  color: isCurrent
                                    ? theme.neonGreen
                                    : isDone
                                    ? (isDarkMode ? '#FFFFFF' : '#0F172A')
                                    : (isDarkMode ? '#64748B' : '#94A3B8'),
                                  fontWeight: isCurrent ? '800' : '600',
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {st.label}
                            </Text>
                          </View>
                          {idx < 3 && (
                            <View
                              style={[
                                styles.stepLine,
                                {
                                  backgroundColor: currentOrderInfo.stepIndex > idx ? theme.neonGreen : (isDarkMode ? '#1E2D22' : '#E2E8F0'),
                                },
                              ]}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </View>
                </React.Fragment>
              )}
            </Animated.View>
          </Animated.View>
        ) : null}
      </View>

      {/* EXPANDABLE DROP-DOWN CONTAINER */}
      {activePanel !== 'none' && (
        <Animated.View
          style={[
            styles.dropdownContainer,
            {
              backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
              borderColor: theme.glassBorder,
              height: panelHeight,
              opacity: panelOpacity,
              marginTop: containerMarginTop,
              borderWidth: containerBorderWidth,
            },
          ]}
        >
          {/* PANEL 1: LOCATION CHOOSER */}
          {activePanel === 'location' && (
            <ScrollView
              style={{ maxHeight: targetHeight }}
              contentContainerStyle={[styles.panelContent, { paddingBottom: isOrderActive ? 12 : 14 }]}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              <View style={styles.panelHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="location" size={18} color={theme.neonGreen} />
                  <Text style={[styles.panelHeading, { color: theme.textWhite }]}>
                    {isTamil ? 'டெலிவரி அமைப்புகள்' : 'Delivery Mode & Radius'}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleClosePanel}>
                  <Ionicons name="close" size={20} color={theme.textWhite} />
                </TouchableOpacity>
              </View>

              {/* Local vs Global Segmented Toggle */}
              <View
                style={[
                  styles.modeToggleTrack,
                  { backgroundColor: isDarkMode ? '#132018' : '#F1F5F9' },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.modeToggleSegment,
                    !isGlobal && [styles.modeToggleSegmentActive, { backgroundColor: theme.neonGreen }],
                  ]}
                  onPress={() => {
                    if (onToggleMarketMode) onToggleMarketMode('local');
                    if (onRadiusChange && (radiusKm === 'all' || radiusKm > 10)) {
                      onRadiusChange(3);
                    }
                  }}
                >
                  <Ionicons
                    name="navigate"
                    size={14}
                    color={!isGlobal ? '#050906' : theme.textWhite}
                  />
                  <Text
                    style={[
                      styles.modeSegmentText,
                      { color: !isGlobal ? '#050906' : theme.textWhite },
                    ]}
                  >
                    {isTamil ? 'உள்ளூர் (< 10 km)' : 'Local (< 10km)'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeToggleSegment,
                    isGlobal && [styles.modeToggleSegmentActive, { backgroundColor: theme.neonGreen }],
                  ]}
                  onPress={() => {
                    if (onToggleMarketMode) onToggleMarketMode('global');
                    if (onRadiusChange && (typeof radiusKm === 'number' && radiusKm <= 10)) {
                      onRadiusChange(100);
                    }
                  }}
                >
                  <Ionicons
                    name="bus"
                    size={14}
                    color={isGlobal ? '#050906' : theme.textWhite}
                  />
                  <Text
                    style={[
                      styles.modeSegmentText,
                      { color: isGlobal ? '#050906' : theme.textWhite },
                    ]}
                  >
                    {isTamil ? 'பேருந்து பார்சல் & கூரியர்' : 'Outstation / Pan-India'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Delivery Address Review */}
              <TouchableOpacity
                style={[
                  styles.addressPreviewBox,
                  {
                    backgroundColor: isDarkMode ? '#132018' : '#F8FAFC',
                    borderColor: theme.glassBorder,
                  },
                ]}
                onPress={() => {
                  setLocationFlowStep('select');
                  setIsLocationFlowOverlay(false);
                  setIsLocationFlowOpen(true);
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <View
                      style={{
                        backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.2)' : '#DCFCE7',
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '800', color: theme.neonGreen }}>
                        {userAddress?.tag || 'Home'}
                      </Text>
                    </View>
                    <Text style={[styles.addressBoxTitle, { color: theme.neonGreen }]}>
                      {isTamil ? 'தற்போதைய டெலிவரி முகவரி' : 'Current Delivery Address'}
                    </Text>
                  </View>
                  <Text style={[styles.addressBoxText, { color: theme.textWhite }]} numberOfLines={2}>
                    {displayAddress}
                  </Text>
                </View>
                <Ionicons name="create-outline" size={18} color={theme.neonGreen} />
              </TouchableOpacity>

              {/* Radius Presets (Mode-Aware: Local 1-10km vs Outstation Bus 50-200km) */}
              <View style={styles.radiusPresetSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={[styles.radiusPresetTitle, { color: isDarkMode ? '#A7F3D0' : '#15803D', marginBottom: 0 }]}>
                    {isGlobal
                      ? (isTamil ? 'தொலைதூர பேருந்து & கூரியர் சுற்றளவு' : 'Outstation Bus & Courier Radius')
                      : (isTamil ? 'உள்ளூர் டெலிவரி சுற்றளவு' : 'Local Delivery Radius')}
                  </Text>
                  <Text style={{ fontSize: 10.5, color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#64748B', fontWeight: '600' }}>
                    {isGlobal
                      ? (isTamil ? 'பேருந்து வழித்தடம் (50-200 km)' : 'Bus Depot (50-200 km)')
                      : (isTamil ? 'அதிவிரைவு 15-20 நிமிடம்' : 'Express 15-20 mins')}
                  </Text>
                </View>
                <View style={styles.radiusPillsRow}>
                  {(isGlobal ? globalRadiusOptions : localRadiusOptions).map(opt => {
                    const isSelected = radiusKm === opt.value;
                    return (
                      <TouchableOpacity
                        key={String(opt.value)}
                        style={[
                          styles.radiusPill,
                          {
                            backgroundColor: isSelected ? theme.neonGreen : (isDarkMode ? '#132018' : '#F1F5F9'),
                            borderColor: isSelected ? theme.neonGreen : theme.glassBorder,
                          },
                        ]}
                        onPress={() => {
                          if (onRadiusChange) onRadiusChange(opt.value);
                        }}
                      >
                        <Text
                          style={[
                            styles.radiusPillText,
                            { color: isSelected ? '#050906' : theme.textWhite },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* LAST ORDER TRACKING INTEGRATION (Only when order is actively in progress) */}
              {isOrderActive ? (
                <View style={styles.lastOrderSection}>
                  <View style={styles.lastOrderHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="flash" size={14} color={theme.neonGreen} />
                      <Text style={[styles.lastOrderSectionTitle, { color: theme.neonGreen }]}>
                        {isTamil ? 'நேரலை ஆர்டர் நிலை' : 'LIVE ORDER TRACKING'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.lastOrderActiveBadge,
                        {
                          backgroundColor: isDarkMode
                            ? 'rgba(34, 197, 94, 0.15)'
                            : 'rgba(22, 163, 74, 0.12)',
                        },
                      ]}
                    >
                      <View style={[styles.pulsingDot, { backgroundColor: theme.neonGreen }]} />
                      <Text style={[styles.lastOrderActiveBadgeText, { color: theme.neonGreen }]}>
                        {lastOrder.status || 'Active'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.lastOrderCard,
                      {
                        backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
                        borderColor: theme.glassBorder,
                      },
                    ]}
                    onPress={() => {
                      handleClosePanel();
                      if (onTrackOrder) {
                        onTrackOrder(lastOrder.orderId || lastOrder.id);
                      } else if (navigation) {
                        navigation.navigate('TrackOrderScreen', {
                          orderId: lastOrder.orderId || lastOrder.id,
                        });
                      }
                    }}
                  >
                    {/* Top Row: Order # & Time Left For Delivery Banner */}
                    <View style={styles.lastOrderTopRow}>
                      <View>
                        <Text
                          style={[
                            styles.lastOrderNumberLabel,
                            { color: isDarkMode ? '#A7F3D0' : '#475569' },
                          ]}
                        >
                          {isTamil ? 'ஆர்டர் எண்' : 'Order Number'}
                        </Text>
                        <Text style={[styles.lastOrderNumberValue, { color: theme.textWhite }]}>
                          #{lastOrder.orderId || lastOrder.id}
                        </Text>
                      </View>

                      {/* Prominent Estimated Time Left Banner */}
                      <View
                        style={[
                          styles.deliveryTimeLeftBanner,
                          {
                            backgroundColor: isDarkMode
                              ? 'rgba(34, 197, 94, 0.14)'
                              : 'rgba(22, 163, 74, 0.10)',
                            borderColor: theme.neonGreen,
                          },
                        ]}
                      >
                        <Ionicons name="time-outline" size={13} color={theme.neonGreen} />
                        <Text style={[styles.deliveryTimeLeftText, { color: theme.neonGreen }]}>
                          {deliveryCountdownInfo.text}
                        </Text>
                      </View>
                    </View>

                    {/* Mini Timeline Steps */}
                    <View style={styles.miniStepperContainer}>
                      {[
                        { key: 'placed', label: isTamil ? 'பதிவானது' : 'Placed' },
                        { key: 'packed', label: isTamil ? 'தயாரானது' : 'Packed' },
                        { key: 'transit', label: isTamil ? 'வழியில்' : 'On the way' },
                        { key: 'delivered', label: isTamil ? 'சேர்ந்தது' : 'Delivered' },
                      ].map((stepItem, sIdx) => {
                        const isDone = sIdx <= miniStepIndex;
                        const isCurrent = sIdx === miniStepIndex;
                        return (
                          <React.Fragment key={stepItem.key}>
                            <View style={styles.miniStepNode}>
                              <View
                                style={[
                                  styles.miniStepDot,
                                  isDone && {
                                    backgroundColor: theme.neonGreen,
                                    borderColor: theme.neonGreen,
                                  },
                                  isCurrent && styles.miniStepDotCurrent,
                                ]}
                              >
                                {isDone && !isCurrent ? (
                                  <Ionicons name="checkmark" size={10} color="#050906" />
                                ) : isCurrent ? (
                                  <View
                                    style={[
                                      styles.miniStepInnerCore,
                                      { backgroundColor: theme.neonGreen },
                                    ]}
                                  />
                                ) : null}
                              </View>
                              <Text
                                style={[
                                  styles.miniStepLabel,
                                  {
                                    color: isCurrent
                                      ? theme.neonGreen
                                      : isDone
                                      ? theme.textWhite
                                      : isDarkMode
                                      ? '#64748B'
                                      : '#94A3B8',
                                    fontWeight: isCurrent ? '700' : '500',
                                  },
                                ]}
                              >
                                {stepItem.label}
                              </Text>
                            </View>
                            {sIdx < 3 && (
                              <View
                                style={[
                                  styles.miniStepConnector,
                                  {
                                    backgroundColor:
                                      sIdx < miniStepIndex
                                        ? theme.neonGreen
                                        : isDarkMode
                                        ? '#223828'
                                        : '#E2E8F0',
                                  },
                                ]}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </View>

                    {/* Card Footer: Shop & Live Journey CTA */}
                    <View style={styles.lastOrderCardFooter}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          flex: 1,
                        }}
                      >
                        <Ionicons
                          name="storefront-outline"
                          size={13}
                          color={isDarkMode ? '#A7F3D0' : '#475569'}
                        />
                        <Text
                          style={[
                            styles.lastOrderShopName,
                            { color: isDarkMode ? '#A7F3D0' : '#475569' },
                          ]}
                          numberOfLines={1}
                        >
                          {lastOrderShopName} • {lastOrderItemCount}{' '}
                          {isTamil ? 'பொருட்கள்' : 'items'}
                        </Text>
                      </View>

                      <View style={styles.trackCtaBtn}>
                        <Text style={[styles.trackCtaBtnText, { color: theme.neonGreen }]}>
                          {isTamil ? 'கண்காணிக்க' : 'Track Live'}
                        </Text>
                        <Ionicons name="chevron-forward" size={13} color={theme.neonGreen} />
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>
          )}

          {/* PANEL 2: CART DROPDOWN */}
          {activePanel === 'cart' && (
            <View style={[styles.panelContent, { height: targetHeight }]}>
              <View style={styles.panelHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="cart" size={18} color={theme.neonGreen} />
                  <Text style={[styles.panelHeading, { color: theme.textWhite }]}>
                    {isTamil ? 'உங்கள் கார்ட்' : 'My Shopping Bag'} ({cartItemCount})
                  </Text>
                </View>
                <TouchableOpacity onPress={handleClosePanel}>
                  <Ionicons name="close" size={20} color={theme.textWhite} />
                </TouchableOpacity>
              </View>

              {cartItemsArray.length === 0 ? (
                <View style={[styles.emptyCartBox, { flex: 1, justifyContent: 'center', marginTop: -20 }]}>
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.12)' : 'rgba(22, 163, 74, 0.08)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <Ionicons name="cart-outline" size={34} color={theme.neonGreen} />
                  </View>
                  <Text style={[styles.emptyCartText, { color: theme.textWhite, fontSize: 16 }]}>
                    {isTamil ? 'கார்ட்டில் பொருட்கள் இல்லை' : 'Your bag is empty'}
                  </Text>
                  <Text style={[styles.emptyCartSub, { textAlign: 'center', maxWidth: 240, marginBottom: 18, marginTop: 4 }]}>
                    {isTamil ? 'உள்ளூர் கடைகளிலிருந்து புதிய பொருட்களைச் சேர்க்கவும்' : 'Add fresh items from nearby stores to get started'}
                  </Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: theme.neonGreen,
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 12,
                    }}
                    onPress={handleClosePanel}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="bag-handle-outline" size={16} color="#050906" />
                    <Text style={{ color: '#050906', fontWeight: '800', fontSize: 13 }}>
                      {isTamil ? 'ஷாப்பிங் தொடங்கவும்' : 'Start Shopping'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ flex: 1 }}>
                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                    {cartItemsArray.map(item => (
                      <View
                        key={item.id}
                        style={[
                          styles.cartItemRow,
                          {
                            backgroundColor: isDarkMode ? '#132018' : '#F8FAFC',
                            borderColor: theme.glassBorder,
                          },
                        ]}
                      >
                        <Image
                          source={{
                            uri:
                              item.img ||
                              item.image ||
                              'https://static.vecteezy.com/system/resources/previews/015/413/291/non_2x/shopping-trolley-full-of-food-fruit-products-grocery-goods-grocery-shopping-cart-buying-food-in-supermarket-illustration-for-banner-vector.jpg',
                          }}
                          style={styles.cartItemImage}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.cartItemName, { color: theme.textWhite }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.cartItemShop} numberOfLines={1}>
                            {item.shopName || 'Local Shop'}
                          </Text>
                          <Text style={[styles.cartItemPrice, { color: theme.neonGreen }]}>
                            ₹{Number(item.price || 0) * (Number(item.qty) || 1)}
                          </Text>
                        </View>

                        {/* Qty Stepper */}
                        <View style={styles.qtyStepper}>
                          <TouchableOpacity
                            style={[styles.qtyBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}
                            onPress={() => {
                              if (onUpdateCartQty) onUpdateCartQty(item.id, 'remove');
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="remove" size={18} color={theme.textWhite} />
                          </TouchableOpacity>
                          <Text style={[styles.qtyText, { color: theme.textWhite }]}>
                            {item.qty || 1}
                          </Text>
                          <TouchableOpacity
                            style={[styles.qtyBtn, { backgroundColor: theme.neonGreen }]}
                            onPress={() => {
                              if (onUpdateCartQty) onUpdateCartQty(item.id, 'add');
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="add" size={18} color="#050906" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </ScrollView>

                  <View style={styles.cartFooter}>
                    <View style={styles.cartTotalRow}>
                      <Text style={[styles.cartTotalLabel, { color: theme.textWhite }]}>
                        {isTamil ? 'மொத்தம்' : 'Subtotal'}:
                      </Text>
                      <Text style={[styles.cartTotalValue, { color: theme.neonGreen }]}>
                        ₹{cartTotal}
                      </Text>
                    </View>

                    {/* Expand to Full Page Checkout Button */}
                    <TouchableOpacity
                      style={[styles.checkoutBtn, { backgroundColor: theme.neonGreen }]}
                      onPress={handleExpandToCheckout}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.checkoutBtnText}>
                        {isTamil ? 'செக்அவுட் தொடரவும்' : 'Proceed to Checkout'}
                      </Text>
                      <Ionicons name="arrow-forward" size={16} color="#050906" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* PANEL 3: UNIFIED CATEGORIES & FILTERS (CATEGORIES | SORT | TYPE | PRICE) */}
          {activePanel === 'categories' && (
            <View style={styles.panelContent}>
              {/* Header with Title, Clear All & Close Button */}
              <View style={styles.panelHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="options-outline" size={18} color={theme.neonGreen} />
                  <Text style={[styles.panelHeading, { color: theme.textWhite }]}>
                    {isTamil ? 'பிரிவுகள் & வடிகட்டிகள்' : 'Categories & Filters'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {activeFilterCount > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        if (onSelectCategory) onSelectCategory(null);
                        if (onSortChange) onSortChange('popular');
                        if (onSelectType) onSelectType('all');
                        if (onSelectPriceRange) onSelectPriceRange('all');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.clearAllBtnText, { color: theme.neonGreen }]}>
                        {isTamil ? 'நீக்கு' : 'Clear All'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={handleClosePanel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={20} color={theme.textWhite} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sub-tabs: Categories | Sort | Type | Price */}
              <View style={[styles.filterSubTabsRow, { backgroundColor: isDarkMode ? '#132018' : '#F1F5F9' }]}>
                {[
                  { key: 'categories', label: isTamil ? 'பிரிவுகள்' : 'Categories', icon: 'grid-outline', active: !!selectedCategory },
                  { key: 'sort', label: isTamil ? 'வரிசை' : 'Sort', icon: 'swap-vertical', active: sortBy && sortBy !== 'popular' },
                  { key: 'type', label: isTamil ? 'வகை' : 'Type', icon: 'leaf-outline', active: selectedType && selectedType !== 'all' },
                  { key: 'price', label: isTamil ? 'விலை' : 'Price', icon: 'cash-outline', active: priceRange && priceRange !== 'all' },
                ].map(tab => {
                  const isTabActive = categoriesTab === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      style={[
                        styles.filterSubTabBtn,
                        isTabActive && [
                          styles.filterSubTabBtnActive,
                          { backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.2)' : '#DCFCE7' },
                        ],
                      ]}
                      onPress={() => setCategoriesTab(tab.key)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={tab.icon}
                        size={12}
                        color={isTabActive ? theme.neonGreen : (isDarkMode ? '#94A3B8' : '#64748B')}
                      />
                      <Text
                        style={[
                          styles.filterSubTabText,
                          { color: isTabActive ? theme.neonGreen : (isDarkMode ? '#94A3B8' : '#64748B') },
                          isTabActive && { fontWeight: '800' },
                        ]}
                      >
                        {tab.label}
                      </Text>
                      {tab.active && (
                        <View style={[styles.subTabActiveDot, { backgroundColor: theme.neonGreen }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* SUBTAB 1: CATEGORIES GRID */}
              {categoriesTab === 'categories' && (
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
                  <View style={styles.categoriesGrid}>
                    <TouchableOpacity
                      style={[
                        styles.categoryCard,
                        {
                          backgroundColor: isDarkMode ? '#132018' : '#F1F5F9',
                          borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                        },
                        selectedCategory === null && [
                          styles.categoryCardActive,
                          { borderColor: theme.neonGreen, backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.12)' : '#DCFCE7' },
                        ],
                      ]}
                      onPress={() => {
                        if (onSelectCategory) onSelectCategory(null);
                        handleClosePanel();
                      }}
                    >
                      <Ionicons name="apps" size={20} color={theme.neonGreen} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.categoryCardName, { color: theme.textWhite }]} numberOfLines={1}>
                          {isTamil ? 'அனைத்தும்' : 'All Categories'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {categories.map(cat => {
                      const isSelected = selectedCategory?.id === cat.id;
                      const displayName = isTamil && cat.nameTa ? cat.nameTa : (cat.shortName || cat.name);
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.categoryCard,
                            {
                              backgroundColor: isDarkMode ? '#132018' : '#F1F5F9',
                              borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                            },
                            isSelected && [
                              styles.categoryCardActive,
                              { borderColor: theme.neonGreen, backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.12)' : '#DCFCE7' },
                            ],
                          ]}
                          onPress={() => {
                            if (onSelectCategory) onSelectCategory(isSelected ? null : cat);
                            handleClosePanel();
                          }}
                        >
                          <Ionicons
                            name={cat.icon || 'pricetag-outline'}
                            size={19}
                            color={isSelected ? theme.neonGreen : (isDarkMode ? '#34D399' : '#15803D')}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.categoryCardName, { color: theme.textWhite }]} numberOfLines={1}>
                              {displayName}
                            </Text>
                          </View>
                          {cat.count !== undefined && cat.count > 0 && (
                            <View
                              style={{
                                backgroundColor: isSelected
                                  ? (isDarkMode ? 'rgba(34, 197, 94, 0.25)' : '#BBF7D0')
                                  : (isDarkMode ? 'rgba(255,255,255,0.08)' : '#E2E8F0'),
                                paddingHorizontal: 6,
                                paddingVertical: 1,
                                borderRadius: 8,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: '700',
                                  color: isSelected ? theme.neonGreen : (isDarkMode ? '#94A3B8' : '#64748B'),
                                }}
                              >
                                {cat.count}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              {/* SUBTAB 2: SORT OPTIONS */}
              {categoriesTab === 'sort' && (
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
                  {[
                    { key: 'popular', label: 'Popular & Recommended', labelTa: 'பிரபலமானவை', icon: 'flame-outline' },
                    { key: 'price_asc', label: 'Price: Low to High', labelTa: 'விலை: குறைவிலிருந்து அதிகம்', icon: 'trending-up-outline' },
                    { key: 'price_desc', label: 'Price: High to Low', labelTa: 'விலை: அதிகத்திலிருந்து குறைவு', icon: 'trending-down-outline' },
                    { key: 'rating', label: 'Customer Rating (4★+)', labelTa: 'வாடிக்கையாளர் மதிப்பீடு', icon: 'star-outline' },
                  ].map(opt => {
                    const isOptSelected = sortBy === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.filterOptionRow,
                          isOptSelected && { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
                        ]}
                        onPress={() => {
                          if (onSortChange) onSortChange(opt.key);
                          handleClosePanel();
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Ionicons name={opt.icon} size={18} color={isOptSelected ? '#10B981' : '#9CA3AF'} />
                          <Text style={[styles.filterOptionText, { color: isOptSelected ? '#10B981' : theme.textWhite }]}>
                            {isTamil ? opt.labelTa : opt.label}
                          </Text>
                        </View>
                        {isOptSelected && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* SUBTAB 3: TYPE OPTIONS */}
              {categoriesTab === 'type' && (
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
                  {[
                    { key: 'all', label: 'All Products', labelTa: 'அனைத்து பொருட்கள்', icon: 'grid-outline' },
                    { key: 'veg', label: '100% Pure Vegetarian', labelTa: '100% தூய சைவம்', icon: 'leaf-outline' },
                    { key: 'organic', label: 'Organic & Farm Fresh', labelTa: 'இயற்கை விவசாய பொருட்கள்', icon: 'nutrition-outline' },
                    { key: 'local', label: 'Nearby Store Exclusives', labelTa: 'உள்ளூர் கடை சிறப்புகள்', icon: 'storefront-outline' },
                  ].map(opt => {
                    const isOptSelected = selectedType === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.filterOptionRow,
                          isOptSelected && { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
                        ]}
                        onPress={() => {
                          if (onSelectType) onSelectType(opt.key);
                          handleClosePanel();
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Ionicons name={opt.icon} size={18} color={isOptSelected ? '#10B981' : '#9CA3AF'} />
                          <Text style={[styles.filterOptionText, { color: isOptSelected ? '#10B981' : theme.textWhite }]}>
                            {isTamil ? opt.labelTa : opt.label}
                          </Text>
                        </View>
                        {isOptSelected && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* SUBTAB 4: PRICE OPTIONS */}
              {categoriesTab === 'price' && (
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
                  {[
                    { key: 'all', label: 'All Price Ranges', labelTa: 'அனைத்து விலைகள்', icon: 'cash-outline' },
                    { key: 'under_50', label: 'Under ₹50 (Daily Essentials)', labelTa: '₹50 க்குள் (அத்தியாவசியங்கள்)', icon: 'wallet-outline' },
                    { key: '50_150', label: '₹50 to ₹150 (Popular Picks)', labelTa: '₹50 முதல் ₹150 வரை', icon: 'cart-outline' },
                    { key: 'above_150', label: '₹150 & Above (Exotics & Packs)', labelTa: '₹150 மற்றும் அதற்கு மேல்', icon: 'ribbon-outline' },
                  ].map(opt => {
                    const isOptSelected = priceRange === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.filterOptionRow,
                          isOptSelected && { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
                        ]}
                        onPress={() => {
                          if (onSelectPriceRange) onSelectPriceRange(opt.key);
                          handleClosePanel();
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Ionicons name={opt.icon} size={18} color={isOptSelected ? '#10B981' : '#9CA3AF'} />
                          <Text style={[styles.filterOptionText, { color: isOptSelected ? '#10B981' : theme.textWhite }]}>
                            {isTamil ? opt.labelTa : opt.label}
                          </Text>
                        </View>
                        {isOptSelected && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}
        </Animated.View>
      )}

      {/* EXPRESS CHECKOUT FULL-PAGE MODAL (Cleanly merged with home screen UI, guaranteed uncropped) */}
      <Modal
        visible={isCheckoutExpanded}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={handleCollapseCheckout}
      >
        <SafeAreaView
          edges={['top', 'left', 'right', 'bottom']}
          style={[
            styles.checkoutModalContainer,
            { backgroundColor: isDarkMode ? '#080E0A' : '#F8FAFC' },
          ]}
        >
          {/* Unified Header */}
          <View
            style={[
              styles.checkoutModalHeader,
              {
                backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <TouchableOpacity
              style={styles.backToCartBtn}
              onPress={handleCollapseCheckout}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color={theme.neonGreen} />
              <Text style={[styles.backToCartText, { color: theme.neonGreen }]}>
                {isTamil ? 'கார்ட்' : 'Back to Cart'}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.checkoutModalTitle, { color: theme.textWhite }]}>
              {isTamil ? 'ஆர்டர் சரிபார்ப்பு' : 'Express Checkout'}
            </Text>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => {
                setIsCheckoutExpanded(false);
                handleClosePanel();
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={22} color={theme.textWhite} />
            </TouchableOpacity>
          </View>

          {/* Checkout Body */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.checkoutModalScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Delivery Address Box */}
            <View
              style={[
                styles.checkoutSectionCard,
                {
                  backgroundColor: isDarkMode ? '#132018' : '#FFFFFF',
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <View style={styles.checkoutSectionTitleRow}>
                <Ionicons name="location" size={17} color={theme.neonGreen} />
                <Text style={[styles.checkoutCardTitle, { color: theme.neonGreen }]}>
                  {isTamil ? 'டெலிவரி முகவரி' : 'Delivery Address'}
                </Text>
                <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setLocationFlowStep('add_details');
                      setIsLocationFlowOverlay(true);
                      setIsLocationFlowOpen(true);
                    }}
                  >
                    <Text style={{ color: theme.neonGreen, fontSize: 12, fontWeight: '700' }}>
                      {isTamil ? '+ விவரம் சேர்' : '+ Edit Details'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setLocationFlowStep('select');
                      setIsLocationFlowOverlay(true);
                      setIsLocationFlowOpen(true);
                    }}
                  >
                    <Text style={{ color: theme.neonGreen, fontSize: 12, fontWeight: '700' }}>
                      {isTamil ? 'மாற்று' : 'Change'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tag & Receiver summary */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 4 }}>
                <View
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.2)' : '#DCFCE7',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: theme.neonGreen }}>
                    {userAddress?.tag || 'Home'}
                  </Text>
                </View>
                {userAddress?.receiverName && (
                  <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? '#E2E8F0' : '#1E293B' }}>
                    {userAddress.receiverName} • {userAddress.receiverPhone || '9442461428'}
                  </Text>
                )}
              </View>

              <Text style={[styles.checkoutCardText, { color: theme.textWhite }]} numberOfLines={2}>
                {displayAddress}
              </Text>
            </View>

            {/* Hyperlocal Express Delivery Guarantee Pill */}
            <View
              style={[
                styles.deliveryGuaranteePill,
                {
                  backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.08)' : 'rgba(22, 163, 74, 0.06)',
                  borderColor: theme.glassBorder,
                  marginBottom: 12,
                },
              ]}
            >
              <Ionicons name="flash" size={15} color={theme.neonGreen} />
              <Text style={[styles.deliveryGuaranteeText, { color: theme.neonGreen }]}>
                {isGlobal
                  ? (isTamil ? '⚡ அகில இந்திய எக்ஸ்பிரஸ் கூரியர் (2-3 நாட்கள்)' : '⚡ Pan-India Express Courier (2-3 Days)')
                  : (isTamil ? '⚡ 15-20 நிமிட அதிவிரைவு உள்ளூர் டெலிவரி செயலில் உள்ளது' : '⚡ 15-20 Mins Hyperlocal Express Delivery Active')}
              </Text>
            </View>

            {/* Delivery Instructions */}
            <View
              style={[
                styles.checkoutSectionCard,
                {
                  backgroundColor: isDarkMode ? '#132018' : '#FFFFFF',
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <Text style={[styles.checkoutCardTitle, { color: theme.textWhite, marginBottom: 10 }]}>
                {isTamil ? 'டெலிவரி வழிமுறைகள்' : 'Delivery Instructions'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { id: 'door', label: isTamil ? '🚪 வாசலில்' : '🚪 Door' },
                  { id: 'call', label: isTamil ? '📞 அழைக்கவும்' : '📞 Call First' },
                  { id: 'bell', label: isTamil ? '🔕 மணி' : '🔕 Ring Bell' },
                ].map(ins => (
                  <TouchableOpacity
                    key={ins.id}
                    style={[
                      styles.insChip,
                      {
                        backgroundColor: isDarkMode ? '#0E1710' : '#F1F5F9',
                        borderColor: theme.glassBorder,
                      },
                      deliveryInstruction === ins.id && [
                        styles.insChipActive,
                        { backgroundColor: theme.neonGreen, borderColor: theme.neonGreen },
                      ],
                    ]}
                    onPress={() => setDeliveryInstruction(ins.id)}
                  >
                    <Text
                      style={[
                        styles.insChipText,
                        { color: deliveryInstruction === ins.id ? '#050906' : theme.textWhite },
                      ]}
                    >
                      {ins.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Payment Options */}
            <View
              style={[
                styles.checkoutSectionCard,
                {
                  backgroundColor: isDarkMode ? '#132018' : '#FFFFFF',
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <Text style={[styles.checkoutCardTitle, { color: theme.textWhite, marginBottom: 10 }]}>
                {isTamil ? 'பணம் செலுத்தும் முறை' : 'Payment Method'}
              </Text>
              {['UPI', 'COD', 'Card'].map(pm => (
                <TouchableOpacity
                  key={pm}
                  style={[
                    styles.pmOption,
                    {
                      backgroundColor: isDarkMode ? '#0E1710' : '#F8FAFC',
                      borderColor: theme.glassBorder,
                    },
                    checkoutPaymentMethod === pm && [
                      styles.pmOptionActive,
                      { borderColor: theme.neonGreen, backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.12)' : '#DCFCE7' },
                    ],
                  ]}
                  onPress={() => setCheckoutPaymentMethod(pm)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={
                      checkoutPaymentMethod === pm
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={19}
                    color={checkoutPaymentMethod === pm ? theme.neonGreen : '#94A3B8'}
                  />
                  <Text style={[styles.pmOptionText, { color: theme.textWhite, flex: 1, marginLeft: 10 }]}>
                    {pm === 'UPI' ? 'UPI (Google Pay, PhonePe, Paytm)' : pm === 'COD' ? (isTamil ? 'பொருளை பெற்ற பின் ரொக்கம் (COD)' : 'Cash on Delivery (COD)') : 'Credit / Debit Card'}
                  </Text>
                  {pm === 'UPI' && (
                    <View style={[styles.instantTag, { backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.18)' : '#BBF7D0' }]}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: theme.neonGreen }}>INSTANT</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Coupon Box */}
            <View
              style={[
                styles.checkoutSectionCard,
                {
                  backgroundColor: isDarkMode ? '#132018' : '#FFFFFF',
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[
                    styles.couponInput,
                    {
                      color: theme.textWhite,
                      backgroundColor: isDarkMode ? '#0E1710' : '#F1F5F9',
                      borderColor: theme.glassBorder,
                    },
                  ]}
                  placeholder="Coupon (e.g. KADAI50)"
                  placeholderTextColor="#94A3B8"
                  value={couponCode}
                  onChangeText={setCouponCode}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={[styles.applyCouponBtn, { backgroundColor: theme.neonGreen }]}
                  onPress={handleApplyCoupon}
                  activeOpacity={0.8}
                >
                  <Text style={styles.applyCouponBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>
              {couponMsg ? (
                <Text style={[styles.couponMsg, { color: appliedDiscount > 0 ? theme.neonGreen : '#EF4444' }]}>
                  {couponMsg}
                </Text>
              ) : null}
            </View>

            {/* Bill Summary */}
            <View
              style={[
                styles.checkoutSectionCard,
                {
                  backgroundColor: isDarkMode ? '#132018' : '#FFFFFF',
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <Text style={[styles.checkoutCardTitle, { color: theme.textWhite, marginBottom: 8 }]}>
                {isTamil ? 'கட்டண விவரம்' : 'Bill Summary'}
              </Text>
              <View style={styles.billRow}>
                <Text style={{ color: '#94A3B8', fontSize: 13.5 }}>Items Total</Text>
                <Text style={{ color: theme.textWhite, fontSize: 13.5, fontWeight: '600' }}>₹{cartTotal}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={{ color: '#94A3B8', fontSize: 13.5 }}>Delivery Fee</Text>
                <Text style={{ color: theme.neonGreen, fontSize: 13.5, fontWeight: '700' }}>
                  {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                </Text>
              </View>
              <View style={styles.billRow}>
                <Text style={{ color: '#94A3B8', fontSize: 13.5 }}>Platform Fee</Text>
                <Text style={{ color: theme.textWhite, fontSize: 13.5 }}>₹{platformFee}</Text>
              </View>
              {appliedDiscount > 0 && (
                <View style={styles.billRow}>
                  <Text style={{ color: '#EF4444', fontSize: 13.5, fontWeight: '600' }}>Coupon Discount</Text>
                  <Text style={{ color: '#EF4444', fontSize: 13.5, fontWeight: '700' }}>-₹{appliedDiscount}</Text>
                </View>
              )}
              <View style={[styles.billRow, { borderTopWidth: 1, borderTopColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', paddingTop: 10, marginTop: 6 }]}>
                <Text style={{ color: theme.textWhite, fontSize: 16, fontWeight: '800' }}>
                  {isTamil ? 'மொத்தம் செலுத்த வேண்டியது' : 'To Pay'}
                </Text>
                <Text style={{ color: theme.neonGreen, fontSize: 20, fontWeight: '900' }}>
                  ₹{finalPayable}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* STICKY BOTTOM ACTION BAR - 100% VISIBLE, SAFE BOTTOM INSET, NEVER CROPPED */}
          <View
            style={[
              styles.checkoutModalFooter,
              {
                backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                borderTopColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <View style={styles.stickyPriceCol}>
              <Text style={[styles.stickyPriceLabel, { color: '#94A3B8' }]}>
                {isTamil ? 'செலுத்த வேண்டியது' : 'To Pay'}
              </Text>
              <Text style={[styles.stickyPriceValue, { color: theme.neonGreen }]}>
                ₹{finalPayable}
              </Text>
              <Text style={[styles.stickyPayMethodText, { color: isDarkMode ? '#6EE7B7' : '#059669' }]}>
                {checkoutPaymentMethod === 'UPI'
                  ? 'UPI Instant'
                  : checkoutPaymentMethod === 'COD'
                  ? 'Cash on Delivery'
                  : 'Card'}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.stickyPlaceOrderBtn,
                { backgroundColor: theme.neonGreen },
                orderPlacing && { opacity: 0.7 },
              ]}
              onPress={handlePlaceOrderSubmit}
              disabled={orderPlacing}
              activeOpacity={0.85}
            >
              {orderPlacing ? (
                <ActivityIndicator size="small" color="#050906" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={19} color="#050906" />
                  <Text style={styles.stickyPlaceOrderBtnText}>
                    {isTamil ? 'ஆர்டர் செய்க ›' : 'Place Order ›'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Overlay Delivery Location Flow Modal (renders cleanly inside checkout modal without native modal conflict) */}
          {isLocationFlowOverlay && isLocationFlowOpen && (
            <DeliveryLocationFlowModal
              visible={isLocationFlowOpen}
              initialStep={locationFlowStep}
              onClose={() => setIsLocationFlowOpen(false)}
              activeLocation={userAddress}
              onSelectLocation={newLoc => {
                if (onUpdateLocation) onUpdateLocation(newLoc);
              }}
              userId={userId}
              language={language}
              isDarkMode={isDarkMode}
              overlayMode={true}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Root Delivery Location Flow Modal (used from Home Screen / Location Chooser Capsule) */}
      {!isLocationFlowOverlay && isLocationFlowOpen && (
        <DeliveryLocationFlowModal
          visible={isLocationFlowOpen}
          initialStep={locationFlowStep}
          onClose={() => setIsLocationFlowOpen(false)}
          activeLocation={userAddress}
          onSelectLocation={newLoc => {
            if (activePanel === 'location') {
              handleClosePanel();
            }
            if (onUpdateLocation) onUpdateLocation(newLoc);
          }}
          userId={userId}
          language={language}
          isDarkMode={isDarkMode}
          overlayMode={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerOuter: {
    paddingHorizontal: 10,
    paddingTop: Platform.OS === 'ios' ? 4 : 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#050906',
    fontSize: 10,
    fontWeight: '900',
  },
  centerLocationPill: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pillTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  pillSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
    overflow: 'hidden',
  },
  pillAddressWrapper: {
    flex: 1,
    flexShrink: 1,
  },
  pillPrefix: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  pillTagText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  pillAddress: {
    fontSize: 10.5,
  },
  rightButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterBarContainer: {
    position: 'relative',
    width: '100%',
    height: 38,
    marginTop: 5,
    zIndex: 50,
  },
  trackingBackdrop: {
    position: 'absolute',
    top: -100,
    left: 0,
    right: 0,
    bottom: -800,
    zIndex: 80,
  },
  categoriesPillWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 38,
    alignSelf: 'flex-start',
    zIndex: 60,
  },
  matchingGlassPill: {
    height: 38,
    borderRadius: 19,
    borderWidth: 1.2,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2.5,
    elevation: 2,
  },
  pillLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchingPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  filterBadgeCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
    marginRight: 2,
  },
  filterBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#050906',
  },
  trackingMorphCard: {
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100,
    borderWidth: 1.2,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 12,
    overflow: 'hidden',
  },
  trackingCompactRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 38,
    justifyContent: 'center',
  },
  trackingCompactTouchable: {
    flex: 1,
    height: 38,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackingCompactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 4,
  },
  trackingPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: '#10B981',
    marginLeft: 5,
    flexShrink: 1,
  },
  trackingExpandedCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    paddingHorizontal: 12,
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
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  collapseBtn: {
    padding: 2,
  },
  expandedHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  expandedEtaHeadline: {
    fontSize: 13.5,
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
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
  },
  expandedTrackBtnText: {
    color: '#050906',
    fontSize: 11.5,
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
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 9.5,
    marginTop: 2,
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginBottom: 10,
    marginHorizontal: -2,
  },
  multiOrdersScroll: {
    flex: 1,
    marginTop: 8,
  },
  multiOrdersScrollContent: {
    paddingBottom: 4,
    gap: 8,
  },
  multiOrderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  multiStoreIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  multiOrderInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  multiOrderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  multiStoreName: {
    fontSize: 12.5,
    fontWeight: '800',
    flex: 1,
    marginRight: 6,
  },
  multiOrderPrice: {
    fontSize: 12,
    fontWeight: '800',
  },
  multiOrderBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  multiStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    marginRight: 6,
  },
  miniStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  multiStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  multiOrderSubMeta: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  multiTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  multiTrackBtnText: {
    color: '#050906',
    fontSize: 11,
    fontWeight: '800',
  },
  liveTrackingIconWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarPulseRing: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.2,
  },
  liveBeaconCore: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSubTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
    gap: 4,
  },
  filterSubTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 9,
    gap: 4,
  },
  filterSubTabBtnActive: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  filterSubTabText: {
    fontSize: 11,
    fontWeight: '600',
  },
  subTabActiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  clearAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveStatusBadgeWrap: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  liveStepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 10,
  },
  stepperDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
    marginBottom: 14,
  },
  trackLiveActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  trackLiveActionBtnText: {
    color: '#050906',
    fontSize: 12.5,
    fontWeight: '800',
  },
  filterChipsRow: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  filterChipsScroll: {
    gap: 8,
    paddingHorizontal: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18241D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  filterChipActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  filterChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchBarBox: {
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginVertical: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 0,
  },
  aiVoiceBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  dropdownContainer: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  panelContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  panelHeading: {
    fontSize: 15,
    fontWeight: '800',
  },
  modeToggleTrack: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  modeToggleSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  modeToggleSegmentActive: {},
  modeSegmentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addressPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  addressBoxTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  addressBoxText: {
    fontSize: 12,
  },
  radiusPresetSection: {
    marginTop: 4,
  },
  radiusPresetTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  radiusPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCartBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyCartText: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyCartSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 9,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 6,
  },
  cartItemImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: '700',
  },
  cartItemShop: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  cartItemPrice: {
    fontSize: 13.5,
    fontWeight: '800',
    marginTop: 2,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '800',
    minWidth: 22,
    textAlign: 'center',
  },
  cartFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 10,
    marginTop: 6,
  },
  cartTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cartTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  cartTotalValue: {
    fontSize: 17,
    fontWeight: '900',
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  checkoutBtnText: {
    color: '#050906',
    fontSize: 13.5,
    fontWeight: '800',
  },
  backToCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backToCartText: {
    fontSize: 12,
    fontWeight: '600',
  },
  checkoutSectionCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  checkoutCardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  checkoutCardText: {
    fontSize: 12,
  },
  insChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  insChipActive: {},
  insChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pmOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  pmOptionActive: {},
  pmOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  couponInput: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    fontSize: 12,
  },
  applyCouponBtn: {
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyCouponBtnText: {
    color: '#050906',
    fontSize: 12,
    fontWeight: '700',
  },
  couponMsg: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  placeOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  placeOrderBtnText: {
    color: '#050906',
    fontSize: 15,
    fontWeight: '800',
  },
  stickyCheckoutFooter: {
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    marginHorizontal: -12,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 10,
  },
  stickyPriceCol: {
    flex: 1,
    justifyContent: 'center',
  },
  stickyPriceLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stickyPriceValue: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  stickyPayMethodText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  stickyPlaceOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  stickyPlaceOrderBtnText: {
    color: '#050906',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  lastOrderSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(34, 197, 94, 0.18)',
    paddingTop: 9,
  },
  lastOrderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  lastOrderSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  lastOrderActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  lastOrderActiveBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  lastOrderCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  lastOrderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  lastOrderNumberLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lastOrderNumberValue: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  deliveryTimeLeftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
  },
  deliveryTimeLeftText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  miniStepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    marginBottom: 7,
  },
  miniStepNode: {
    alignItems: 'center',
    width: 58,
  },
  miniStepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  miniStepDotCurrent: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  miniStepInnerCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  miniStepLabel: {
    fontSize: 9.5,
    textAlign: 'center',
  },
  miniStepConnector: {
    flex: 1,
    height: 2,
    marginBottom: 16,
    marginHorizontal: -4,
  },
  lastOrderCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
    marginTop: 3,
  },
  lastOrderShopName: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  trackCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trackCtaBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  deliveryGuaranteePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 10,
  },
  deliveryGuaranteeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  serviceInfoSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(34, 197, 94, 0.18)',
    paddingTop: 9,
  },
  serviceInfoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  serviceInfoTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  serviceInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  serviceInfoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  serviceInfoCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceTilesRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  serviceTile: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTileIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  serviceTileTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  serviceTileSub: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 1,
  },
  serviceNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  serviceNoticeText: {
    fontSize: 9.5,
    fontWeight: '500',
    flex: 1,
    lineHeight: 13,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  categoryCardActive: {},
  categoryCardName: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  checkoutModalContainer: {
    flex: 1,
  },
  checkoutModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  checkoutModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modalCloseBtn: {
    padding: 4,
  },
  checkoutModalScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
  },
  checkoutSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  checkoutModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 12,
  },
  instantTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
});
