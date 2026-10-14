import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
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
import { calculateEffectivePricing } from '../../utils/pricing';
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

export const cleanNorm = str =>
  String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export const normalizeCategoryValue = cleanNorm;

export const CATEGORY_SYNONYMS = {
  groceries: [
    'grocery', 'groceries', 'maligai', 'staples', 'rice', 'dal', 'toor dal', 'wheat',
    'atta', 'flour', 'arisi', 'paruppu', 'dhal', 'sugar', 'salt', 'provisions', 'grain',
    'pulses', 'oilseeds', 'rava', 'sooji', 'maida', 'urad', 'moong', 'chana', 'poha', 'aval',
    'மளிகை', 'அரிசி', 'பருப்பு', 'தானியங்கள்', 'மாவு',
  ],
  fruits: [
    'fruit', 'fruits', 'veggie', 'veggies', 'vegetables', 'vegetable', 'strawberry', 'persimmon',
    'onion', 'tomato', 'potato', 'keerai', 'greens', 'vengayam', 'thakkali', 'urulai', 'kaikari',
    'pazhangal', 'apple', 'banana', 'mango', 'orange', 'citrus', 'carrot', 'beans', 'cabbage',
    'காய்கறிகள்', 'பழங்கள்', 'கீரை', 'வெங்காயம்', 'தக்காளி',
  ],
  dairy: [
    'dairy', 'milk', 'curd', 'butter', 'paneer', 'cheese', 'ghee', 'paal', 'thayir',
    'vennai', 'nei', 'yogurt', 'cream', 'buttermilk', 'mor', 'khoya', 'kova',
    'பால்', 'தயிர்', 'வெண்ணெய்', 'நெய்', 'பனீர்',
  ],
  oils: [
    'oil', 'oils', 'ghee', 'sunflower', 'gingelly', 'groundnut', 'ennai', 'deepam',
    'sesame', 'mustard', 'coconut oil', 'cooking oil', 'refined oil', 'marachekku',
    'எண்ணெய்', 'சமையல் எண்ணெய்', 'நல்லெண்ணெய்', 'கடலை எண்ணெய்',
  ],
  spices: [
    'spice', 'spices', 'masala', 'masalas', 'powder', 'chilli', 'turmeric', 'pepper',
    'coriander', 'podigal', 'sambhar', 'garam', 'clove', 'cardamom', 'cinnamon', 'jeera',
    'cumin', 'fenugreek', 'venthaiyam', 'milagu', 'seeragam', 'manjal', 'milagai',
    'மசாலா', 'பொடிகள்', 'மஞ்சள்', 'மிளகு', 'சீரகம்', 'சாம்பார்',
  ],
  snacks: [
    'snack', 'snacks', 'biscuit', 'biscuits', 'cookies', 'chips', 'murukku', 'mixture',
    'sweets', 'chocolate', 'candy', 'namkeen', 'mittai', 'karam', 'mixture', 'ladoo',
    'halwa', 'wafers', 'crisps', 'popcorn',
    'சிற்றுண்டி', 'பிஸ்கட்', 'முறுக்கு', 'ஸ்வீட்ஸ்', 'மிட்டாய்',
  ],
  beverages: [
    'beverage', 'beverages', 'tea', 'coffee', 'juice', 'soda', 'cool drinks', 'drink',
    'horlicks', 'boost', 'water', 'health drink', 'energy drink', 'syrup', 'squash', 'chai',
    'காபி', 'டீ', 'குளிர்பானங்கள்', 'பானங்கள்', 'ஜூஸ்',
  ],
  pooja: [
    'pooja', 'puja', 'camphor', 'agarbathi', 'incense', 'oil', 'sambrani', 'divine',
    'vilakku', 'dhoop', 'kumkum', 'vibuthi', 'karpooram', 'deepam', 'matchbox',
    'wicks', 'cotton wick', 'thiri', 'chandanam',
    'பூஜை', 'கற்பூரம்', 'அகர்பத்தி', 'சாம்பிராணி', 'விளக்கு', 'குங்குமம்',
  ],
  cleaning: [
    'cleaning', 'household', 'detergent', 'soap', 'dishwash', 'cleaner', 'surf', 'rin',
    'broom', 'mop', 'harpic', 'comfort', 'fabric', 'bleach', 'wash', 'scrubber', 'vim',
    'floor cleaner', 'toilet cleaner', 'mosquito', 'repellent', 'all out', 'good knight',
    'வீட்டு உபயோக பொருட்கள்', 'சுத்தம்', 'சலவை', 'சோப்பு',
  ],
  personal_care: [
    'personal', 'care', 'hygiene', 'soap', 'shampoo', 'toothpaste', 'brush', 'lotion',
    'hair', 'face', 'cream', 'cosmetics', 'beauty', 'skin', 'deodorant', 'powder',
    'perfume', 'sanitary', 'napkin', 'pad', 'shaving', 'razor',
    'தனிநபர் பராமரிப்பு', 'சோப்', 'ஷாம்பு', 'பற்பசை',
  ],
  hardware: [
    'hardware', 'electrical', 'tools', 'bulb', 'wire', 'switch', 'tape', 'battery',
    'lock', 'plumbing', 'led', 'plug', 'hammer', 'screwdriver', 'nail', 'screw',
    'ஹார்டுவேர்', 'மின்சாதனங்கள்', 'டூல்ஸ்',
  ],
  stationery: [
    'stationery', 'book', 'books', 'notebook', 'pen', 'pencil', 'eraser', 'scale',
    'paper', 'stapler', 'fevicol', 'gum', 'crayons', 'marker', 'file', 'folder',
    'ஸ்டேஷனரி', 'நோட்டு', 'புத்தகம்', 'பேனா',
  ],
  apparel: [
    'clothes', 'clothing', 'dhoti', 'veshti', 'towel', 'saree', 'cotton', 'lungi',
    'handloom', 'wear', 'fashion', 'shirt', 'pant', 'innerwear', 'banian',
    'ஆடைகள்', 'வேஷ்டி', 'துண்டு', 'சேலை',
  ],
  bakery: [
    'bakery', 'bread', 'bun', 'cake', 'rusk', 'toast', 'puff', 'pastry', 'cookies',
    'brownie', 'muffin',
    'பேக்கரி', 'ரொட்டி', 'கேக்', 'பன்',
  ],
};

export const isProductMatchingCategory = (product, selectedCategory) => {
  if (!product || !selectedCategory) return true;

  const selId = cleanNorm(selectedCategory.id);
  const prodCatId = cleanNorm(product.categoryId);
  const prodParentCatId = cleanNorm(product.parentCategoryId);
  const prodSubcatId = cleanNorm(product.subcategoryId);

  // 1. Direct ID checks
  if (selId) {
    if (prodCatId && prodCatId === selId) return true;
    if (prodParentCatId && prodParentCatId === selId) return true;
    if (prodSubcatId && prodSubcatId === selId) return true;
  }

  if (Array.isArray(selectedCategory.childCategoryIds) && selectedCategory.childCategoryIds.length > 0) {
    const childIds = selectedCategory.childCategoryIds.map(cleanNorm);
    if (prodCatId && childIds.includes(prodCatId)) return true;
    if (prodSubcatId && childIds.includes(prodSubcatId)) return true;
  }

  // 2. Text-based matching
  const prodCat = cleanNorm(product.category);
  const prodSubcat = cleanNorm(product.subcategory);
  const prodParentCat = cleanNorm(product.parentCategory);
  const prodName = cleanNorm(product.name);
  const prodNameTa = cleanNorm(product.nameTa);
  const prodCombined = `${prodCat} ${prodSubcat} ${prodParentCat} ${prodName} ${prodNameTa}`;

  const catNames = [
    selectedCategory.name,
    selectedCategory.shortName,
    selectedCategory.nameTa,
    selectedCategory.id,
    ...(selectedCategory.childCategoryNames || []),
  ]
    .filter(Boolean)
    .map(cleanNorm);

  for (const cName of catNames) {
    if (!cName) continue;
    if (prodCat && (prodCat === cName || prodCat.includes(cName) || cName.includes(prodCat))) return true;
    if (prodSubcat && (prodSubcat === cName || prodSubcat.includes(cName) || cName.includes(prodSubcat))) return true;
    if (prodParentCat && (prodParentCat === cName || prodParentCat.includes(cName) || cName.includes(prodParentCat))) return true;
  }

  // 3. Keyword & Synonym matching
  const explicitKeywords = Array.isArray(selectedCategory.keywords)
    ? selectedCategory.keywords
    : [];

  let synonymList = [];
  if (selId && CATEGORY_SYNONYMS[selId]) {
    synonymList = CATEGORY_SYNONYMS[selId];
  } else {
    for (const [key, syns] of Object.entries(CATEGORY_SYNONYMS)) {
      if (catNames.some(cName => cName === key || cName.includes(key) || key.includes(cName))) {
        synonymList = [...synonymList, ...syns];
      }
    }
  }

  const allKeywords = [...new Set([...explicitKeywords, ...synonymList])].map(cleanNorm).filter(Boolean);

  for (const kw of allKeywords) {
    if (kw.length < 2) continue;
    if (prodCat && (prodCat === kw || prodCat.includes(kw))) return true;
    if (prodSubcat && (prodSubcat === kw || prodSubcat.includes(kw))) return true;
    if (prodCombined.includes(kw)) return true;
  }

  return false;
};

const isVisibleFirestoreCategory = data =>
  data.active !== false &&
  data.isActive !== false &&
  data.deleted !== true &&
  data.isDeleted !== true;

const normalizeFirestoreCategory = (snapshot, parent = null) => {
  const data = snapshot.data() || {};
  const name = String(data.name || data.categoryName || data.title || snapshot.id).trim();

  return {
    id: snapshot.id,
    name,
    nameTa: typeof data.nameTa === 'string' ? data.nameTa : null,
    shortName: typeof data.shortName === 'string' ? data.shortName : name,
    icon: typeof data.icon === 'string' ? data.icon : null,
    image: data.image || data.imageUrl || null,
    displayOrder: data.displayOrder,
    sortOrder: data.sortOrder,
    parentId: parent?.id || null,
    parentName: parent?.name || null,
    parentNameTa: parent?.nameTa || null,
    level: parent ? 'subcategory' : 'parent',
  };
};

const sortFirestoreCategories = categories =>
  [...categories].sort((a, b) => {
    const aOrder = Number(a.displayOrder ?? a.sortOrder);
    const bOrder = Number(b.displayOrder ?? b.sortOrder);
    const aHasOrder = Number.isFinite(aOrder);
    const bHasOrder = Number.isFinite(bOrder);

    if (aHasOrder && bHasOrder && aOrder !== bOrder) return aOrder - bOrder;
    if (aHasOrder !== bHasOrder) return aHasOrder ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

const CURATED_DEFAULT_PRODUCTS = [];

export const normalizeCity = city => {
  if (!city || typeof city !== 'string') return '';
  return city
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
};

export const getSellerCity = sellerData => {
  if (!sellerData) return '';
  const rawCity =
    sellerData.city ||
    sellerData.address?.city ||
    sellerData.storeAddress?.city ||
    sellerData.businessCity ||
    sellerData.storeCity ||
    sellerData.district ||
    sellerData.address?.district ||
    '';
  return typeof rawCity === 'string' ? rawCity.trim() : '';
};

export const isGlobalEligibleSeller = sellerData => {
  if (!sellerData) return false;
  return (
    sellerData.isGlobalSeller === true ||
    sellerData.globalSeller === true ||
    sellerData.enableGlobal === true ||
    sellerData.allowGlobalOrders === true ||
    sellerData.isGlobal === true ||
    sellerData.deliveryScope === 'global' ||
    sellerData.worldwide === true ||
    sellerData.role === 'seller'
  );
};

export const parseProductOffer = (item, shop) => {
  if (!item) return null;
  if (
    item.active === false ||
    item.isActive === false ||
    item.deleted === true ||
    item.isDeleted === true
  ) {
    return null;
  }
  const qty = Number(item.quantity ?? item.stock ?? 0);
  if (qty <= 0) return null;

  const pricing = calculateEffectivePricing(item);
  if (!pricing.hasDiscount || pricing.price <= 0 || pricing.originalPrice <= pricing.price) {
    return null;
  }

  const name = String(item.itemName || item.name || '').trim();
  if (!name) return null;

  const brand = String(item.brand || item.brandName || '').trim();
  const subName = String(
    item.subName || item.productSubName || item.modelName || item.variant || '',
  ).trim();
  const model = String(item.model || item.modelNumber || item.modelNo || '').trim();
  const description = String(
    item.description || item.productDescription || item.details || '',
  ).trim();
  const itemNo = String(item.itemNo || item.sku || item.productCode || '').trim();
  const images = Array.isArray(item.images) && item.images.length ? item.images : undefined;

  return {
    id: item.id,
    name,
    nameTa: item.nameTa || null,
    brand,
    subName,
    model,
    description,
    itemNo,
    price: pricing.price,
    salesPrice: pricing.price,
    originalPrice: pricing.originalPrice,
    originalSalesPrice: pricing.originalPrice,
    mrp: pricing.originalPrice,
    discountPercent: pricing.discountPercent,
    discountBadge: pricing.discountBadge,
    discountValue: pricing.discountAmount,
    discountType: pricing.discountType,
    hasDiscount: true,
    img: item.image || item.imageUrl || item.img || null,
    images: images || (item.img || item.image ? [item.img || item.image] : undefined),
    unit: item.unit || item.measurement || '1 pc',
    quantity: qty,
    stockCount: `${qty} left`,
    shopId: shop.id,
    shopName: shop.shopName || shop.name || 'Store',
    shopImage: shop.shopImage || shop.profileImage || shop.image || null,
    category: item.category || item.categoryName || item.category_name || item.cat || '',
    categoryId: typeof item.categoryId === 'string' ? item.categoryId : null,
    parentCategoryId: typeof item.parentCategoryId === 'string' ? item.parentCategoryId : null,
    parentCategory: item.parentCategory || item.parent_category || null,
    subcategoryId: typeof item.subcategoryId === 'string' ? item.subcategoryId : null,
    subcategory: item.subcategory || item.subCategory || item.sub_category || null,
    marketType: shop.marketType || 'local',
    marketMode: shop.marketType || 'local',
    inventoryCollection: shop.marketType === 'global' ? 'global_inventory' : 'inventory',
  };
};

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
  const [products, setProducts] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [cart, setCart] = useState({});
  const [orders, setOrders] = useState([]);

  // Sync userLocation when active address changes in customer profile
  useEffect(() => {
    if (customerData?.address) {
      setUserLocation(normalizeAddressPayload(customerData.address));
    }
  }, [customerData?.address]);

  const customerCity = (
    userLocation?.city ||
    customerData?.address?.city ||
    ''
  ).trim();

  // Modals
  const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);
  const [comparingProduct, setComparingProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(null);
  const [categoriesReloadKey, setCategoriesReloadKey] = useState(0);
  const subcategoryCache = useRef(new Map());

  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      setCategoriesLoading(true);
      setCategoriesError(null);

      try {
        const snapshot = await getDocs(collection(db, 'categories'));
        const seenIds = new Set();
        const fetchedCategories = [];

        snapshot.forEach(categoryDoc => {
          if (seenIds.has(categoryDoc.id)) return;
          const data = categoryDoc.data() || {};
          if (!isVisibleFirestoreCategory(data)) return;

          seenIds.add(categoryDoc.id);
          fetchedCategories.push({
            ...normalizeFirestoreCategory(categoryDoc),
            displayOrder: data.displayOrder,
            sortOrder: data.sortOrder,
          });
        });

        if (!cancelled) {
          if (fetchedCategories.length > 0) {
            setCategories(sortFirestoreCategories(fetchedCategories));
          } else {
            setCategories(DEFAULT_RAIL_CATEGORIES);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setCategories(DEFAULT_RAIL_CATEGORIES);
          setCategoriesError(error);
        }
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    };

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, [db, categoriesReloadKey]);

  const retryLoadCategories = useCallback(() => {
    setCategoriesReloadKey(key => key + 1);
  }, []);

  const loadSubcategories = useCallback(async parentId => {
    if (!parentId) return [];
    const cachedOrPending = subcategoryCache.current.get(parentId);
    if (cachedOrPending) {
      return cachedOrPending;
    }

    const request = (async () => {
      const snapshot = await getDocs(
        collection(db, 'categories', parentId, 'subcategories'),
      );
      const parent = categories.find(category => category.id === parentId) || { id: parentId };
      const seenIds = new Set();
      const children = [];

      snapshot.forEach(subcategoryDoc => {
        if (seenIds.has(subcategoryDoc.id)) return;
        const data = subcategoryDoc.data() || {};
        if (!isVisibleFirestoreCategory(data)) return;

        seenIds.add(subcategoryDoc.id);
        children.push(normalizeFirestoreCategory(subcategoryDoc, parent));
      });

      return sortFirestoreCategories(children);
    })();

    subcategoryCache.current.set(parentId, request);
    try {
      const children = await request;
      subcategoryCache.current.set(parentId, children);
      return children;
    } catch (error) {
      subcategoryCache.current.delete(parentId);
      throw error;
    }
  }, [categories, db]);

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

  // 3 & 4. Discover eligible shops and load their inventory & discount offers
  useEffect(() => {
    let cancelled = false;

    const sellerQuery = query(
      collection(db, 'users'),
      where('role', '==', 'seller'),
    );

    const unsubscribe = onSnapshot(
      sellerQuery,
      async snapshot => {
        setLoadingProducts(true);
        setLoadingOffers(true);

        try {
          const isLocal = marketMode === 'local';
          const normCustomerCity = normalizeCity(customerCity);

          // Step 1: Pre-filter shops by location/eligibility
          const candidateSellers = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data() || {};
            const isSellerActive =
              data.active !== false &&
              data.isActive !== false &&
              data.deleted !== true &&
              data.isDeleted !== true &&
              data.status !== 'suspended' &&
              data.status !== 'inactive';

            if (!isSellerActive) return;

            if (isLocal) {
              // Local mode: match seller registered business city
              const sellerCity = getSellerCity(data);
              const normSellerCity = normalizeCity(sellerCity);

              const isMatched = normCustomerCity
                ? normSellerCity === normCustomerCity ||
                  normSellerCity.includes(normCustomerCity) ||
                  normCustomerCity.includes(normSellerCity)
                : true;

              if (isMatched) {
                candidateSellers.push({
                  id: docSnap.id,
                  ...data,
                  sellerCity: sellerCity || customerCity,
                  marketType: 'local',
                });
              }
            } else {
              // Global mode: worldwide eligibility check
              if (isGlobalEligibleSeller(data)) {
                candidateSellers.push({
                  id: docSnap.id,
                  ...data,
                  marketType: 'global',
                });
              }
            }
          });

          // Step 2: For each candidate shop, read only its corresponding inventory:
          // Local: users/{shopUid}/inventory
          // Global: users/{shopUid}/global_inventory
          const targetCollection = isLocal ? 'inventory' : 'global_inventory';
          const verifiedSellers = [];
          const allProducts = [];
          const allOffers = [];

          for (const seller of candidateSellers) {
            try {
              const invSnap = await getDocs(
                collection(db, 'users', seller.id, targetCollection),
              );

              let validProductCount = 0;

              invSnap.forEach(docSnap => {
                const data = docSnap.data() || {};
                const isItemActive =
                  data.active !== false &&
                  data.isActive !== false &&
                  data.deleted !== true &&
                  data.isDeleted !== true;

                const qty = Number(data.quantity ?? data.stock ?? 0);
                const pricing = calculateEffectivePricing(data);
                const price = pricing.price;

                // Validate product
                if (!isItemActive || qty <= 0 || price <= 0) return;

                validProductCount++;

                const prodName = String(data.itemName || data.name || 'Product').trim();
                const prodBrand = String(data.brand || data.brandName || '').trim();
                const prodSubName = String(
                  data.subName || data.productSubName || data.modelName || data.variant || '',
                ).trim();
                const prodModel = String(data.model || data.modelNumber || data.modelNo || '').trim();
                const prodDesc = String(
                  data.description || data.productDescription || data.details || '',
                ).trim();
                const prodItemNo = String(data.itemNo || data.sku || data.productCode || '').trim();
                const images = Array.isArray(data.images) && data.images.length ? data.images : undefined;

                const rawCategory = String(
                  data.category ||
                  data.categoryName ||
                  data.category_name ||
                  data.cat ||
                  data.department ||
                  data.section ||
                  '',
                ).trim();

                const rawCategoryId =
                  data.categoryId ||
                  data.category_id ||
                  data.catId ||
                  data.cat_id ||
                  null;

                const rawSubcategory = String(
                  data.subcategory ||
                  data.subCategory ||
                  data.sub_category ||
                  data.subCategoryName ||
                  '',
                ).trim();

                const rawSubcategoryId =
                  data.subcategoryId ||
                  data.subCategoryId ||
                  data.sub_category_id ||
                  null;

                const rawParentCategoryId =
                  data.parentCategoryId ||
                  data.parent_category_id ||
                  data.parentCatId ||
                  null;

                const rawParentCategory = String(
                  data.parentCategory ||
                  data.parent_category ||
                  data.parentCategoryName ||
                  '',
                ).trim();

                const productItem = {
                  id: docSnap.id,
                  shopId: seller.id,
                  shopName: seller.shopName || seller.name || 'Local Shop',
                  shopImage: seller.shopImage || seller.profileImage || seller.image || null,
                  name: prodName,
                  nameTa: data.nameTa || null,
                  brand: prodBrand,
                  subName: prodSubName,
                  model: prodModel,
                  description: prodDesc,
                  itemNo: prodItemNo,
                  price,
                  salesPrice: price,
                  originalPrice: pricing.originalPrice,
                  originalSalesPrice: pricing.originalPrice,
                  mrp: pricing.originalPrice > 0 ? pricing.originalPrice : (Number(data.mrp) || price),
                  hasDiscount: pricing.hasDiscount,
                  discountPercent: pricing.discountPercent,
                  discountBadge: pricing.discountBadge,
                  discountType: pricing.discountType,
                  discountValue: data.discountValue ?? 0,
                  img: data.image || data.imageUrl || data.img || null,
                  images: images || (data.image || data.imageUrl || data.img ? [data.image || data.imageUrl || data.img] : undefined),
                  category: rawCategory,
                  categoryId: typeof rawCategoryId === 'string' ? rawCategoryId : null,
                  parentCategoryId: typeof rawParentCategoryId === 'string' ? rawParentCategoryId : null,
                  parentCategory: rawParentCategory,
                  subcategoryId: typeof rawSubcategoryId === 'string' ? rawSubcategoryId : null,
                  subcategory: rawSubcategory,
                  unit: data.unit || data.measurement || '1 pc',
                  stockCount: `${qty} left`,
                  quantity: qty,
                  marketType: isLocal ? 'local' : 'global',
                  marketMode: isLocal ? 'local' : 'global',
                  inventoryCollection: isLocal ? 'inventory' : 'global_inventory',
                  storePrices: [
                    {
                      shopId: seller.id,
                      shopName: seller.shopName || seller.name || 'Store',
                      price,
                      inStock: true,
                    },
                  ],
                };

                allProducts.push(productItem);

                // Check if valid discount offer
                const offer = parseProductOffer(
                  { id: docSnap.id, ...data },
                  {
                    id: seller.id,
                    shopName: seller.shopName || seller.name,
                    shopImage: seller.shopImage || seller.profileImage || seller.image,
                    marketType: isLocal ? 'local' : 'global',
                  },
                );

                if (offer) {
                  allOffers.push(offer);
                }
              });

              // Shop is verified ONLY if it has at least 1 valid product
              if (validProductCount > 0) {
                verifiedSellers.push(seller);
              }
            } catch (shopErr) {
              console.log(
                `[DISCOVERY] Inventory read error for seller ${seller.id}:`,
                shopErr?.message,
              );
            }
          }

          if (cancelled) return;

          // Sort stores alphabetically (distance sorting completely removed)
          verifiedSellers.sort((a, b) =>
            (a.shopName || a.name || '').localeCompare(b.shopName || b.name || ''),
          );

          // Sort discount offers by discount percentage descending
          allOffers.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));

          setSellers(verifiedSellers);
          setProducts(allProducts);
          setOffers(allOffers);
        } catch (err) {
          console.log('[DISCOVERY] Discovery error:', err);
          if (!cancelled) {
            setSellers([]);
            setProducts([]);
            setOffers([]);
          }
        } finally {
          if (!cancelled) {
            setLoadingProducts(false);
            setLoadingOffers(false);
          }
        }
      },
      err => {
        console.log('[DISCOVERY] Sellers listener error:', err);
        if (!cancelled) {
          setSellers([]);
          setProducts([]);
          setOffers([]);
          setLoadingProducts(false);
          setLoadingOffers(false);
        }
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [customerCity, marketMode, db]);

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

    // Filter by Category using schema-aware ID, synonym, and keyword matching
    if (selectedCategory) {
      list = list.filter(product => isProductMatchingCategory(product, selectedCategory));
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

  // Filtered discount offers based on selected shop if any
  const displayedOffers = useMemo(() => {
    if (!selectedShop) return offers;
    return offers.filter(o => o.shopId === selectedShop.id);
  }, [offers, selectedShop]);

  const handleSelectOffer = useCallback(
    offer => {
      if (!offer) return;
      navigation.navigate('ProductDetailsScreen', {
        product: offer,
        marketMode,
      });
    },
    [navigation, marketMode],
  );

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
        categories={categories}
        categoriesLoading={categoriesLoading}
        categoriesError={categoriesError}
        onRetryCategories={retryLoadCategories}
        onLoadSubcategories={loadSubcategories}
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
            {/* 1. OFFERS SECTION (Horizontal Scrolling Discount Deals) */}
            <TopShopsCarousel
              offers={displayedOffers}
              loadingOffers={loadingOffers}
              onSelectOffer={handleSelectOffer}
              cityName={customerCity}
              language={language}
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
                {Boolean(selectedCategory || selectedShop) && (
                  <TouchableOpacity
                    style={{
                      marginTop: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: theme.neonGreen,
                    }}
                    onPress={() => {
                      setSelectedCategory(null);
                      setSelectedShop(null);
                    }}
                  >
                    <Text style={{ color: '#050906', fontWeight: '800', fontSize: 13 }}>
                      {isTamil ? 'அனைத்து பொருட்களையும் காட்டு' : 'Show all products'}
                    </Text>
                  </TouchableOpacity>
                )}
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
                        navigation.navigate('ProductDetailsScreen', {
                          product: item,
                          marketMode,
                        });
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

                        {/* Real Discount Badge on Grid Card if discounted */}
                        {item.hasDiscount && item.discountBadge ? (
                          <View style={styles.gridDiscountBadge}>
                            <Text style={styles.gridDiscountBadgeText}>
                              {item.discountBadge}
                            </Text>
                          </View>
                        ) : null}

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
                          {item.hasDiscount && item.originalPrice > item.price ? (
                            <Text style={styles.cardMrp}>₹{item.originalPrice}</Text>
                          ) : null}
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
  gridDiscountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 3,
  },
  gridDiscountBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
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
