import React, { useState, useEffect, useContext, useMemo ,  useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Keyboard,
  Platform,
  StatusBar,
  Animated,
  Easing,
  KeyboardAvoidingView,
} from 'react-native';

import { AuthContext } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';
import { getAuth } from '@react-native-firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  setDoc,
} from '@react-native-firebase/firestore';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { EmptyState } from '../../components/ui';
import { registerVoiceCommandHandler } from '../../services/voiceCommandBridge';

const { width } = Dimensions.get('window');
const H_PADDING = 16;
const PRODUCT_GAP = 10;
const PRODUCT_WIDTH = (width - H_PADDING * 2 - PRODUCT_GAP) / 2;
const shopProductsCache = {};

const GAP = 10;
const CARD_WIDTH =
  (width - H_PADDING * 2 - GAP) / 2;

const getImageUri = image => {
  if (typeof image === 'number') return null;

  const uri = typeof image === 'string' ? image : image?.uri;

  if (typeof uri !== 'string') return null;

  const normalizedUri = uri.trim();

  // Normal URLs + Base64 images
  return /^(https?:\/\/|file:\/\/|content:\/\/|ph:\/\/|data:image\/)/i.test(
    normalizedUri,
  )
    ? normalizedUri
    : null;
};

const getSafeImageSource = (image, fallbackUri = null) => {
  if (typeof image === 'number') return image;

  const uri =
    typeof image === 'string'
      ? image.trim()
      : typeof image?.uri === 'string'
        ? image.uri.trim()
        : null;

  if (
    uri &&
    /^(https?:\/\/|file:\/\/|content:\/\/|ph:\/\/|data:image\/)/i.test(uri)
  ) {
    return { uri };
  }

  if (image && typeof image === 'object' && typeof image.default === 'number') {
    return image.default;
  }

  return fallbackUri ? { uri: fallbackUri } : null;
};


const ImageFallback = ({ style }) => (
  <View
    style={[
      style,
      {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
      },
    ]}
  >
    <MaterialCommunityIcons
      name="image-off-outline"
      size={24}
      color="#94a3b8"
    />
  </View>
);

const ProductImage = ({ source, style, fallbackUri, resizeMode = 'cover' }) => {
  const [hasError, setHasError] = useState(false);
  const safeSource = getSafeImageSource(source, fallbackUri);

  useEffect(() => {
    setHasError(false);
  }, [safeSource]);

  if (!safeSource || hasError) {
    return <ImageFallback style={style} />;
  }

  return (
    <Image
      source={safeSource}
      style={style}
      resizeMode={resizeMode}
      onError={() => setHasError(true)}
      defaultSource={fallbackUri ? { uri: fallbackUri } : undefined}
    />
  );
};

const CATEGORY_DATA = [
  {
    id: 'apparel',
    shortName: 'Fashion',
    keywords: ['fashion', 'apparel', 'clothing', 'wear', 'shoe', 'shoes', 'bag', 'jewelry'],
    icon: require('../../asstesicons/woman.png'),
    activeIcon: require('../../asstesicons/woman(1).png'),
  },
  {
    id: 'electronics',
    shortName: 'Gadgets',
    keywords: ['electronic', 'mobile', 'phone', 'laptop', 'gadget', 'computer', 'camera'],
    icon: require('../../asstesicons/gadgets.png'),
    activeIcon: require('../../asstesicons/gadgets(1).png'),
  },
  {
    id: 'home',
    shortName: 'Furniture',
    keywords: ['home', 'furniture', 'sofa', 'chair', 'table', 'bed', 'garden', 'decor', 'kitchen'],
    icon: require('../../asstesicons/furniture.png'),
    activeIcon: require('../../asstesicons/furniture(1).png'),
  },
  {
    id: 'health',
    shortName: 'Beauty',
    keywords: ['health', 'beauty', 'makeup', 'skin', 'cosmetic', 'haircare', 'skincare'],
    icon: require('../../asstesicons/makeup.png'),
    activeIcon: require('../../asstesicons/makeup(1).png'),
  },
  {
    id: 'grocery',
    shortName: 'Grocery',
    keywords: ['grocery', 'food', 'fruit', 'vegetable', 'milk', 'rice'],
    icon: require('../../asstesicons/grocery.png'),
    activeIcon: require('../../asstesicons/grocery(1).png'),
  },
  {
    id: 'sports',
    shortName: 'Sports',
    keywords: ['sport', 'fitness', 'gym', 'exercise', 'outdoor'],
    icon: require('../../asstesicons/sports.png'),
    activeIcon: require('../../asstesicons/sports(1).png'),
  },
  {
    id: 'toys',
    shortName: 'Toys',
    keywords: ['toy', 'kids', 'baby', 'game'],
    icon: require('../../asstesicons/toys.png'),
    activeIcon: require('../../asstesicons/toys(1).png'),
  },
  {
    id: 'books',
    shortName: 'Books',
    keywords: ['book', 'books', 'stationery', 'media', 'music'],
    icon: require('../../asstesicons/stack-of-books.png'),
    activeIcon: require('../../asstesicons/stack-of-books(1).png'),
  },
  {
    id: 'automotive',
    shortName: 'Maintenance',
    keywords: ['auto', 'car', 'vehicle', 'hardware', 'tools'],
    icon: require('../../asstesicons/maintenance.png'),
    activeIcon: require('../../asstesicons/maintenance(1).png'),
  },
];

const STORE_FALLBACK_IMAGES = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTWB33WqgGHIOSdBnvhVz5EU-3733Ruze-ynqPWIW4Rag&s=10',
  'https://media.istockphoto.com/id/843318958/photo/indian-shop.jpg?s=612x612&w=0&k=20&c=iXs5JyWQ9g9-_UUnvrJF8GIwBcttA_o-K6kTz2cQNKg=',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTeVgRVaLlmsB7g0rSS63-dCmf8MwTyDKFXEA_8yEtT5aD1DDLV5m44bSJK&s=10',
  'https://cdn.balloondekor.com/38/balloon-gate-for-shop-opening-2.webp',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRi6pL1nMUQZBEjW8LVLLsz4-wXuPNXxusK1SCR9OWQFDNvS4tTTvTM9bs&s=10',
];

const PRODUCT_FALLBACK_IMAGE = 'https://static.vecteezy.com/system/resources/previews/015/413/291/non_2x/shopping-trolley-full-of-food-fruit-products-grocery-goods-grocery-shopping-cart-buying-food-in-supermarket-illustration-for-banner-vector.jpg';

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (
    !Number.isFinite(Number(lat1)) ||
    !Number.isFinite(Number(lon1)) ||
    !Number.isFinite(Number(lat2)) ||
    !Number.isFinite(Number(lon2))
  ) {
    return 999;
  }

  const R = 6371;
  const dLat = (Number(lat2) - Number(lat1)) * Math.PI / 180;
  const dLon = (Number(lon2) - Number(lon1)) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(Number(lat1) * Math.PI / 180) *
      Math.cos(Number(lat2) * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const normalize = value =>
  String(value || '')
    .trim()
    .toLowerCase();

const getCustomerAddressText = address => {
  if (!address || typeof address !== 'object') {
    if (typeof address === 'string') {
      const cleaned = address.trim();
      return cleaned || 'Set your delivery location';
    }

    return 'Set your delivery location';
  }

  const directAddress = [
    address.fullAddress,
    address.googleFormattedAddress,
    address.formattedAddress,
    address.displayAddress,
  ]
    .map(value => String(value || '').trim())
    .find(Boolean);

  if (directAddress) {
    const compactParts = directAddress
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .filter((part, index, array) => array.indexOf(part) === index);

    return compactParts.slice(0, 4).join(', ');
  }

  const structuredParts = [
    address.area,
    address.city,
    address.district,
    address.state,
    address.country,
    address.pincode,
  ]
    .map(part => {
      if (part === null || part === undefined) return '';
      return String(part).trim();
    })
    .filter(Boolean)
    .filter((part, index, array) => array.indexOf(part) === index);

  if (structuredParts.length) {
    return structuredParts.slice(0, 4).join(', ');
  }

  return 'Set your delivery location';
};
const getBroadCategoryId = product => {
  const source = normalize(
    `${product?.category || ''} ${product?.name || ''} ${product?.itemNo || ''}`,
  );

  const found = CATEGORY_DATA.find(category =>
    category.keywords.some(keyword => source.includes(keyword)),
  );

  return found?.id || 'grocery';
};

export default function CustomerHome({ navigation }) {
   const db = getFirestore();
  const insets = useSafeAreaInsets();
  const authInstance = getAuth();
  const { user, customerData } = useContext(AuthContext);
  const { bgMain, bgCard, textMain, textSub, border, isDarkMode } =
    useContext(ThemeContext);

  const [products, setProducts] = useState([]);
  const [nearSellerIds, setNearSellerIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [cart, setCart] = useState({});
  const [marketMode, setMarketMode] = useState('local');
  const [selectedCategory, setSelectedCategory] = useState(null);
const [addingId, setAddingId] = useState(null);
const cartIconRef = useRef(null);
const searchInputRef = useRef(null);
const searchPanelAnim = useRef(new Animated.Value(0)).current;
const [cartTarget, setCartTarget] = useState(null);
const [flyingImage, setFlyingImage] = useState(null);
const [keyboardHeight, setKeyboardHeight] = useState(0);

const flyOpacity = useRef(new Animated.Value(0)).current;
const flyScale = useRef(new Animated.Value(1)).current;
const flyTranslateX = useRef(new Animated.Value(0)).current;
const flyTranslateY = useRef(new Animated.Value(0)).current;
const cartIconScale = useRef(new Animated.Value(1)).current;

const openSearch = () => {
  searchPanelAnim.setValue(0);
  setIsSearchOpen(true);
  setKeyboardHeight(0);

  requestAnimationFrame(() => {
    Animated.timing(searchPanelAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  });
};

const closeSearch = () => {
  Keyboard.dismiss();
  searchInputRef.current?.blur();
  setKeyboardHeight(0);

  Animated.timing(searchPanelAnim, {
    toValue: 0,
    duration: 180,
    easing: Easing.in(Easing.cubic),
    useNativeDriver: true,
  }).start(({ finished }) => {
    if (finished) setIsSearchOpen(false);
  });
};

useEffect(() => {
  if (!isSearchOpen) return undefined;

  const keyboardShowEvent =
    Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
  const keyboardHideEvent =
    Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

  const handleKeyboardShow = event => {
    const nextHeight =
      Number(event?.endCoordinates?.height ?? event?.keyboardHeight ?? 0) || 0;
    setKeyboardHeight(Math.max(0, nextHeight));
  };

  const handleKeyboardHide = () => {
    setKeyboardHeight(0);
  };

  const showListener = Keyboard.addListener(keyboardShowEvent, handleKeyboardShow);
  const hideListener = Keyboard.addListener(keyboardHideEvent, handleKeyboardHide);

  return () => {
    showListener.remove();
    hideListener.remove();
  };
}, [isSearchOpen]);

useEffect(() => {
  if (!isSearchOpen) return;

  requestAnimationFrame(() => {
    searchInputRef.current?.focus();
  });
}, [isSearchOpen]);

const playCartPopAnimation = () => {
  cartIconScale.setValue(1);

  Animated.sequence([
    Animated.spring(cartIconScale, {
      toValue: 1.22,
      friction: 4,
      tension: 180,
      useNativeDriver: true,
    }),
    Animated.spring(cartIconScale, {
      toValue: 1,
      friction: 4,
      tension: 150,
      useNativeDriver: true,
    }),
  ]).start();
};
const playAddAnimation = image => {
  const imageUri = getImageUri(image);
  if (!imageUri || !cartTarget) return;

  flyOpacity.setValue(1);
  flyScale.setValue(1);
  flyTranslateX.setValue(0);
  flyTranslateY.setValue(0);

  setFlyingImage(imageUri);

  requestAnimationFrame(() => {
    Animated.parallel([
      Animated.timing(flyTranslateX, {
        toValue: cartTarget.x - (width / 2),
        duration: 550,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(flyTranslateY, {
        toValue:
          cartTarget.y -
          Dimensions.get('window').height * 0.4,
        duration: 550,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(flyScale, {
        toValue: 0.12,
        duration: 550,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(flyOpacity, {
        toValue: 0,
        duration: 550,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setFlyingImage(null);
      playCartPopAnimation();
    });
  });
};
  // Live cart synchronizer.
  useEffect(() => {
    if (!user) return;

    const cartDocRef = doc(
      db,
      'customers',
      user.uid,
      'cart',
      'mainCart',
    );

    const unsubscribe = onSnapshot(
      cartDocRef,
      snapshot => {
        setCart(
          snapshot.exists()
            ? snapshot.data()?.items || {}
            : {},
        );
      },
    );

    return () => unsubscribe();
  }, [user]);

  // Nearby seller calculation.
  const activeAddress = customerData?.address || {};
  const customerLat = activeAddress?.lat;
  const customerLon = activeAddress?.lon;

  const locationSource =
    activeAddress?.locationSource ||
    (Number.isFinite(Number(customerLat)) &&
    Number.isFinite(Number(customerLon))
      ? 'gps'
      : 'manual');

  useEffect(() => {
   const sellerQuery = query(
  collection(db, 'users'),
  where('role', '==', 'seller'),
);

const unsubscribe = onSnapshot(
  sellerQuery,
        snapshot => {
          const sellerIds = [];

          const customerHasGps =
            locationSource === 'gps' &&
            Number.isFinite(Number(customerLat)) &&
            Number.isFinite(Number(customerLon));

          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const sellerAddress = data?.address || {};

            if (marketMode === 'global') {
              sellerIds.push(docSnap.id);
              return;
            }

            if (customerHasGps) {
              const shopLat = sellerAddress?.lat;
              const shopLon = sellerAddress?.lon;

              if (
                !Number.isFinite(Number(shopLat)) ||
                !Number.isFinite(Number(shopLon))
              ) {
                return;
              }

              const distance = calculateDistance(
                customerLat,
                customerLon,
                shopLat,
                shopLon,
              );

              if (distance <= 3) {
                sellerIds.push(docSnap.id);
              }

              return;
            }

const customerCity = normalize(activeAddress?.city);
const customerDistrict = normalize(activeAddress?.district);
const customerState = normalize(activeAddress?.state);
const customerCountry = normalize(activeAddress?.country);

const sellerCity = normalize(sellerAddress?.city);
const sellerDistrict = normalize(sellerAddress?.district);
const sellerState = normalize(sellerAddress?.state);
const sellerCountry = normalize(sellerAddress?.country);

const sameCountry =
  !customerCountry ||
  !sellerCountry ||
  customerCountry === sellerCountry;

const sameState =
  !customerState ||
  !sellerState ||
  customerState === sellerState;

const sameDistrict =
  !customerDistrict ||
  !sellerDistrict ||
  customerDistrict === sellerDistrict;

if (
  customerCity &&
  sellerCity &&
  customerCity === sellerCity &&
  sameDistrict &&
  sameState &&
  sameCountry
) {
  sellerIds.push(docSnap.id);
  return;
}

if (
  !customerCity &&
  customerDistrict &&
  sellerDistrict &&
  customerDistrict === sellerDistrict &&
  sameState &&
  sameCountry
) {
  sellerIds.push(docSnap.id);
  return;
}

if (
  !customerCity &&
  !customerDistrict &&
  customerState &&
  sellerState &&
  customerState === sellerState &&
  sameCountry
) {
  sellerIds.push(docSnap.id);
  return;
}

          });

          setNearSellerIds(sellerIds);
        },
        error => {
          console.error('SELLER LOCATION SYNC ERROR:', error);
          setNearSellerIds([]);
        },
      );

    return () => unsubscribe();
  }, [
    locationSource,
    customerLat,
    customerLon,
    activeAddress?.state,
    activeAddress?.district,
    activeAddress?.city,
   activeAddress?.area,
activeAddress?.country,
marketMode,
  ]);
    // Load products from nearby / global sellers
  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      try {
        setLoading(true);

        const sellerIds =
          marketMode === 'global'
            ? nearSellerIds
            : nearSellerIds;

        if (!sellerIds.length) {
          if (!cancelled) {
            setProducts([]);
            setLoading(false);
          }
          return;
        }

        const targetCollection =
          marketMode === 'global'
            ? 'global_inventory'
            : 'inventory';

        const allProducts = [];

        for (const sellerId of sellerIds) {
  const snapshot = await getDocs(
    collection(
      db,
      'users',
      sellerId,
      targetCollection,
    ),
  );

  snapshot.forEach(doc => {
    const data = doc.data();

    const quantity = Number(
      data.quantity || 0
    );

    if (quantity <= 0) return;

    allProducts.push({
      id: doc.id,
      shopId: sellerId,
      marketType: marketMode,
      shopName:
        data.shopName ||
        data.sellerName ||
        'Shop',
      name:
        data.itemName ||
        data.name ||
        'Product',
      price: Number(
        data.salesPrice ||
        data.price ||
        0
      ),
      quantity,
      category:
        data.category ||
        'General',
      img:
        getImageUri(data.image) ||
        getImageUri(data.img) ||
        null,
      itemNo:
        data.itemNo || '',
      unit:
        data.unit ||
        data.measurement ||
        '',
    });
  });
}

        if (!cancelled) {
          setProducts(allProducts);
          setLoading(false);
        }
      } catch (error) {
        console.log(

          'CUSTOMER HOME PRODUCTS ERROR:',
          error
        );

        if (!cancelled) {
          setProducts([]);
          setLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [nearSellerIds, marketMode]); 
  const filteredProducts = useMemo(() => {
    const search = normalize(searchQuery);

    return products.filter(product => {
      const matchesSearch =
        normalize(product.name).includes(search) ||
        normalize(product.itemNo).includes(search);

      const matchesCategory =
        !selectedCategory ||
        getBroadCategoryId(product) === selectedCategory;

      if (marketMode === 'local') {
        return (
          nearSellerIds.includes(product.shopId) &&
          matchesCategory &&
          matchesSearch
        );
      }

      return matchesCategory && matchesSearch;
    });
  }, [
    products,
    searchQuery,
    selectedCategory,
    marketMode,
    nearSellerIds,
  ]);

  const cartArray = Object.values(cart || {});

  const totalItems = cartArray.reduce(
    (sum, item) => sum + Number(item?.qty || 0),
    0,
  );

  const customerName =
    customerData?.name ||
    customerData?.fullName ||
    'Customer';

  const [shopDirectory, setShopDirectory] = useState({});

  useEffect(() => {
    if (!nearSellerIds.length) {
      setShopDirectory({});
      return undefined;
    }

    const sellerIds = Array.from(new Set(nearSellerIds)).slice(0, 20);

    if (!sellerIds.length) {
      setShopDirectory({});
      return undefined;
    }

    const q = query(collection(db, 'users'), where('__name__', 'in', sellerIds));

    const unsubscribe = onSnapshot(q, snapshot => {
      const nextDirectory = {};

      snapshot.forEach(docSnap => {
        const data = docSnap.data() || {};
        const sellerAddress = data?.address || {};
        const shopLat = Number(sellerAddress?.lat);
        const shopLon = Number(sellerAddress?.lon);
        const hasShopCoords =
          Number.isFinite(shopLat) && Number.isFinite(shopLon);

        const distanceKm =
          Number.isFinite(Number(customerLat)) &&
          Number.isFinite(Number(customerLon)) &&
          hasShopCoords
            ? calculateDistance(customerLat, customerLon, shopLat, shopLon)
            : null;

        nextDirectory[docSnap.id] = {
          shopName:
            data?.shopName ||
            data?.businessName ||
            data?.name ||
            'Shop',
        
img:
  getImageUri(data?.[`${marketMode}_shopImage`]) ||
  getImageUri(data?.shopImage) ||
  getImageUri(data?.image) ||
  getImageUri(data?.img) ||
  getImageUri(data?.logo) ||
  null,

          location:
            sellerAddress?.city ||
            sellerAddress?.district ||
            sellerAddress?.area ||
            sellerAddress?.state ||
            'Local store',
          distanceKm,
        };
      });

      setShopDirectory(nextDirectory);
    });

    return () => unsubscribe();
  }, [nearSellerIds, customerLat, customerLon, db]);

  const safeFlyingSource = getSafeImageSource({ uri: flyingImage });
 
  const storeList = useMemo(() => {
    const map = new Map();

    filteredProducts.forEach(item => {
      if (item?.shopId && item?.shopName && !map.has(item.shopId)) {
        const shopMeta = shopDirectory[item.shopId] || {};
        const shopLocation =
          shopMeta.location ||
          item?.shopLocation ||
          customerData?.address?.city ||
          customerData?.address?.district ||
          'Local store';

        const distanceKm = Number.isFinite(Number(shopMeta.distanceKm))
          ? Number(shopMeta.distanceKm)
          : null;

        const fallbackImage =
          STORE_FALLBACK_IMAGES[
            (Array.from(map.keys()).length + 1) % STORE_FALLBACK_IMAGES.length
          ];

        const shopImage =
          shopMeta.img && getImageUri(shopMeta.img)
            ? shopMeta.img
            : fallbackImage;

        map.set(item.shopId, {
          shopId: item.shopId,
          shopName: shopMeta.shopName || item.shopName || 'Shop',
          img: shopImage,
          shopLocation,
          distanceKm,
        });
      }
    });

    return Array.from(map.values()).slice(0, 8);
  }, [filteredProducts, shopDirectory, customerData?.address?.city, customerData?.address?.district]);

  const handleAddToCart = async (item, requestedQty = 1) => {
  const firebaseUser = authInstance.currentUser;

  if (!firebaseUser) {
    navigation.navigate('Login');
    return false;
  }

  const existingQty = Number(
    cart?.[item.id]?.qty || 0
  );
  const quantityToAdd = Math.max(1, Math.floor(Number(requestedQty) || 1));

  // Stock limit
  if (
    existingQty + quantityToAdd > Number(item.quantity || 0)
  ) {
    return false;
  }

  const previousCart = cart;

  const updatedCart = {
    ...cart,

    [item.id]: {
      ...item,
      qty: existingQty + quantityToAdd,
    },
  };

  // -----------------------------------------------
  // 1. INSTANT UI UPDATE
  // -----------------------------------------------

  setCart(updatedCart);


  setAddingId(item.id);

  try {
  

    await setDoc(
      doc(db, 'customers', firebaseUser.uid, 'cart', 'mainCart'),
      {
        items: updatedCart,
        updatedAt:
          new Date().toISOString(),
      },
    );
   playAddAnimation(item.img);
playCartPopAnimation();
return true;

  } catch (error) {
    console.log(
      'ADD TO CART ERROR:',
      error
    );

    // ---------------------------------------------
    // Firebase failed → rollback UI
    // ---------------------------------------------

    setCart(previousCart);
    return false;

  } finally {
    setTimeout(() => {
      setAddingId(null);
    }, 250);
  }
};
const updateQty = async (itemId, action) => {
  const firebaseUser = authInstance.currentUser;

  if (!firebaseUser) {
    navigation.navigate('Login');
    return;
  }

  const previousCart = cart;
  const currentItem = cart?.[itemId];

  if (!currentItem) return;

  const currentQty = Number(currentItem.qty || 0);
  const stockQty = Number(currentItem.quantity || 0);

  let newQty =
    action === 'add' ? currentQty + 1 : currentQty - 1;

  // Stock limit check
  if (action === 'add' && newQty > stockQty) {
    return;
  }

  // Quantity 0 aana cart-lendhu remove pannum
  const updatedCart = { ...previousCart };

  if (newQty <= 0) {
    delete updatedCart[itemId];
  } else {
    updatedCart[itemId] = {
      ...currentItem,
      qty: newQty,
    };
  }

  // Immediate UI update
  setCart(updatedCart);

  try {
    // Save updated quantity to Firebase
    await setDoc(
      doc(
        db,
        'customers',
        firebaseUser.uid,
        'cart',
        'mainCart',
      ),
      {
        items: updatedCart,
        updatedAt: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.log('UPDATE CART QTY ERROR:', error);

    // Save fail aana previous cart restore pannum
    setCart(previousCart);
  }
};

  useEffect(() => {
    return registerVoiceCommandHandler(async command => {
      if (command.intent === 'OPEN_ORDERS') {
        navigation.navigate('OrdersScreen');
        return 'Opening your orders.';
      }

      if (command.intent === 'SHOW_NEARBY_SHOPS') {
        setMarketMode('local');
        setSearchQuery('');
        setSelectedCategory(null);
        return 'Showing nearby shops and products.';
      }

      const search = normalize(command.query);
      if (!search) {
        return 'Please say which product you are looking for.';
      }

      const matches = products
        .map(product => {
          const name = normalize(`${product.name} ${product.itemNo}`);
          const score = name === search ? 3 : name.includes(search) ? 2 : search.includes(name) ? 1 : 0;
          return { product, score };
        })
        .filter(result => result.score > 0)
        .sort((a, b) => b.score - a.score);

      if (!matches.length) {
        if (command.intent === 'SEARCH_PRODUCT') {
          setSearchQuery(command.query);
          setSelectedCategory(null);
        }
        return `I could not find ${command.query} in the currently available products.`;
      }

      const product = matches[0].product;
      if (command.intent === 'OPEN_PRODUCT') {
        navigation.navigate('ProductDetailsScreen', { product, marketMode });
        return `Opening ${product.name}.`;
      }

      if (command.intent === 'ADD_TO_CART') {
        const quantity = Math.min(99, Math.max(1, Math.floor(Number(command.quantity) || 1)));
        const added = await handleAddToCart(product, quantity);
        return added
          ? `Added ${quantity} ${product.unit || ''} ${product.name} to your cart.`.replace(/\s+/g, ' ').trim()
          : `I could not add ${quantity} ${product.name}. Please check that you are signed in and enough stock is available.`;
      }

      setSearchQuery(command.query);
      setSelectedCategory(null);
      return `Showing products matching ${command.query}.`;
    });
  }, [handleAddToCart, marketMode, navigation, products]);

  const addressText = getCustomerAddressText(customerData?.address);

  const renderCategory = category => {
    const selected = selectedCategory === category.id;

    return (
      <TouchableOpacity
        key={category.id}
        activeOpacity={0.75}
        onPress={() =>
          setSelectedCategory(selected ? null : category.id)
        }
        style={[
          styles.categoryItem,
          selected && styles.categoryItemSelected,
        ]}
      >
        <View
          style={[
            styles.categoryIconWrap,
            selected && styles.categoryIconWrapSelected,
          ]}
        >
          <Image
            source={selected ? category.activeIcon : category.icon}
            style={styles.categoryIcon}
            resizeMode="contain"
          />
        </View>

        <Text
          numberOfLines={1}
          style={[
            styles.categoryLabel,
            selected && styles.categoryLabelSelected,
          ]}
        >
          {category.shortName}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bgMain || '#f7faf8' },
      ]}
    >
      <StatusBar
        backgroundColor="#ecf9f1"
        barStyle="dark-content"
      />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.locationBlock}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('LocationPickerScreen')}
            >
              <Text style={styles.deliveringLabel}>DELIVERING TO</Text>

              <View style={styles.locationTitleRow}>
                <View style={styles.locationDot}>
                  <MaterialCommunityIcons
                    name="map-marker"
                    size={17}
                    color="#0b9d50"
                  />
                </View>

                <Text numberOfLines={2} style={styles.locationTitle}>
                  {addressText}
                </Text>

                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color="#0f172a"
                />
              </View>
            </TouchableOpacity>

<TouchableOpacity
  style={styles.avatar}
  onPress={() =>
    user
      ? navigation.navigate('ProfileSettingsScreen')
      : navigation.navigate('Login')
  }
  activeOpacity={0.8}
  accessibilityRole="button"
  accessibilityLabel="Open profile"
>
  <MaterialCommunityIcons
    name="account-circle-outline"
    size={30}
    color="#0B9D50"
  />
</TouchableOpacity>

          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0b9d50" />
          <Text style={styles.loadingText}>
            Loading stores & products...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          numColumns={2}
          keyExtractor={item => `${item.shopId}-${item.id}`}
          columnWrapperStyle={styles.productRow}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(126, insets.bottom + 100) },
          ]}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          ListHeaderComponent={
            <>
              <View style={styles.categoryHeader}>
                <View>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: textMain || '#0f172a' },
                    ]}
                  >
                    Shop by category
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    Everything you need in one place
                  </Text>
                </View>

                {selectedCategory ? (
                  <TouchableOpacity
                    onPress={() => setSelectedCategory(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.clearCategoryText}>
                      Clear
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {CATEGORY_DATA.map(renderCategory)}
              </ScrollView>

              

              <View style={styles.sectionHeading}>
                <View style={styles.sectionHeadingRow}>
                  <View style={styles.sectionAccent} />
                  <View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: textMain || '#0f172a' },
                      ]}
                    >
                      {marketMode === 'local'
                        ? 'Nearby Stores'
                        : 'Available Stores'}
                    </Text>

                    <Text style={styles.sectionSubtitle}>
                      Fresh products from local sellers
                    </Text>
                  </View>
                </View>
              </View>

              {storeList.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.storeScroll}
                >
                  {storeList.map((store, index) => {
                    const shopDistance =
                      Number.isFinite(Number(store.distanceKm))
                        ? Number(store.distanceKm)
                        : null;

                    const imageSource =
                      getImageUri(store.img) ||
                      STORE_FALLBACK_IMAGES[index % STORE_FALLBACK_IMAGES.length];

                    return (
                      <TouchableOpacity
                        key={store.shopId}
                        style={styles.shopItem}
                        activeOpacity={0.88}
                        onPress={() =>
                          navigation.navigate('ShopProductsScreen', {
                            shopId: store.shopId,
                            shopName: store.shopName,
                            shopImage:
                              store.img ||
                              STORE_FALLBACK_IMAGES[
                                index % STORE_FALLBACK_IMAGES.length
                              ],
                            marketMode,
                          })
                        }
                      >
                        <View style={styles.shopImageContainer}>
                          <ProductImage
                            source={{
                              uri: imageSource,
                            }}
                            style={styles.shopImage}
                            fallbackUri={
                              STORE_FALLBACK_IMAGES[
                                index % STORE_FALLBACK_IMAGES.length
                              ]
                            }
                          />

                          {shopDistance !== null ? (
                            <View style={styles.distanceBadge}>
                              <Text style={styles.distanceBadgeText}>
                                {shopDistance < 1
                                  ? '< 1 km'
                                  : `${shopDistance.toFixed(1)} km`}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={styles.shopName} numberOfLines={1}>
                          {store.shopName}
                        </Text>

                        <View style={styles.shopLocationRow}>
                          <MaterialCommunityIcons
                            name="map-marker-outline"
                            size={10}
                            color="#64748b"
                          />
                          <Text style={styles.shopLocation} numberOfLines={1}>
                            {store.shopLocation || 'Local store'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.noStoreHint}>
                  <Text style={styles.noStoreHintText}>
                    No nearby stores found
                  </Text>
                </View>
              )}

              <View style={styles.sectionHeadingProducts}>
                <View>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: textMain || '#0f172a' },
                    ]}
                  >
                    Popular Products
                  </Text>

                  <Text style={styles.sectionSubtitle}>
                    {selectedCategory
                      ? 'Products in the selected category'
                      : 'Top picks from available stores'}
                  </Text>
                </View>

                {selectedCategory ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setSelectedCategory(null)}
                  >
                    <Text style={styles.clearCategoryText}>
                      View all
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyProducts}>
              <EmptyState
                icon="store-search-outline"
                title="No products found"
                description={
                  marketMode === 'local'
                    ? 'No products were found in nearby stores.'
                    : 'Try another category or search term.'
                }
              />
            </View>
          }
          renderItem={({ item }) => {
            const cartItem = cart[item.id];

            return (
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() =>
                  navigation.navigate('ProductDetailsScreen', {
                    product: item,
                    marketMode,
                  })
                }
                style={[
                  styles.productCard,
                  {
                    backgroundColor: bgCard,
                  },
                ]}
              >
                <View style={styles.productImageBox}>
                  <ProductImage
                    source={{
                      uri: getImageUri(item.img) || PRODUCT_FALLBACK_IMAGE,
                    }}
                    style={styles.productImage}
                    fallbackUri={PRODUCT_FALLBACK_IMAGE}
                  />

                  <View style={styles.favoriteButton}>
                    <MaterialCommunityIcons
                      name="heart-outline"
                      size={19}
                      color="#64748b"
                    />
                  </View>
                </View>

                <View style={styles.productDetails}>
                  <Text
                    style={[
                      styles.productName,
                      {
                        color:
                          textMain || '#0f172a',
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>

                  <Text
                    style={[
                      styles.productUnit,
                      {
                        color:
                          textSub || '#64748b',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.itemNo
                      ? `Code ${item.itemNo}`
                      : item.shopName}
                  </Text>

                  <View style={styles.productBottomRow}>
                    <Text style={styles.productPrice}>
                      ₹{item.price.toLocaleString('en-IN')}
                    </Text>

                    {item.quantity <= 0 ? (
                      <Text style={styles.outOfStock}>
                        Sold out
                      </Text>
                    ) : cartItem ? (
                      <View style={styles.qtySelector}>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() =>
                            updateQty(item.id, 'sub')
                          }
                        >
                          <MaterialCommunityIcons
                            name="minus"
                            size={17}
                            color="#0b9d50"
                          />
                        </TouchableOpacity>

                        <Text style={styles.qtyValue}>
                          {cartItem.qty}
                        </Text>

                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() =>
                            updateQty(item.id, 'add')
                          }
                        >
                          <MaterialCommunityIcons
                            name="plus"
                            size={17}
                            color="#0b9d50"
                          />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addCircle}
                        onPress={() =>
                          handleAddToCart(item)
                        }
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons
                          name="plus"
                          size={21}
                          color="#fff"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {isSearchOpen && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.searchDock,
            {
              bottom: Math.max(keyboardHeight, 0) + Math.max(insets.bottom, 0),
            },
          ]}
        >
          <Animated.View
            style={[
              styles.searchPanel,
              {
                opacity: searchPanelAnim,
                transform: [
                  {
                    translateY: searchPanelAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open AI search"
              onPress={() =>
                navigation.navigate('AIMicScreen', {
                  nearSellerIds,
                  addressText,
                })
              }
              style={styles.aiMicButton}
            >
              <MaterialCommunityIcons
                name="microphone-outline"
                size={19}
                color="#0b9d50"
              />
            </TouchableOpacity>

            <TextInput
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search products or stores"
              placeholderTextColor="#94a3b8"
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.searchInput}
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            <TouchableOpacity
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Close search"
              onPress={closeSearch}
              style={styles.searchCloseButton}
            >
              <MaterialCommunityIcons
                name="close"
                size={20}
                color="#475569"
              />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      {/* Bottom navigation: Categories removed. Market switch is the unique center action. */}
      {!isSearchOpen && (
        <View
          style={[
            styles.bottomNav,
            {
              bottom: Math.max(insets.bottom, 8) + 8,
              backgroundColor: isDarkMode
                ? 'rgba(20,20,24,0.82)'
                : 'rgba(255,255,255,0.78)',
              borderColor: isDarkMode
                ? 'rgba(255,255,255,0.14)'
                : 'rgba(15,23,42,0.08)',
            },
          ]}
        >
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setSelectedCategory(null)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.navIconCircle,
                !selectedCategory && styles.navIconCircleActive,
              ]}
            >
              <MaterialCommunityIcons
                name="home-variant-outline"
                size={23}
                color={
                  !selectedCategory
                    ? '#0b9d50'
                    : isDarkMode ? '#cbd5e1' : '#475569'
                }
              />
            </View>
            <Text
              style={[
                styles.navLabel,
                isDarkMode && styles.navLabelDark,
                !selectedCategory && styles.navLabelActive,
              ]}
            >
              Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate('OrdersScreen')}
            activeOpacity={0.8}
          >
            <View style={styles.navIconCircle}>
              <MaterialCommunityIcons
                name="clipboard-list-outline"
                size={23}
                color={isDarkMode ? '#cbd5e1' : '#475569'}
              />
            </View>
            <Text style={[styles.navLabel, isDarkMode && styles.navLabelDark]}>Orders</Text>
          </TouchableOpacity>

          <View style={styles.marketSwitchSlot}>
            <View style={styles.marketSwitch}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setMarketMode('local')}
                style={[
                  styles.marketButton,
                  marketMode === 'local' && styles.marketButtonActive,
                ]}
              >
                <MaterialCommunityIcons
                  name="map-marker-radius"
                  size={15}
                  color={marketMode === 'local' ? '#ffffff' : '#0b9d50'}
                />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={[
                    styles.marketButtonText,
                    marketMode === 'local' && styles.marketButtonTextActive,
                  ]}
                >
                  Local
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setMarketMode('global')}
                style={[
                  styles.marketButton,
                  marketMode === 'global' && styles.marketButtonActive,
                ]}
              >
                <MaterialCommunityIcons
                  name="earth"
                  size={15}
                  color={marketMode === 'global' ? '#ffffff' : '#0b9d50'}
                />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={[
                    styles.marketButtonText,
                    marketMode === 'global' && styles.marketButtonTextActive,
                  ]}
                >
                  Global
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            ref={cartIconRef}
            onLayout={() => {
              cartIconRef.current?.measureInWindow((x, y, w, h) => {
                setCartTarget({ x: x + w / 2, y: y + h / 2 });
              });
            }}
            style={styles.navItem}
            onPress={() => navigation.navigate('CartScreen', { cartData: cart })}
            activeOpacity={0.8}
          >
            <View style={styles.navIconCircle}>
              <Animated.View
                style={{ transform: [{ scale: cartIconScale }] }}
              >
                <MaterialCommunityIcons
                  name="cart-outline"
                  size={24}
                  color={isDarkMode ? '#cbd5e1' : '#475569'}
                />
              </Animated.View>
              {totalItems > 0 ? (
                <View style={styles.navCartBadge}>
                  <Text style={styles.navCartBadgeText}>
                    {totalItems > 99 ? '99+' : totalItems}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.navLabel, isDarkMode && styles.navLabelDark]}>Cart</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={isSearchOpen ? closeSearch : openSearch}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isSearchOpen ? 'Close search' : 'Open search'}
          >
            <View
              style={[
                styles.navIconCircle,
                isSearchOpen && styles.navIconCircleActive,
              ]}
            >
              <MaterialCommunityIcons
                name="magnify"
                size={24}
                color={isSearchOpen ? '#0b9d50' : isDarkMode ? '#cbd5e1' : '#475569'}
              />
            </View>
            <Text
              style={[
                styles.navLabel,
                isDarkMode && styles.navLabelDark,
                isSearchOpen && styles.navLabelActive,
              ]}
            >
              Search
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {safeFlyingSource && (
        <Animated.Image
          source={safeFlyingSource}
          style={{
            position: 'absolute',
            top: '40%',
            left: '35%',
            width: 64,
            height: 64,
            borderRadius: 12,
            opacity: flyOpacity,
            zIndex: 9999,
            transform: [
              { translateX: flyTranslateX },
              { translateY: flyTranslateY },
              { scale: flyScale },
            ],
          }}
          resizeMode="contain"
          pointerEvents="none"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  safeArea: {
    backgroundColor: '#ecf9f1',
  },

  header: {
    backgroundColor: '#ecf9f1',
    paddingHorizontal: H_PADDING,
    paddingBottom: 12,
  },

  headerTop: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  locationBlock: {
    flex: 1,
    paddingRight: 12,
    borderRadius: 18,
    backgroundColor: '#f4fbf7',
    borderWidth: 1,
    borderColor: '#d9f2e4',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avatar: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#D7F0E1',
  alignItems: 'center',
  justifyContent: 'center',
  elevation: 2,
},

  deliveringLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 5,
  },

  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  locationDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dcf6e6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  locationTitle: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dff5e8',
    borderColor: '#c5ebd3',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  avatarText: {
    color: '#087b3c',
    fontSize: 17,
    fontWeight: '800',
  },

  aiMicButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e8f8ee',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },

  searchCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 10,
    paddingVertical: 0,
    color: '#0f172a',
  },

  bottomNav: {
  position: 'absolute',
  left: 10,
  right: 10,
  height: 76,
  borderRadius: 32,
  borderWidth: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 5,

  shadowColor: '#0f172a',
  shadowOpacity: 0.15,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 7 },
  elevation: 14,
},

navItem: {
  flex: 0.9,
  minWidth: 0,
  minHeight: 52,
  alignItems: 'center',
  justifyContent: 'center',
},

  navIconCircle: {
    width: 42,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navIconCircleActive: {
    backgroundColor: 'rgba(11,157,80,0.12)',
  },

  navLabel: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },

  navLabelActive: {
    color: '#0b9d50',
    fontWeight: '900',
  },

  navLabelDark: {
    color: '#cbd5e1',
  },

  navCartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },

  navCartBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
  },
marketSwitchSlot: {
  flex: 2.8,
  minWidth: 0,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 2,
},

marketSwitch: {
  width: '100%',
  height: 48,
  flexDirection: 'row',
  alignItems: 'center',
  padding: 3,
  borderRadius: 24,
  backgroundColor: '#E7F5EC',
  borderWidth: 1,
  borderColor: '#CBE9D5',
},

marketButton: {
  flex: 1,
  minWidth: 0,
  height: 40,
  borderRadius: 20,
  paddingHorizontal: 3,
  backgroundColor: 'transparent',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
},

marketButtonActive: {
  backgroundColor: '#0B9D50',
  elevation: 2,
},

marketButtonText: {
  color: '#087B3C',
  fontSize: 13,
  lineHeight: 17,
  fontWeight: '700',
  textAlign: 'center',
  includeFontPadding: false,
}, 

marketButtonTextActive: {
  color: '#FFFFFF',
  fontWeight: '800',
},
  searchDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
  },

  searchPanel: {
    marginHorizontal: H_PADDING,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },

  listContent: {
    paddingTop: 14,
    paddingBottom: 126,
  },

  categoryHeader: {
    paddingHorizontal: H_PADDING,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: 0.1,
  },

  sectionSubtitle: {
    color: '#94a3b8',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '500',
    marginTop: 2,
  },

  clearCategoryText: {
    color: '#0b9d50',
    fontSize: 12,
    fontWeight: '700',
  },

  categoryScroll: {
    backgroundColor: '#ffffff',
    paddingHorizontal: H_PADDING,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 8,
  },

  categoryItem: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  categoryItemSelected: {
    transform: [{ scale: 1.02 }],
  },

  categoryIconWrap: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },

  categoryIconWrapSelected: {
    borderRadius: 23,
    backgroundColor: '#e8f8ef',
  },

  categoryIcon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },

  categoryLabel: {
    minHeight: 14,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },

  categoryLabelSelected: {
    color: '#0b9d50',
    fontWeight: '700',
  },

  deliveryCard: {
    marginHorizontal: H_PADDING,
    marginTop: 17,
    marginBottom: 22,
    minHeight: 94,
    borderRadius: 21,
    backgroundColor: '#edf9f2',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },

  deliveryIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#dcf6e6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  deliveryCopy: {
    flex: 1,
    minWidth: 0,
  },

  deliverySmall: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 3,
  },

  deliveryMain: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },

  deliveryMeta: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },

  changeButton: {
    minWidth: 68,
    height: 42,
    borderRadius: 14,
    borderWidth: 1.3,
    borderColor: '#0b9d50',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  changeButtonText: {
    color: '#0b9d50',
    fontSize: 12,
    fontWeight: '800',
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: H_PADDING,
    marginBottom: 10,
  },

  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  sectionAccent: {
    width: 4,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#0b9d50',
    marginRight: 8,
  },

  storeScroll: {
    paddingHorizontal: H_PADDING,
    paddingBottom: 4,
    gap: 12,
  },

  shopItem: {
    width: 106,
    alignItems: 'center',
  },

  shopImageContainer: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    position: 'relative',
    marginBottom: 7,
  },

  shopImage: {
    width: '100%',
    height: '100%',
    borderRadius: 43,
    resizeMode: 'cover',
  },

  distanceBadge: {
    position: 'absolute',
    right: -4,
    bottom: 1,
    backgroundColor: '#0b9d50',
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  distanceBadgeText: {
    color: '#ffffff',
    fontSize: 7.5,
    fontWeight: '800',
    lineHeight: 9,
  },

  shopName: {
    width: '100%',
    textAlign: 'center',
    color: '#0f172a',
    fontSize: 11.5,
    fontWeight: '700',
    lineHeight: 14,
    marginBottom: 2,
  },

  shopLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },

  shopLocation: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '500',
    marginLeft: 3,
    maxWidth: 78,
  },

  sectionHeadingProducts: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: H_PADDING,
    marginTop: 20,
    marginBottom: 10,
  },
  productRow: {
    justifyContent: 'space-between',
    paddingHorizontal: H_PADDING,
  },

  productCard: {
    width: PRODUCT_WIDTH,
    borderRadius: 17,
    marginBottom: 11,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#0f172a',
    shadowOpacity: 0.035,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },

  productImageBox: {
    height: Math.min(154, width * 0.36),
    backgroundColor: '#f8fafc',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  productImage: {
    width: '84%',
    height: '84%',
    resizeMode: 'contain',
  },

  favoriteButton: {
    position: 'absolute',
    right: 7,
    top: 7,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },

  productDetails: {
    padding: 10,
  },

  productName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    minHeight: 34,
  },

  productUnit: {
    fontSize: 10,
    marginTop: 2,
    minHeight: 14,
  },

  productBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  productPrice: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    flexShrink: 1,
  },

  addCircle: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#0b9d50',
    alignItems: 'center',
    justifyContent: 'center',
  },

  qtySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#e8f7ed',
    height: 36,
    overflow: 'hidden',
  },

  qtyButton: {
    width: 31,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  qtyValue: {
    color: '#0f172a',
    minWidth: 18,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
  },

  outOfStock: {
    color: '#ef4444',
    fontSize: 9,
    fontWeight: '800',
  },

  emptyProducts: {
    paddingHorizontal: H_PADDING,
    paddingTop: 10,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 320,
  },

  loadingText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
});
