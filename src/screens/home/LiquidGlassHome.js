import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  useColorScheme,
  Alert,
  LogBox,
} from 'react-native';

// Suppress LogBox warning toast banner on app launch and runtime
LogBox.ignoreAllLogs();
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AuthContext } from '../../context/AuthContext';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  setDoc,
  deleteDoc,
} from '@react-native-firebase/firestore';
import { getAuth, signOut } from '@react-native-firebase/auth';

import { LiquidGlassHeader } from '../../components/liquidGlass/LiquidGlassHeader';
import { StoreSidebarRail, DEFAULT_RAIL_CATEGORIES } from '../../components/liquidGlass/StoreSidebarRail';
import { TopShopsCarousel } from '../../components/liquidGlass/TopShopsCarousel';
import { ProductCompareModal } from '../../components/liquidGlass/ProductCompareModal';
import { AccountsModal } from '../../components/liquidGlass/AccountsModal';
import { AnimatedSplashScreen } from '../../components/liquidGlass/AnimatedSplashScreen';
import { TEXTURED_DARK, TEXTURED_LIGHT } from '../../components/liquidGlass/theme';
import { triggerHaptic } from '../../components/liquidGlass/safeHaptics';
import {
  calculateDistance,
  getSellerCoordinates,
  detectUserLocation,
  getCachedLocation,
  saveActiveLocation,
  DEFAULT_USER_LOCATION,
  normalizeAddressPayload,
} from '../../services/locationService';

const { width } = Dimensions.get('window');

// Curated default products matching Zepto/Blinkit split reference screenshot
const CURATED_DEFAULT_PRODUCTS = [
  {
    id: 'prod_strawberry_01',
    name: 'Premium Ooty Strawberry',
    nameTa: 'ஊட்டி ஸ்ட்ராபெரி',
    price: 189,
    mrp: 245,
    unit: '180 g',
    stockCount: '4 left',
    rating: 4.8,
    category: 'fruits',
    isVeg: true,
    isOrganic: true,
    shopName: 'Fresh Farms Ooty',
    img: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=400&q=80',
    storePrices: [{ shopId: 's1', shopName: 'Fresh Farms', price: 189, inStock: true, distanceKm: '1.2' }],
  },
  {
    id: 'prod_persimmon_02',
    name: 'Persimmon',
    nameTa: 'பெர்சிமன் பழம்',
    price: 121,
    mrp: 143,
    unit: '250 g',
    pieces: '2 pcs',
    stockCount: '2 left',
    rating: 4.6,
    category: 'fruits',
    isVeg: true,
    isOrganic: false,
    shopName: 'Hilltop Exotics',
    img: 'https://images.unsplash.com/photo-1598025362874-49480e049c76?auto=format&fit=crop&w=400&q=80',
    storePrices: [{ shopId: 's1', shopName: 'Hilltop Exotics', price: 121, inStock: true, distanceKm: '1.4' }],
  },
  {
    id: 'prod_guava_03',
    name: 'Thai Guava (Perakka)',
    nameTa: 'தாய் கொய்யா (பேரக்கா)',
    price: 120,
    mrp: 154,
    unit: '400 g',
    pieces: '2 pcs',
    stockCount: '5 left',
    rating: 4.7,
    category: 'fruits',
    isVeg: true,
    isOrganic: true,
    shopName: 'Namma Oor Thottam',
    img: 'https://images.unsplash.com/photo-1536511135899-73899f848c8a?auto=format&fit=crop&w=400&q=80',
    storePrices: [{ shopId: 's2', shopName: 'Namma Oor Thottam', price: 120, inStock: true, distanceKm: '0.8' }],
  },
  {
    id: 'prod_coconut_04',
    name: 'Brown Coconut (Naalikeram)',
    nameTa: 'தேங்காய் (நாளிகேரம்)',
    price: 49,
    mrp: 56,
    unit: '1 pc',
    stockCount: '8 left',
    rating: 4.9,
    category: 'fruits',
    isVeg: true,
    isOrganic: true,
    shopName: 'Pollachi Coconut Mandi',
    img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80',
    storePrices: [{ shopId: 's3', shopName: 'Pollachi Mandi', price: 49, inStock: true, distanceKm: '1.6' }],
  },
  {
    id: 'prod_shallots_05',
    name: 'Shallots (Sambar Vengayam)',
    nameTa: 'சாம்பார் சின்ன வெங்காயம்',
    price: 58,
    mrp: 70,
    unit: '500 g',
    stockCount: '6 left',
    rating: 4.8,
    category: 'veg',
    isVeg: true,
    isOrganic: false,
    shopName: 'Udumalpet Farmers',
    img: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=400&q=80',
    storePrices: [{ shopId: 's2', shopName: 'Udumalpet Farmers', price: 58, inStock: true, distanceKm: '1.1' }],
  },
  {
    id: 'prod_coriander_06',
    name: 'Fresh Coriander (Kothamalli)',
    nameTa: 'நாட்டு கொத்தமல்லி தழை',
    price: 18,
    mrp: 25,
    unit: '1 bunch',
    stockCount: '10 left',
    rating: 4.5,
    category: 'herbs',
    isVeg: true,
    isOrganic: true,
    shopName: 'Green Leaves Depot',
    img: 'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?auto=format&fit=crop&w=400&q=80',
    storePrices: [{ shopId: 's1', shopName: 'Green Leaves', price: 18, inStock: true, distanceKm: '0.9' }],
  },
  {
    id: 'prod_banana_07',
    name: 'Robusta Ripe Bananas',
    nameTa: 'ரோபஸ்டா வாழைப்பழம்',
    price: 38,
    mrp: 48,
    unit: '1 kg',
    pieces: '5-6 pcs',
    stockCount: '12 left',
    rating: 4.8,
    category: 'fruits',
    isVeg: true,
    isOrganic: false,
    shopName: 'Trichy Fruits Mart',
    img: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=400&q=80',
    storePrices: [{ shopId: 's3', shopName: 'Trichy Mart', price: 38, inStock: true, distanceKm: '1.5' }],
  },
  {
    id: 'prod_watermelon_08',
    name: 'Seedless Watermelon',
    nameTa: 'தர்பூசணி',
    price: 65,
    mrp: 85,
    unit: '1 pc (approx 2kg)',
    stockCount: '3 left',
    rating: 4.6,
    category: 'seasonal',
    isVeg: true,
    isOrganic: true,
    shopName: 'Summer Delights',
    img: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=400&q=80',
    storePrices: [{ shopId: 's2', shopName: 'Summer Delights', price: 65, inStock: true, distanceKm: '1.0' }],
  },
];

export default function LiquidGlassHome({ navigation }) {
  const db = getFirestore();
  const authInstance = getAuth();
  const { user, customerData } = useContext(AuthContext);

  // Theme & Language
  const systemColorScheme = useColorScheme(); // 'light' | 'dark' | null | undefined
  const [themePreference, setThemePreference] = useState('system'); // 'system' | 'light' | 'dark'

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem('@kadai_theme_preference')
      .then(savedPref => {
        if (isMounted && savedPref && ['system', 'light', 'dark'].includes(savedPref)) {
          setThemePreference(savedPref);
        }
      })
      .catch(err => console.log('Theme pref load error:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  const handleThemePreferenceChange = newPref => {
    setThemePreference(newPref);
    AsyncStorage.setItem('@kadai_theme_preference', newPref).catch(err => {
      console.log('Failed to save theme pref:', err);
    });
  };

  const isDarkMode =
    themePreference === 'system'
      ? systemColorScheme === 'dark'
      : themePreference === 'dark';

  const [language, setLanguage] = useState('en'); // 'en' | 'ta'
  const isTamil = language === 'ta';
  const theme = isDarkMode ? TEXTURED_DARK : TEXTURED_LIGHT;

  // Splash Screen State
  const [showSplash, setShowSplash] = useState(false);

  // Market & Location
  const [marketMode, setMarketMode] = useState('local'); // 'local' | 'global'
  const [radiusKm, setRadiusKm] = useState(3);

  const handleToggleMarketMode = mode => {
    setMarketMode(mode);
    if (mode === 'global') {
      if (typeof radiusKm === 'number' && radiusKm <= 10) {
        setRadiusKm(100);
      }
    } else {
      if (radiusKm === 'all' || (typeof radiusKm === 'number' && radiusKm > 10)) {
        setRadiusKm(3);
      }
    }
  };

  // User Active Delivery Location (GPS auto-detected on launch + cached persistence)
  const [userLocation, setUserLocation] = useState(DEFAULT_USER_LOCATION);
  const [isLocating, setIsLocating] = useState(false);

  // Auto-detect user's current GPS location on app launch
  useEffect(() => {
    let isMounted = true;

    // 1. Fast-path: Load cached active address from AsyncStorage or customerData
    getCachedLocation()
      .then(cached => {
        if (isMounted && cached) {
          setUserLocation(normalizeAddressPayload(cached));
        } else if (customerData?.address) {
          setUserLocation(normalizeAddressPayload(customerData.address));
        } else {
          // If no cached or saved address exists yet, detect GPS on first-time launch
          setIsLocating(true);
          detectUserLocation()
            .then(detected => {
              if (isMounted && detected) {
                setUserLocation(normalizeAddressPayload(detected));
                setIsLocating(false);
              }
            })
            .catch(err => {
              console.log('Location detection on launch note:', err?.message);
              if (isMounted) setIsLocating(false);
            });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateLocation = async newLoc => {
    const resolved = normalizeAddressPayload(newLoc);
    setUserLocation(resolved);
    setSelectedShop(null);
    setSelectedCategory(null);
    await saveActiveLocation(user?.uid, resolved);
  };

  const resolvedCustomerLoc = normalizeAddressPayload(userLocation || DEFAULT_USER_LOCATION);
  const customerLat = resolvedCustomerLoc.lat;
  const customerLon = resolvedCustomerLoc.lon;

  // Filter & Sort States
  const [sortBy, setSortBy] = useState('popular');
  const [selectedType, setSelectedType] = useState('all');
  const [priceRange, setPriceRange] = useState('all');
  const [favorites, setFavorites] = useState({});

  // Data States
  const [sellers, setSellers] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [products, setProducts] = useState(CURATED_DEFAULT_PRODUCTS);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [cart, setCart] = useState({});
  const [orders, setOrders] = useState([]);

  // Modals
  const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);
  const [comparingProduct, setComparingProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Toggle Favorite
  const toggleFavorite = productId => {
    setFavorites(prev => ({ ...prev, [productId]: !prev[productId] }));
  };

  // 1. Subscribe to Live Cart in Firestore
  useEffect(() => {
    if (!user?.uid) return;
    const cartRef = doc(db, 'customers', user.uid, 'cart', 'mainCart');
    const unsubscribe = onSnapshot(
      cartRef,
      snapshot => {
        if (snapshot.exists()) {
          setCart(snapshot.data()?.items || {});
        } else {
          setCart({});
        }
      },
      error => console.log('Cart fetch error:', error)
    );
    return () => unsubscribe();
  }, [user?.uid]);

  // 1b. Load initial order from local storage cache for instant offline & tracking resilience
  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem('@kadai_last_order')
      .then(stored => {
        if (stored && isMounted) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && (parsed.orderId || parsed.id)) {
              setOrders(prev => (prev && prev.length > 0 ? prev : [parsed]));
            }
          } catch (e) {}
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Subscribe to Orders in Firestore (from customers/{uid}/orders)
  useEffect(() => {
    if (!user?.uid) return;
    const ordersQuery = collection(db, 'customers', user.uid, 'orders');
    const unsubscribe = onSnapshot(
      ordersQuery,
      snapshot => {
        const orderList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        orderList.sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tB - tA;
        });
        setOrders(orderList);
      },
      error => console.log('Orders fetch error:', error?.message)
    );
    return () => unsubscribe();
  }, [user?.uid]);

  // 3. Subscribe to Nearby Upstage POS Sellers
  useEffect(() => {
    const sellerQuery = query(
      collection(db, 'users'),
      where('role', '==', 'seller')
    );

    const unsubscribe = onSnapshot(
      sellerQuery,
      snapshot => {
        const list = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const sellerCoords = getSellerCoordinates(data);
          const dist =
            sellerCoords && customerLat && customerLon
              ? calculateDistance(customerLat, customerLon, sellerCoords.lat, sellerCoords.lon)
              : null;

          let withinRadius = false;
          if (marketMode === 'local') {
            const maxR = typeof radiusKm === 'number' ? radiusKm : 3;
            // In local mode, seller MUST have valid coordinates AND be within maxR
            withinRadius = dist !== null && dist <= maxR;
          } else {
            // Global mode: 50km, 100km, 200km, or 'all'
            if (radiusKm !== 'all' && typeof radiusKm === 'number') {
              withinRadius = dist !== null ? dist <= radiusKm : true;
            } else {
              withinRadius = true;
            }
          }

          if (withinRadius) {
            list.push({
              id: docSnap.id,
              ...data,
              distanceKm: dist,
              lat: sellerCoords?.lat,
              lon: sellerCoords?.lon,
            });
          }
        });
        // Sort stores by closest distance first
        list.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
        setSellers(list);
      },
      error => console.log('Seller query error:', error)
    );

    return () => unsubscribe();
  }, [customerLat, customerLon, radiusKm, marketMode]);

  // 4. Load Products from Selected Shop or Nearby Sellers
  useEffect(() => {
    let cancelled = false;

    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const targetSellers = selectedShop
          ? [selectedShop]
          : sellers.slice(0, 10);

        if (targetSellers.length === 0) {
          if (!cancelled) {
            setProducts(marketMode === 'local' ? [] : CURATED_DEFAULT_PRODUCTS);
            setLoadingProducts(false);
          }
          return;
        }

        const targetCollection = marketMode === 'global' ? 'global_inventory' : 'inventory';
        const allItems = [];

        for (const seller of targetSellers) {
          const invSnap = await getDocs(
            collection(db, 'users', seller.id, targetCollection)
          );

          invSnap.forEach(docSnap => {
            const data = docSnap.data();
            const qty = Number(data.quantity || data.stock || 1);
            if (qty <= 0) return;

            allItems.push({
              id: docSnap.id,
              shopId: seller.id,
              shopName: seller.shopName || seller.name || 'Local Shop',
              distanceKm: seller.distanceKm,
              name: data.itemName || data.name || 'Product',
              price: Number(data.salesPrice || data.price || 0),
              mrp: Number(data.mrp || data.regularPrice || 0),
              img: data.image || data.imageUrl || data.img || null,
              category: data.category || 'General',
              unit: data.unit || data.measurement || '1 pc',
              stockCount: `${qty} left`,
              quantity: qty,
              storePrices: [
                {
                  shopId: seller.id,
                  shopName: seller.shopName || seller.name || 'Store',
                  price: Number(data.salesPrice || data.price || 0),
                  inStock: true,
                  distanceKm: seller.distanceKm || '1.1',
                },
              ],
            });
          });
        }

        if (!cancelled) {
          setProducts(allItems.length > 0 ? allItems : (marketMode === 'local' ? [] : CURATED_DEFAULT_PRODUCTS));
          setLoadingProducts(false);
        }
      } catch (err) {
        console.log('Product fetch error:', err);
        if (!cancelled) {
          setProducts(marketMode === 'local' ? [] : CURATED_DEFAULT_PRODUCTS);
          setLoadingProducts(false);
        }
      }
    };

    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [selectedShop, sellers, marketMode]);

  // Cart actions
  const syncCartToFirestore = async updatedCart => {
    if (!user?.uid) return;
    const cartRef = doc(db, 'customers', user.uid, 'cart', 'mainCart');
    try {
      if (Object.keys(updatedCart).length === 0) {
        await deleteDoc(cartRef);
      } else {
        await setDoc(cartRef, {
          items: updatedCart,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.log('Cart sync error:', e);
    }
  };

  const handleAddToCart = product => {
    triggerHaptic('light');
    const updated = { ...cart };
    if (updated[product.id]) {
      updated[product.id].qty = (updated[product.id].qty || 1) + 1;
    } else {
      updated[product.id] = {
        id: product.id,
        name: product.name,
        price: product.price,
        img: product.img,
        shopId: product.shopId,
        shopName: product.shopName,
        qty: 1,
      };
    }
    setCart(updated);
    syncCartToFirestore(updated);
  };

  const handleUpdateCartQty = (id, type) => {
    if (type === 'add') {
      triggerHaptic('light');
    }
    const updated = { ...cart };
    if (!updated[id]) return;

    if (type === 'add') {
      updated[id].qty = (updated[id].qty || 1) + 1;
    } else {
      updated[id].qty = (updated[id].qty || 1) - 1;
      if (updated[id].qty <= 0) {
        delete updated[id];
      }
    }
    setCart(updated);
    syncCartToFirestore(updated);
  };

  const handleClearCart = async () => {
    setCart({});
    await syncCartToFirestore({});
  };

  const handlePlaceOrder = async orderData => {
    if (!user?.uid) return;
    const rawId = Math.floor(100000 + Math.random() * 900000);
    const orderId = `KADAI-${rawId}`;
    const timestamp = new Date().toISOString();

    const cartArray = Object.values(cart || {});
    if (cartArray.length === 0) return;

    // Group items by seller for multi-shop fulfillment
    const shopGroups = cartArray.reduce((acc, item) => {
      const sellerId = item.shopId || item.sellerId || selectedShop?.id || 'default_shop';
      const marketType =
        String(
          item.marketType || marketMode || 'local',
        ).trim().toLowerCase() === 'global'
          ? 'global'
          : 'local';

      const groupKey = `${sellerId}_${marketType}`;

      if (!acc[groupKey]) {
        acc[groupKey] = {
          shopId: sellerId,
          marketType,
          shopName: item.shopName || selectedShop?.shopName || selectedShop?.name || 'POS Store',
          items: [],
          shopTotal: 0,
        };
      }

      acc[groupKey].items.push({
        id: item.id,
        itemName: item.name,
        price: Number(item.price || 0),
        qty: Number(item.qty || 1),
        img: item.img || '',
        marketType,
      });

      acc[groupKey].shopTotal +=
        Number(item.price || 0) * Number(item.qty || 1);

      return acc;
    }, {});

    const orderedShops = Object.values(shopGroups).map(shop => ({
      shopId: shop.shopId,
      shopName: shop.shopName,
      marketType: shop.marketType,
      subTotal: shop.shopTotal,
      items: shop.items,
      status: 'Order Placed',
      lastStatus: null,
      pendingMessage: null,
      pendingUntil: null,
    }));

    const formattedAddress = typeof userLocation === 'string'
      ? userLocation
      : (userLocation?.formattedAddress || userLocation?.fullAddress || [userLocation?.street, userLocation?.area, userLocation?.city, userLocation?.state, userLocation?.pincode].filter(Boolean).join(', ') || 'Current Delivery Address');

    const customerOrderData = {
      orderId,
      id: orderId,
      customerUid: user.uid,
      customerId: user.uid,
      customerName: userLocation?.receiverName || customerData?.name || user.displayName || 'Smart Customer',
      customerEmail: user.email || '',
      customerPhone: userLocation?.receiverPhone || user.phoneNumber || customerData?.mobile || '9442461428',
      deliveryAddress: formattedAddress,
      addressObj: userLocation,
      locationTag: userLocation?.tag || 'Home',
      items: cartArray,
      paymentMethod: orderData.paymentMethod || 'Cash on Delivery (COD)',
      totalAmount: Number(orderData.totalAmount || 0),
      discount: Number(orderData.appliedDiscount || 0),
      instruction: orderData.deliveryInstruction || null,
      status: 'Order Placed',
      createdAt: timestamp,
      orderedShops,
      deliveryScope: marketMode === 'global' ? 'global' : 'local',
      marketType: marketMode === 'global' ? 'global' : 'local',
      marketMode,
      isGlobalMode: marketMode === 'global',
    };

    // 1. Primary write: Save to customers/{uid}/orders/{orderId}
    try {
      const customerOrderRef = doc(db, 'customers', user.uid, 'orders', orderId);
      await setDoc(customerOrderRef, customerOrderData);
      console.log('✅ Customer order saved to Firestore:', orderId);
    } catch (custErr) {
      console.log('Firestore customer order write note:', custErr?.message);
    }

    // 2. Secondary write: Root /orders/{orderId} (non-blocking)
    try {
      await setDoc(doc(db, 'orders', orderId), customerOrderData);
      console.log('✅ Root order saved to Firestore:', orderId);
    } catch (rootErr) {
      console.log('Root orders write note:', rootErr?.message);
    }

    // 3. Dispatch seller notifications under users/{sellerId}/local_orders or global_orders
    for (const groupKey of Object.keys(shopGroups)) {
      const currentShop = shopGroups[groupKey];
      const sellerId = currentShop.shopId;
      const isGlobal = currentShop.marketType === 'global';
      const orderCollection = isGlobal ? 'global_orders' : 'local_orders';

      try {
        const sellerOrderRef = doc(db, 'users', sellerId, orderCollection, orderId);
        await setDoc(sellerOrderRef, {
          orderId,
          customerUid: user.uid,
          customerName: customerData?.name || user.displayName || 'Smart Customer',
          customerEmail: user.email || '',
          customerPhone: user.phoneNumber || customerData?.mobile || '',
          deliveryAddress: formattedAddress,
          marketType: currentShop.marketType,
          isGlobalMode: isGlobal,
          deliveryScope: isGlobal ? 'global' : 'local',
          status: 'Pending Verification',
          createdAt: timestamp,
          total: currentShop.shopTotal,
          items: currentShop.items,
        });
      } catch (sellerErr) {
        console.log(`Seller notification for ${sellerId} note:`, sellerErr?.message);
      }
    }

    // 4. Save to local storage for instant offline & tracking resilience
    try {
      await AsyncStorage.setItem('@kadai_last_order', JSON.stringify(customerOrderData));
      const existingHistoryStr = await AsyncStorage.getItem('@kadai_orders_history');
      const existingHistory = existingHistoryStr ? JSON.parse(existingHistoryStr) : [];
      await AsyncStorage.setItem(
        '@kadai_orders_history',
        JSON.stringify([customerOrderData, ...existingHistory.filter(o => o.orderId !== orderId)])
      );
    } catch (storageErr) {
      console.log('Local storage order save note:', storageErr?.message);
    }

    // 5. Update local state so header live tracking countdown lights up immediately
    setOrders(prev => [customerOrderData, ...(prev || [])]);

    // 6. Clear cart
    await handleClearCart();

    // 7. Notify customer with direct tracking navigation
    Alert.alert(
      isTamil ? '🎉 ஆர்டர் வெற்றிகரமாக பதிவு செய்யப்பட்டது!' : '🎉 Order Successful!',
      isTamil
        ? `ஆர்டர் எண்: ${orderId}\nஉங்கள் ஆர்டர் விரைவில் டெலிவரி செய்யப்படும்.`
        : `Order #${orderId} has been placed successfully.`,
      [
        {
          text: isTamil ? 'ஆர்டரைக் கண்காணிக்க ➔' : 'Track Order ➔',
          onPress: () => {
            navigation.navigate('TrackOrderScreen', { orderId });
          },
        },
        {
          text: 'OK',
          style: 'cancel',
        },
      ]
    );
  };

  const isGlobal = marketMode === 'global';

  const isOrderFromGlobalMode = o => {
    if (!o) return false;
    if (
      o.marketMode === 'global' ||
      o.marketType === 'global' ||
      o.deliveryScope === 'global' ||
      o.deliveryScope === 'courier' ||
      o.isGlobalMode === true
    ) {
      return true;
    }
    if (Array.isArray(o.orderedShops) && o.orderedShops.length > 0) {
      return o.orderedShops.every(s => s.marketType === 'global');
    }
    if (Array.isArray(o.items) && o.items.length > 0) {
      return o.items.every(it => it.marketType === 'global' || it.isGlobal === true);
    }
    return false;
  };

  const activeOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    return orders.filter(o => {
      const status = (o.status || '').toLowerCase().trim();
      const isActive = !['delivered', 'completed', 'cancelled', 'rejected', 'failed'].includes(status);
      const matchesMode = isGlobal ? isOrderFromGlobalMode(o) : !isOrderFromGlobalMode(o);
      return isActive && matchesMode;
    });
  }, [orders, isGlobal]);

  const activeOrder = activeOrders[0] || null;

  const isOrderActive = activeOrders.length > 0;

  // Extract and tally categories dynamically from Upstage POS seller inventory & catalog
  const upstageCategories = useMemo(() => {
    const catMap = new Map();

    // 1. Initialize with standard Upstage POS retail categories
    (DEFAULT_RAIL_CATEGORIES || []).forEach(cat => {
      catMap.set(cat.id.toLowerCase(), {
        ...cat,
        count: 0,
      });
    });

    // 2. Tally items across live products loaded from Upstage POS / Firestore
    (products || []).forEach(p => {
      const rawCat = (p.category || '').trim();
      if (!rawCat || rawCat.toLowerCase() === 'all') return;
      const catLower = rawCat.toLowerCase();

      let found = false;
      if (catMap.has(catLower)) {
        catMap.get(catLower).count += 1;
        found = true;
      } else {
        for (const [id, c] of catMap.entries()) {
          if (c.keywords && c.keywords.some(k => catLower.includes(k) || k.includes(catLower))) {
            c.count += 1;
            found = true;
            break;
          }
        }
      }

      // If merchant created a brand new custom category in Upstage POS app
      if (!found) {
        catMap.set(catLower, {
          id: catLower,
          name: rawCat,
          shortName: rawCat,
          nameTa: rawCat,
          icon: 'pricetag-outline',
          keywords: [catLower],
          count: 1,
        });
      }
    });

    // Sort categories: categories with active items in stock first, then alphabetically
    const allCats = Array.from(catMap.values());
    allCats.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });

    return allCats;
  }, [products]);

  // Filtered & Sorted Products
  const finalProductList = useMemo(() => {
    let list = [...products];

    // Filter by Shop
    if (selectedShop) {
      list = list.filter(
        p =>
          p.shopId === selectedShop.id ||
          p.storePrices?.some(sp => sp.shopId === selectedShop.id)
      );
    }

    // Filter by Category (Upstage POS categories)
    if (selectedCategory && selectedCategory.id !== 'all') {
      const catId = (selectedCategory.id || '').toLowerCase();
      const catName = (selectedCategory.name || selectedCategory.shortName || '').toLowerCase();
      const catKeywords = selectedCategory.keywords || [catId, catName];
      list = list.filter(p => {
        const pCat = (p.category || '').toLowerCase();
        const pName = (p.name || '').toLowerCase();
        if (pCat === catId || pCat === catName || pCat.includes(catId) || catId.includes(pCat)) {
          return true;
        }
        return catKeywords.some(k => pName.includes(k) || pCat.includes(k));
      });
    }

    // Filter by Search Query (Optimized multi-term matching across English & Tamil names, shops, categories)
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const terms = q.split(/\s+/).filter(Boolean);
      list = list.filter(p => {
        const pName = (p.name || '').toLowerCase();
        const pShop = (p.shopName || '').toLowerCase();
        const pCat = (p.category || '').toLowerCase();
        const pTa = (p.nameTa || '').toLowerCase();
        const haystack = `${pName} ${pShop} ${pCat} ${pTa}`;
        return terms.every(term => haystack.includes(term));
      });
    }

    // Filter by Product Type
    if (selectedType === 'veg') {
      list = list.filter(p => p.isVeg !== false);
    } else if (selectedType === 'organic') {
      list = list.filter(p => p.isOrganic === true);
    }

    // Filter by Price Range
    if (priceRange === 'under_50') {
      list = list.filter(p => p.price < 50);
    } else if (priceRange === '50_150') {
      list = list.filter(p => p.price >= 50 && p.price <= 150);
    } else if (priceRange === 'above_150') {
      list = list.filter(p => p.price > 150);
    }

    // Sort Products
    if (sortBy === 'price_asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.rating || 4.5) - (a.rating || 4.5));
    }

    return list;
  }, [products, selectedShop, selectedCategory, searchQuery, selectedType, priceRange, sortBy]);

  // Cart totals for floating sticky bar
  const cartItemsArray = Object.values(cart || {});
  const cartTotalItems = cartItemsArray.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
  const cartTotalAmount = cartItemsArray.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1),
    0
  );

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



      {/* MASTER LIQUID GLASS HEADER (Top Bar + Horizontal Filter Chips) */}
      <LiquidGlassHeader
        userAddress={userLocation}
        onUpdateLocation={handleUpdateLocation}
        userId={user?.uid}
        onAddressPress={() => navigation.navigate('LocationPickerScreen')}
        marketMode={marketMode}
        onToggleMarketMode={handleToggleMarketMode}
        radiusKm={radiusKm}
        onRadiusChange={r => setRadiusKm(r)}
        cart={cart}
        onUpdateCartQty={handleUpdateCartQty}
        onClearCart={handleClearCart}
        onPlaceOrder={handlePlaceOrder}
        onOpenAccount={() => setIsAccountModalVisible(true)}
        onOpenVoice={() => navigation.navigate('AIMicScreen')}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        categories={upstageCategories}
        language={language}
        isDarkMode={isDarkMode}
        navigation={navigation}
        selectedShop={selectedShop}
        sortBy={sortBy}
        onSortChange={setSortBy}
        selectedType={selectedType}
        onSelectType={setSelectedType}
        priceRange={priceRange}
        onSelectPriceRange={setPriceRange}
        lastOrder={activeOrder}
        activeOrders={activeOrders}
        orders={orders}
        onTrackOrder={target => {
          const orderId = typeof target === 'object' && target !== null
            ? String(target.orderId || target.id || '')
            : (target ? String(target) : '');
          navigation.navigate('TrackOrderScreen', {
            orderId,
            order: typeof target === 'object' && target !== null ? target : undefined,
          });
        }}
      />

      {/* MAIN BODY: LEFT SIDEBAR RAIL + RIGHT CONTENT AREA */}
      <View style={styles.mainContainer}>
        {/* LEFT VERTICAL SIDEBAR: "ALL" + CATEGORIES + UPSTAGE POS NEARBY STORES */}
        <StoreSidebarRail
          shops={sellers}
          selectedShop={selectedShop}
          onSelectShop={setSelectedShop}
          categories={DEFAULT_RAIL_CATEGORIES}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          language={language}
          marketMode={marketMode}
          isDarkMode={isDarkMode}
        />

        {/* RIGHT CONTENT AREA */}
        <View style={[styles.rightContentArea, { backgroundColor: isDarkMode ? '#0D1711' : '#F4F8F5' }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.catalogScrollContent}
          >
            {/* 1. NEARBY LOCAL STORES SECTION */}
            <TopShopsCarousel
              shops={sellers}
              selectedShop={selectedShop}
              onSelectShop={setSelectedShop}
              language={language}
              radiusKm={radiusKm}
              marketMode={marketMode}
              isDarkMode={isDarkMode}
            />

            {/* 3. ACTIVE SECTION HEADER & COUNT */}
            <View style={styles.listHeaderRow}>
              <Text style={[styles.listHeaderTitle, { color: theme.textWhite }]}>
                {selectedShop
                  ? (selectedShop.shopName || selectedShop.name)
                  : selectedCategory
                  ? (isTamil && selectedCategory.nameTa ? selectedCategory.nameTa : selectedCategory.name)
                  : (isTamil ? 'அனைத்து தயாரிப்புகள்' : 'Live Products')}
              </Text>
              <Text style={[styles.productCountText, { color: theme.neonGreen }]}>
                {finalProductList.length} {isTamil ? 'பொருட்கள்' : 'Items'}
              </Text>
            </View>

            {/* 4. 2-COLUMN PRODUCT GRID (Exact Zepto design matching screenshot) */}
            {loadingProducts ? (
              <View style={styles.loaderCenter}>
                <ActivityIndicator size="large" color={theme.neonGreen} />
                <Text style={[styles.loadingText, { color: theme.neonGreen }]}>
                  {isTamil ? 'தயாரிப்புகள் ஏற்றப்படுகின்றன...' : 'Loading fresh items...'}
                </Text>
              </View>
            ) : finalProductList.length === 0 ? (
              <View style={styles.emptyGrid}>
                <Ionicons name="bag-handle-outline" size={48} color="#94A3B8" />
                <Text style={[styles.emptyGridTitle, { color: theme.textWhite }]}>
                  {isTamil ? 'தயாரிப்புகள் எதுவும் கிடைக்கவில்லை' : 'No products found'}
                </Text>
                <Text style={[styles.emptyGridSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {isTamil ? 'வடிகட்டிகளை மாற்றி முயற்சிக்கவும்' : 'Try clearing filters or choosing another category'}
                </Text>
              </View>
            ) : (
              <View style={styles.productGrid}>
                {finalProductList.map(item => {
                  const inCart = cart[item.id]?.qty || 0;
                  const isFav = !!favorites[item.id];
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.productCard,
                        {
                          backgroundColor: isDarkMode ? '#16231B' : '#FFFFFF',
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: isDarkMode ? 0 : 0.05,
                          shadowRadius: 3,
                          elevation: isDarkMode ? 0 : 2,
                        },
                      ]}
                      activeOpacity={0.88}
                      onPress={() => {
                        setComparingProduct(item);
                      }}
                    >
                      {/* Top Image Box */}
                      <View style={[styles.cardImageWrap, { backgroundColor: isDarkMode ? '#EAE4D7' : '#F8FAFC' }]}>
                        <Image
                          source={{
                            uri:
                              item.img ||
                              'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80',
                          }}
                          style={styles.cardProductImage}
                          resizeMode="cover"
                        />

                        {/* Favorite Heart Button */}
                        <TouchableOpacity
                          style={styles.heartBtn}
                          onPress={() => toggleFavorite(item.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isFav ? 'heart' : 'heart-outline'}
                            size={14}
                            color={isFav ? '#EF4444' : '#374151'}
                          />
                        </TouchableOpacity>

                        {/* 4 Carousel Indicator Dots */}
                        <View style={styles.carouselDotsRow}>
                          <View style={[styles.dot, styles.dotActive]} />
                          <View style={styles.dot} />
                          <View style={styles.dot} />
                          <View style={styles.dot} />
                        </View>
                      </View>

                      {/* Weight badge & ADD Button Strip */}
                      <View style={styles.weightAddStrip}>
                        <View style={styles.weightInfoBox}>
                          <Text style={[styles.weightText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                            {item.unit || item.weight || '250 g'}
                          </Text>
                          {item.pieces && (
                            <Text style={[styles.piecesText, { color: isDarkMode ? '#9CA3AF' : '#64748B' }]}>
                              {item.pieces}
                            </Text>
                          )}
                        </View>

                        {inCart === 0 ? (
                          <TouchableOpacity
                            style={[
                              styles.addBtnCompact,
                              {
                                backgroundColor: isDarkMode ? '#0E3624' : '#DCFCE7',
                                borderColor: isDarkMode ? '#10B981' : '#16A34A',
                              },
                            ]}
                            onPress={() => handleAddToCart(item)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.addBtnText, { color: isDarkMode ? '#10B981' : '#15803D' }]}>
                              ADD
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.stepperCompact, { backgroundColor: theme.neonGreen }]}>
                            <TouchableOpacity
                              style={styles.stepperAction}
                              onPress={() => handleUpdateCartQty(item.id, 'remove')}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.stepperActionText}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.stepperQtyText}>{inCart}</Text>
                            <TouchableOpacity
                              style={styles.stepperAction}
                              onPress={() => handleUpdateCartQty(item.id, 'add')}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.stepperActionText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      {/* Card Details: Price, Title, Stock */}
                      <View style={styles.cardBody}>
                        {/* Price Line */}
                        <View style={styles.priceRow}>
                          <Text style={[styles.cardPrice, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                            ₹{item.price}
                          </Text>
                          {item.mrp > item.price && (
                            <Text style={styles.cardMrp}>₹{item.mrp}</Text>
                          )}
                        </View>

                        {/* Product Title */}
                        <Text
                          style={[styles.cardProductName, { color: isDarkMode ? '#FFFFFF' : '#1E293B' }]}
                          numberOfLines={2}
                        >
                          {isTamil && item.nameTa ? item.nameTa : item.name}
                        </Text>

                        {/* Stock Urgency Tag */}
                        <View style={styles.stockRow}>
                          <Ionicons
                            name="battery-half-outline"
                            size={11}
                            color={isDarkMode ? '#9CA3AF' : '#64748B'}
                          />
                          <Text
                            style={[styles.stockText, { color: isDarkMode ? '#9CA3AF' : '#64748B' }]}
                          >
                            {item.stockCount || `${item.quantity || 4} left`}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 5. "See all products ›" Pill Button */}
            {finalProductList.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.seeAllBtn,
                  {
                    backgroundColor: isDarkMode ? '#243128' : '#E2E8F0',
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    borderWidth: 1,
                  },
                ]}
                activeOpacity={0.85}
                onPress={() => {
                  setSelectedShop(null);
                  setSelectedCategory(null);
                }}
              >
                <Text style={[styles.seeAllBtnText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                  {isTamil ? 'அனைத்து தயாரிப்புகளையும் பார்க்கவும் ›' : 'See all products ›'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>
        </View>
      </View>

      {/* PRODUCT PRICE COMPARE MODAL */}
      <ProductCompareModal
        visible={!!comparingProduct}
        product={comparingProduct}
        onClose={() => setComparingProduct(null)}
        onAddToCart={handleAddToCart}
        cart={cart}
        language={language}
        isDarkMode={isDarkMode}
        marketMode={marketMode}
      />

      {/* ACCOUNTS & SETTINGS MODAL */}
      <AccountsModal
        visible={isAccountModalVisible}
        onClose={() => setIsAccountModalVisible(false)}
        user={user}
        customerData={customerData}
        orders={orders}
        language={language}
        onToggleLanguage={() => setLanguage(l => (l === 'en' ? 'ta' : 'en'))}
        themePreference={themePreference}
        onChangeThemePreference={handleThemePreferenceChange}
        isDarkMode={isDarkMode}
        onToggleTheme={() => handleThemePreferenceChange(isDarkMode ? 'light' : 'dark')}
        onLogout={async () => {
          await signOut(authInstance);
        }}
        onTrackOrder={orderId => {
          setIsAccountModalVisible(false);
          navigation.navigate('TrackOrderScreen', { orderId });
        }}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        products={products}
        cart={cart}
        onAddToCart={handleAddToCart}
        onUpdateCartQty={handleUpdateCartQty}
        userLocation={userLocation}
        onUpdateLocation={handleUpdateLocation}
        onExploreProducts={() => {
          setIsAccountModalVisible(false);
          setSelectedCategory(null);
          setSelectedShop(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  rightContentArea: {
    flex: 1,
    backgroundColor: '#0D1711',
  },
  catalogScrollContent: {
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 40,
  },
  /* Hero Banner */
  heroBanner: {
    backgroundColor: '#132E22',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.18)',
    marginBottom: 10,
  },
  heroTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    color: '#86EFAC',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 3,
  },
  heroImage: {
    width: 76,
    height: 58,
    borderRadius: 8,
  },
  /* Section Header */
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginVertical: 8,
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  productCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
  },
  /* 2-Column Product Grid */
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48.5%',
    backgroundColor: '#16231B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  cardImageWrap: {
    height: 122,
    width: '100%',
    backgroundColor: '#EAE4D7',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardProductImage: {
    width: '100%',
    height: '100%',
  },
  heartBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselDotsRow: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  dotActive: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#93C5FD',
  },
  /* Weight badge & ADD Button Strip */
  weightAddStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 2,
  },
  weightInfoBox: {
    justifyContent: 'center',
    flex: 1,
    marginRight: 6,
  },
  weightText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  piecesText: {
    color: '#9CA3AF',
    fontSize: 9.5,
    marginTop: 1,
  },
  addBtnCompact: {
    backgroundColor: '#0E3624',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    minHeight: 36,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  stepperCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: 8,
    minHeight: 36,
    minWidth: 72,
    paddingHorizontal: 2,
  },
  stepperAction: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperActionText: {
    color: '#050906',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
  stepperQtyText: {
    color: '#050906',
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: 4,
    minWidth: 20,
    textAlign: 'center',
  },
  /* Card Details */
  cardBody: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginBottom: 3,
  },
  cardPrice: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
  },
  cardMrp: {
    color: '#6B7280',
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  cardProductName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    height: 32,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  stockText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '500',
  },
  /* "See all products ›" Pill */
  seeAllBtn: {
    backgroundColor: '#243128',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  seeAllBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  /* Floating Sticky Cart Bar */
  stickyCartBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  stickyCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stickyCartIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(5, 9, 6, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyCartItemCount: {
    color: '#050906',
    fontSize: 11,
    fontWeight: '600',
  },
  stickyCartTotal: {
    color: '#050906',
    fontSize: 14,
    fontWeight: '900',
  },
  stickyCartRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stickyCartViewText: {
    color: '#050906',
    fontSize: 13,
    fontWeight: '800',
  },
  /* Empty & Loading States */
  loaderCenter: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyGrid: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyGridTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  emptyGridSub: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
});
