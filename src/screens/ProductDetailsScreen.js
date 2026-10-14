import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {SafeAreaView} from 'react-native-safe-area-context';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { getAuth } from '@react-native-firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  where,
} from '@react-native-firebase/firestore';

import {AuthContext} from '../context/AuthContext';
import {ThemeContext} from '../context/ThemeContext';
import {calculateEffectivePricing} from '../utils/pricing';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');


/* =========================================================
   HELPERS
========================================================= */

const normalizeCity = city => {
  if (!city || typeof city !== 'string') return '';
  return city
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
};

const getSellerCity = sellerData => {
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

const isGlobalEligibleSeller = sellerData => {
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

const normalize = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');


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

  const dLat =
    ((Number(lat2) - Number(lat1)) * Math.PI) / 180;

  const dLon =
    ((Number(lon2) - Number(lon1)) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos(
      (Number(lat1) * Math.PI) / 180,
    ) *
      Math.cos(
        (Number(lat2) * Math.PI) / 180,
      ) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return (
    R *
    (2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a),
      ))
  );
};


/* =========================================================
   PRODUCT DATA NORMALIZER
========================================================= */

const normalizeProduct = (
  doc,
  sellerId,
  sellerData = {},
) => {
  const data = doc.data() || {};
  const pricing = calculateEffectivePricing(data);

  const imageList = Array.isArray(data.images)
    ? data.images.filter(Boolean)
    : [];

  const firstImage =
    data.image ||
    data.img ||
    data.productImage ||
    data.imageUrl ||
    '';

  const allImages = [
    ...imageList,
    firstImage,
  ].filter(Boolean);

  const uniqueImages = [
    ...new Set(allImages),
  ];

  return {
    id: doc.id,

    shopId: sellerId,

    shopName:
      data.shopName ||
      data.sellerName ||
      sellerData.shopName ||
      sellerData.businessName ||
      sellerData.name ||
      'Shop',

    shopImage:
      sellerData.shopImage ||
      sellerData.shopLogo ||
      sellerData.logo ||
      data.shopImage ||
      data.shopLogo ||
      '',

    name:
      data.itemName ||
      data.name ||
      data.productName ||
      'Product',

    brand:
      data.brand ||
      data.brandName ||
      '',

    subName:
      data.subName ||
      data.productSubName ||
      data.modelName ||
      data.variantName ||
      data.variant ||
      '',

    model:
      data.model ||
      data.modelNumber ||
      data.modelNo ||
      '',

    description:
      data.description ||
      data.productDescription ||
      data.details ||
      '',

    category:
      data.category ||
      data.categoryName ||
      '',

    subcategory:
      data.subcategory ||
      data.subCategory ||
      '',

    itemNo:
      data.itemNo ||
      data.sku ||
      data.productCode ||
      '',

    unit:
      data.unit ||
      data.measurement ||
      '',

    price: pricing.price,

    salesPrice: pricing.price,

    originalPrice: pricing.originalPrice,

    originalSalesPrice: pricing.originalPrice,

    hasDiscount: pricing.hasDiscount,

    discountPercent: pricing.discountPercent,

    discountBadge: pricing.discountBadge,

    discountType: pricing.discountType,

    discountValue: pricing.discountAmount,

    quantity: Number(
      data.quantity || 0,
    ),

    rating: Number(
      data.rating ||
        data.averageRating ||
        data.productRating ||
        0,
    ),

    reviewCount: Number(
      data.reviewCount ||
        data.reviewsCount ||
        0,
    ),

    images:
      uniqueImages.length > 0
        ? uniqueImages
        : ['https://picsum.photos/700'],

    sellerRating: Number(
      sellerData.rating ||
        sellerData.shopRating ||
        sellerData.averageRating ||
        0,
    ),

    sellerReviewCount: Number(
      sellerData.reviewCount ||
        sellerData.reviewsCount ||
        0,
    ),

    sellerAddress:
      sellerData.address || {},

    rawData: data,
  };
};


/* =========================================================
   PRODUCT MATCHING
========================================================= */

const isSameProduct = (
  sourceProduct,
  candidateProduct,
) => {
  const sourceItemNo = normalize(
    sourceProduct?.itemNo,
  );

  const candidateItemNo = normalize(
    candidateProduct?.itemNo,
  );

  /*
   Exact item number match is preferred.
  */
  if (
    sourceItemNo &&
    candidateItemNo
  ) {
    return (
      sourceItemNo ===
      candidateItemNo
    );
  }

  /*
   Fallback to brand + name.
  */
  const sourceBrand = normalize(
    sourceProduct?.brand,
  );

  const candidateBrand = normalize(
    candidateProduct?.brand,
  );

  const sourceName = normalize(
    sourceProduct?.name,
  );

  const candidateName = normalize(
    candidateProduct?.name,
  );

  if (
    sourceBrand &&
    candidateBrand &&
    sourceBrand === candidateBrand
  ) {
    return (
      sourceName === candidateName
    );
  }

  return (
    sourceName &&
    candidateName &&
    sourceName === candidateName
  );
};


/* =========================================================
   COMPONENT
========================================================= */

export default function ProductDetailsScreen({
  navigation,
  route,
}) {
  const db = getFirestore();
  const authInstance = getAuth();
  const {customerData, user} =
    useContext(AuthContext);

  const {
    bgMain,
    bgCard,
    textMain,
    textSub,
    border,
    isDarkMode,
  } = useContext(ThemeContext);

  const routeProduct =
    route?.params?.product || {};

  const marketMode =
    route?.params?.marketMode || 'local';


  const initialProduct = useMemo(() => {
    if (!routeProduct?.id) return routeProduct;
    const pricing = calculateEffectivePricing(routeProduct);
    return {
      ...routeProduct,
      price: pricing.price,
      salesPrice: pricing.price,
      originalPrice: pricing.originalPrice,
      originalSalesPrice: pricing.originalPrice,
      hasDiscount: pricing.hasDiscount,
      discountPercent: pricing.discountPercent,
      discountBadge: pricing.discountBadge,
    };
  }, [routeProduct]);

  /* =======================================================
     STATE
  ======================================================= */

  const [product, setProduct] =
    useState(initialProduct);

  useEffect(() => {
    if (routeProduct?.id) {
      const pricing = calculateEffectivePricing(routeProduct);
      setProduct(prev => ({
        ...prev,
        ...routeProduct,
        price: pricing.price,
        salesPrice: pricing.price,
        originalPrice: pricing.originalPrice,
        originalSalesPrice: pricing.originalPrice,
        hasDiscount: pricing.hasDiscount,
        discountPercent: pricing.discountPercent,
        discountBadge: pricing.discountBadge,
      }));
    }
  }, [routeProduct]);

  const [offers, setOffers] =
    useState([]);

  const [loadingOffers, setLoadingOffers] =
    useState(true);

  const [selectedImage, setSelectedImage] =
    useState(0);

  const [quantity, setQuantity] =
    useState(1);

  const [cart, setCart] =
    useState({});

  const [adding, setAdding] =
    useState(false);

  const [isFavourite, setIsFavourite] =
    useState(false);

  // Match the circular product-to-cart animation used on ShopProductsScreen.
  const [flyingImage, setFlyingImage] = useState(null);
  const flyOpacity = useRef(new Animated.Value(0)).current;
  const flyScale = useRef(new Animated.Value(1)).current;
  const flyTranslateX = useRef(new Animated.Value(0)).current;
  const flyTranslateY = useRef(new Animated.Value(0)).current;

const cartIconScale = useRef(new Animated.Value(1)).current;

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
  /* =======================================================
     COLORS
  ======================================================= */

  const pageBackground =
    bgMain || '#f7faf8';

  const cardBackground =
    bgCard || '#ffffff';

  const primaryText =
    textMain || '#0f172a';

  const secondaryText =
    textSub || '#64748b';

  const borderColor =
    border || '#e5e7eb';


  /* =======================================================
     PRODUCT IMAGES
  ======================================================= */

  const productImages = useMemo(() => {
    if (
      Array.isArray(product?.images) &&
      product.images.length
    ) {
      return product.images;
    }

    if (product?.img) {
      return [product.img];
    }

    return [
      'https://picsum.photos/700',
    ];
  }, [product]);


  /* =======================================================
     CURRENT CART LISTENER
  ======================================================= */

  useEffect(() => {
    if (!user?.uid) {
      setCart({});
      return undefined;
    }

    const cartRef = doc(db, 'customers', user.uid, 'cart', 'mainCart');

    const unsubscribe =
      onSnapshot(
        cartRef,
        snapshot => {
          if (!snapshot.exists()) {
            setCart({});
            return;
          }

          setCart(
            snapshot.data()?.items || {},
          );
        },
        error => {
          console.log(
            'PRODUCT DETAILS CART ERROR:',
            error,
          );
        },
      );

    return () => unsubscribe();
  }, [db, user?.uid]);


  /* =======================================================
     LOAD CURRENT PRODUCT FROM FIREBASE
     If product exists, refresh its latest data.
  ======================================================= */

  useEffect(() => {
    if (
      !routeProduct?.shopId ||
      !routeProduct?.id
    ) {
      return undefined;
    }

    const collectionName =
      marketMode === 'global'
        ? 'global_inventory'
        : 'inventory';

    const productRef = doc(
      db,
      'users',
      routeProduct.shopId,
      collectionName,
      routeProduct.id,
    );

    const unsubscribe =
      onSnapshot(
        productRef,
        async snapshot => {
          if (!snapshot.exists()) {
            return;
          }

          try {
            const sellerSnapshot = await getDoc(
              doc(db, 'users', routeProduct.shopId),
            );

            const sellerData =
              sellerSnapshot.exists()
                ? sellerSnapshot.data() || {}
                : {};

            const freshProduct =
              normalizeProduct(
                snapshot,
                routeProduct.shopId,
                sellerData,
              );

            setProduct(freshProduct);
          } catch (error) {
            console.log(
              'CURRENT PRODUCT REFRESH ERROR:',
              error,
            );
          }
        },
        error => {
          console.log(
            'CURRENT PRODUCT LISTENER ERROR:',
            error,
          );
        },
      );

    return () => unsubscribe();
  }, [
    db,
    routeProduct?.shopId,
    routeProduct?.id,
    marketMode,
  ]);


  /* =======================================================
     LOAD SAME PRODUCT FROM OTHER SHOPS
  ======================================================= */

  const loadSameProductOffers =
    useCallback(async () => {
      if (!routeProduct?.id) {
        setLoadingOffers(false);
        return;
      }

      try {
        setLoadingOffers(true);

        /*
         * First get all sellers.
         */
        const sellerSnapshot = await getDocs(
          query(collection(db, 'users'), where('role', '==', 'seller')),
        );

        const sellers = [];

        sellerSnapshot.forEach(
          sellerDoc => {
            const sellerData =
              sellerDoc.data() || {};

            const sellerAddress =
              sellerData.address || {};

            /*
             * Active check: exclude inactive or suspended sellers unless current shop
             */
            const isSellerActive =
              sellerData.active !== false &&
              sellerData.isActive !== false &&
              sellerData.deleted !== true &&
              sellerData.isDeleted !== true &&
              sellerData.status !== 'suspended' &&
              sellerData.status !== 'inactive';

            if (!isSellerActive && sellerDoc.id !== routeProduct.shopId) {
              return;
            }

            /*
             * Current shop is always included
             */
            if (
              sellerDoc.id ===
              routeProduct.shopId
            ) {
              sellers.push({
                id: sellerDoc.id,
                data: sellerData,
                address: sellerAddress,
                distance: 0,
              });

              return;
            }

            /*
             * GLOBAL MODE
             */
            if (
              marketMode === 'global'
            ) {
              if (isGlobalEligibleSeller(sellerData)) {
                sellers.push({
                  id: sellerDoc.id,
                  data: sellerData,
                  address: sellerAddress,
                  distance: 999,
                });
              }

              return;
            }

            /*
             * LOCAL MODE: Location-first discovery matching
             */
            const customerAddress =
              customerData?.address || {};

            const customerCity =
              customerAddress?.city ||
              customerAddress?.district ||
              customerAddress?.area ||
              '';
            const normCustomerCity = normalizeCity(customerCity);

            const sellerCity = getSellerCity(sellerData);
            const normSellerCity = normalizeCity(sellerCity);

            let isMatched = false;
            let distance = 0;

            if (normCustomerCity && normSellerCity) {
              isMatched =
                normSellerCity === normCustomerCity ||
                normSellerCity.includes(normCustomerCity) ||
                normCustomerCity.includes(normSellerCity);
            }

            const customerLat = customerAddress?.lat;
            const customerLon = customerAddress?.lon;
            const sellerLat = sellerAddress?.lat;
            const sellerLon = sellerAddress?.lon;

            if (
              Number.isFinite(Number(customerLat)) &&
              Number.isFinite(Number(customerLon)) &&
              Number.isFinite(Number(sellerLat)) &&
              Number.isFinite(Number(sellerLon))
            ) {
              distance = calculateDistance(
                customerLat,
                customerLon,
                sellerLat,
                sellerLon,
              );
              if (distance <= 25) {
                isMatched = true;
              }
            }

            // Fallback area/district/state matching if not already matched
            if (!isMatched) {
              const customerArea = normalize(customerAddress?.area);
              const sellerArea = normalize(sellerAddress?.area);
              const customerDistrict = normalize(customerAddress?.district);
              const sellerDistrict = normalize(sellerAddress?.district);
              const customerState = normalize(customerAddress?.state);
              const sellerState = normalize(sellerAddress?.state);

              if (customerArea && sellerArea && customerArea === sellerArea) {
                isMatched = true;
              } else if (customerDistrict && sellerDistrict && customerDistrict === sellerDistrict) {
                isMatched = true;
              } else if (customerState && sellerState && customerState === sellerState) {
                isMatched = true;
              } else if (!normCustomerCity && !customerLat) {
                isMatched = true;
              }
            }

            if (isMatched) {
              sellers.push({
                id: sellerDoc.id,
                data: sellerData,
                address: sellerAddress,
                distance,
              });
            }
          },
        );


        /* =================================================
           FETCH INVENTORY FROM SELLERS
        ================================================= */

        const collectionName =
          marketMode === 'global'
            ? 'global_inventory'
            : 'inventory';

        const sellerProducts =
          await Promise.all(
            sellers.map(
              async seller => {
                try {
                  const inventorySnapshot = await getDocs(
                    collection(db, 'users', seller.id, collectionName),
                  );

                  const matchedProducts =
                    [];

                  inventorySnapshot.forEach(
                    inventoryDoc => {
                      const candidate =
                        normalizeProduct(
                          inventoryDoc,
                          seller.id,
                          seller.data,
                        );

                      if (
                        candidate.quantity <=
                        0
                      ) {
                        return;
                      }

                      if (
                        isSameProduct(
                          product,
                          candidate,
                        )
                      ) {
                        matchedProducts.push({
                          ...candidate,

                          distance:
                            seller.distance,

                          isCurrentShop:
                            seller.id ===
                            product.shopId,
                        });
                      }
                    },
                  );

                  return matchedProducts;
                } catch (error) {
                  console.log(
                    'SHOP INVENTORY ERROR:',
                    seller.id,
                    error,
                  );

                  return [];
                }
              },
            ),
          );


        const flattenedOffers =
          sellerProducts.flat();

        /*
         * Remove duplicates
         */
        const uniqueOffers =
          flattenedOffers.filter(
            (item, index, array) =>
              array.findIndex(
                other =>
                  other.shopId ===
                    item.shopId &&
                  other.id === item.id,
              ) === index,
          );


        /*
         * Current shop first,
         * then nearest shops,
         * then price.
         */
        uniqueOffers.sort(
          (a, b) => {
            if (
              a.isCurrentShop &&
              !b.isCurrentShop
            ) {
              return -1;
            }

            if (
              !a.isCurrentShop &&
              b.isCurrentShop
            ) {
              return 1;
            }

            if (
              marketMode === 'local'
            ) {
              if (
                a.distance !==
                b.distance
              ) {
                return (
                  a.distance -
                  b.distance
                );
              }
            }

            return (
              Number(a.price || 0) -
              Number(b.price || 0)
            );
          },
        );


        setOffers(uniqueOffers);
      } catch (error) {
        console.log(
          'SAME PRODUCT OFFERS ERROR:',
          error,
        );

        /*
         * Don't destroy existing data
         * if Firebase temporarily fails.
         */
      } finally {
        setLoadingOffers(false);
      }
    }, [
      db,
      routeProduct?.id,
      routeProduct?.shopId,
      product,
      marketMode,
      customerData,
    ]);


  useEffect(() => {
    loadSameProductOffers();
  }, [loadSameProductOffers]);


  /* =======================================================
     CART KEY
  ======================================================= */

  const getCartKey = item => {
    /*
     * Important:
     * Same product can exist in multiple shops.
     *
     * Current shop keeps normal ID compatibility.
     * Other shop offers use shopId + productId.
     */
    if (
      item?.shopId ===
      product?.shopId
    ) {
      return item.id;
    }

    return `${item.shopId}_${item.id}`;
  };


  /* =======================================================
     CURRENT CART ITEM
  ======================================================= */

  const currentCartKey =
    getCartKey(product);

  const currentCartItem =
    cart?.[currentCartKey];


  /* =======================================================
     TOTAL
  ======================================================= */

  const currentCartQuantity =
    Number(
      currentCartItem?.qty || 0,
    );


  /* =======================================================
     ADD OFFER TO CART
  ======================================================= */

  const addOfferToCart = async (
    offer,
  ) => {
    const firebaseUser = authInstance.currentUser;

    if (!firebaseUser) {
      navigation.navigate('Login');
      return;
    }

    const cartKey =
      getCartKey(offer);

    const existingQty =
      Number(
        cart?.[cartKey]?.qty || 0,
      );

    if (
      existingQty >=
      Number(offer.quantity || 0)
    ) {
      Alert.alert(
        'Stock Limit',
        'You have reached the available stock for this product.',
      );
      return;
    }

    const updatedCart = {
      ...cart,

      [cartKey]: {
        ...offer,
        marketType: marketMode,
        qty: existingQty + 1,
        cartKey,
      },
    };

    setCart(updatedCart);

    try {
      await setDoc(
        doc(db, 'customers', firebaseUser.uid, 'cart', 'mainCart'),
        {
          items: updatedCart,
          updatedAt:
            new Date().toISOString(),
        },
      );

      // Use the same round flying animation for alternate-shop offers.
      playAddAnimation(
        offer?.images?.[0] ||
        offer?.img ||
        offer?.image ||
        productImages[0],
      );
      playCartPopAnimation();
    } catch (error) {
      console.log(
        'PRODUCT ADD CART ERROR:',
        error,
      );

      Alert.alert(
        'Cart Error',
        'Unable to update cart. Please try again.',
      );
    }
  };


  /* =======================================================
     CURRENT PRODUCT QUANTITY
  ======================================================= */

  const increaseQuantity =
    async () => {
      if (
        quantity >=
        Number(product.quantity || 0)
      ) {
        return;
      }

      setQuantity(
        previous => previous + 1,
      );
    };


  const decreaseQuantity =
    () => {
      setQuantity(
        previous =>
          Math.max(1, previous - 1),
      );
    };


  /* =======================================================
     ROUND PRODUCT-TO-CART ANIMATION
  ======================================================= */

  const playAddAnimation = image => {
    setFlyingImage(image || productImages[0]);

    flyOpacity.setValue(1);
    flyScale.setValue(1);
    flyTranslateX.setValue(0);
    flyTranslateY.setValue(0);

    Animated.parallel([
      Animated.timing(flyTranslateX, {
        toValue: Math.max(0, SCREEN_WIDTH / 2 - 48),
        duration: 620,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(flyTranslateY, {
        toValue: -SCREEN_HEIGHT * 0.34,
        duration: 620,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(flyScale, {
        toValue: 0.18,
        duration: 620,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(flyOpacity, {
        toValue: 0,
        duration: 660,
        delay: 80,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setFlyingImage(null);
    });
  };

  /* =======================================================
     ADD CURRENT PRODUCT
  ======================================================= */

  const handleAddToCart =
    async () => {
      const firebaseUser = authInstance.currentUser;

      if (!firebaseUser) {
        navigation.navigate('Login');
        return;
      }

      const stock =
        Number(product.quantity || 0);

      if (stock <= 0) {
        Alert.alert(
          'Out of Stock',
          'This product is currently unavailable.',
        );
        return;
      }

      const existingQty =
        Number(
          cart?.[currentCartKey]
            ?.qty || 0,
        );

      if (
        existingQty + quantity >
        stock
      ) {
        Alert.alert(
          'Stock Limit',
          `Only ${stock} item${
            stock > 1 ? 's' : ''
          } available.`,
        );
        return;
      }

      const updatedCart = {
        ...cart,

        [currentCartKey]: {
          ...product,
          marketType: marketMode,
          qty:
            existingQty +
            quantity,
          cartKey: currentCartKey,
        },
      };

      setCart(updatedCart);
      setAdding(true);

      try {
        await setDoc(
          doc(db, 'customers', firebaseUser.uid, 'cart', 'mainCart'),
          {
            items: updatedCart,
            updatedAt:
              new Date().toISOString(),
          },
        );
playAddAnimation(productImages[selectedImage]);
playCartPopAnimation();
        /*
         * Reset selected quantity
         */
        setQuantity(1);
      } catch (error) {
        console.log(
          'ADD PRODUCT ERROR:',
          error,
        );

        Alert.alert(
          'Cart Error',
          'Unable to add product to cart.',
        );
      } finally {
        setTimeout(() => {
          setAdding(false);
        }, 350);
      }
    };


  /* =======================================================
     BUY NOW
  ======================================================= */

  const handleBuyNow =
    async () => {
      await handleAddToCart();

      setTimeout(() => {
        navigation.navigate(
          'CartScreen',
          {
            cartData: cart,
          },
        );
      }, 400);
    };


  /* =======================================================
     EFFECTIVE PRICING
  ======================================================= */

  const productPricing = useMemo(() => {
    return calculateEffectivePricing(product);
  }, [product]);

  const discountPercent = productPricing.discountPercent;


  /* =======================================================
     RENDER STAR
  ======================================================= */

  const renderStars =
    rating => {
      const rounded =
        Math.round(
          Number(rating || 0),
        );

      return (
        <View
          style={styles.starsRow}
        >
          {[1, 2, 3, 4, 5].map(
            star => (
              <MaterialCommunityIcons
                key={star}
                name={
                  star <= rounded
                    ? 'star'
                    : 'star-outline'
                }
                size={16}
                color="#f59e0b"
              />
            ),
          )}
        </View>
      );
    };


  /* =======================================================
     OFFER CARD
  ======================================================= */

  const renderOffer = offer => {
    const offerCartKey =
      getCartKey(offer);

    const offerCartItem =
      cart?.[offerCartKey];

    const offerQty =
      Number(
        offerCartItem?.qty || 0,
      );

    const isCurrent =
      offer.shopId ===
      product.shopId;

    return (
      <View
        key={`${offer.shopId}-${offer.id}`}
        style={[
          styles.offerCard,
          {
            backgroundColor:
              cardBackground,
            borderColor:
              borderColor,
          },
        ]}
      >
        <View
          style={styles.offerTop}
        >
          <View
            style={styles.offerImageWrap}
          >
            <Image
              source={{
                uri:
                  offer.shopImage ||
                  offer.img ||
                  'https://picsum.photos/300',
              }}
              style={
                styles.offerImage
              }
            />
          </View>

          <View
            style={styles.offerInfo}
          >
            <View
              style={
                styles.offerShopRow
              }
            >
              <Text
                style={[
                  styles.offerShopName,
                  {
                    color:
                      primaryText,
                  },
                ]}
                numberOfLines={1}
              >
                {offer.shopName}
              </Text>

              {isCurrent ? (
                <View
                  style={
                    styles.currentBadge
                  }
                >
                  <Text
                    style={
                      styles.currentBadgeText
                    }
                  >
                    YOUR SHOP
                  </Text>
                </View>
              ) : null}
            </View>

            <View
              style={
                styles.offerRatingRow
              }
            >
              {renderStars(
                offer.sellerRating ||
                  offer.rating,
              )}

              <Text
                style={[
                  styles.offerRatingText,
                  {
                    color:
                      secondaryText,
                  },
                ]}
              >
                {Number(
                  offer.sellerRating ||
                    offer.rating ||
                    0,
                ).toFixed(1)}
              </Text>

              {marketMode ===
                'local' &&
              offer.distance <
                999 ? (
                <Text
                  style={[
                    styles.distanceText,
                    {
                      color:
                        secondaryText,
                    },
                  ]}
                >
                  •{' '}
                  {offer.distance <
                  0.1
                    ? '< 100 m'
                    : `${offer.distance.toFixed(
                        1,
                      )} km`}
                </Text>
              ) : null}
            </View>

            <Text
              style={[
                styles.offerAvailability,
                {
                  color:
                    secondaryText,
                },
              ]}
            >
              {offer.quantity}{' '}
              available
            </Text>
          </View>
        </View>

        <View
          style={styles.offerBottom}
        >
          <View>
            <Text
              style={[
                styles.offerPrice,
                {
                  color:
                    primaryText,
                },
              ]}
            >
              ₹
              {Number(
                offer.price || 0,
              ).toLocaleString(
                'en-IN',
              )}
            </Text>

            {offer.hasDiscount &&
            offer.originalPrice >
            offer.price ? (
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                <Text
                  style={[
                    styles.offerOldPrice,
                    {
                      color:
                        secondaryText,
                    },
                  ]}
                >
                  ₹
                  {Number(
                    offer.originalPrice,
                  ).toLocaleString(
                    'en-IN',
                  )}
                </Text>
                {offer.discountBadge ? (
                  <Text style={{fontSize: 10, fontWeight: '700', color: '#16a34a'}}>
                    {offer.discountBadge}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {offerQty > 0 ? (
            <View
              style={
                styles.offerQtySelector
              }
            >
              <TouchableOpacity
                style={
                  styles.offerQtyButton
                }
                onPress={() =>
                  offerQty > 1
                    ? addOfferToCart({
                        ...offer,
                        quantity:
                          offer.quantity,
                      })
                    : null
                }
              >
                <MaterialCommunityIcons
                  name="minus"
                  size={17}
                  color="#0b9d50"
                />
              </TouchableOpacity>

              <Text
                style={
                  styles.offerQtyText
                }
              >
                {offerQty}
              </Text>

              <TouchableOpacity
                style={
                  styles.offerQtyButton
                }
                onPress={() =>
                  addOfferToCart(
                    offer,
                  )
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
              activeOpacity={0.85}
              style={
                styles.offerAddButton
              }
              onPress={() =>
                addOfferToCart(
                  offer,
                )
              }
            >
              <MaterialCommunityIcons
                name="cart-plus"
                size={17}
                color="#ffffff"
              />

              <Text
                style={
                  styles.offerAddText
                }
              >
                Add
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };


  /* =======================================================
     LOADING SCREEN
  ======================================================= */

  if (!product?.id) {
    return (
      <View
        style={[
          styles.centerScreen,
          {
            backgroundColor:
              pageBackground,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color="#0b9d50"
        />

        <Text
          style={[
            styles.loadingText,
            {
              color:
                secondaryText,
            },
          ]}
        >
          Loading product...
        </Text>
      </View>
    );
  }


  /* =======================================================
     MAIN UI
  ======================================================= */

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
            pageBackground,
        },
      ]}
    >
      <StatusBar
        backgroundColor={
          pageBackground
        }
        barStyle={
          isDarkMode
            ? 'light-content'
            : 'dark-content'
        }
      />

      <SafeAreaView
        edges={['top']}
        style={[
          styles.safeArea,
          {
            backgroundColor:
              pageBackground,
          },
        ]}
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <View
          style={[
            styles.header,
            {
              backgroundColor:
                pageBackground,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.headerButton}
            activeOpacity={0.8}
            onPress={() =>
              navigation.goBack()
            }
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={25}
              color={primaryText}
            />
          </TouchableOpacity>

          <Text
            style={[
              styles.headerTitle,
              {
                color:
                  primaryText,
              },
            ]}
            numberOfLines={1}
          >
            Product
          </Text>

          <View
            style={
              styles.headerRight
            }
          >
            <TouchableOpacity
              style={
                styles.headerButton
              }
              activeOpacity={0.8}
              onPress={() =>
                setIsFavourite(
                  previous =>
                    !previous,
                )
              }
            >
              <MaterialCommunityIcons
                name={
                  isFavourite
                    ? 'heart'
                    : 'heart-outline'
                }
                size={24}
                color={
                  isFavourite
                    ? '#ef4444'
                    : primaryText
                }
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.headerButton
              }
              activeOpacity={0.8}
              onPress={() =>
                navigation.navigate(
                  'CartScreen',
                  {
                    cartData: cart,
                  },
                )
              }
            >
           
<Animated.View
  style={{
    transform: [{scale: cartIconScale}],
  }}
>
  <MaterialCommunityIcons
    name="cart-outline"
    size={24}
    color={primaryText}
  />
</Animated.View>


              {Object.values(
                cart || {},
              ).reduce(
                (sum, item) =>
                  sum +
                  Number(
                    item?.qty || 0,
                  ),
                0,
              ) > 0 ? (
                <View
                  style={
                    styles.headerCartBadge
                  }
                >
                  <Text
                    style={
                      styles.headerCartBadgeText
                    }
                  >
                    {Object.values(
                      cart || {},
                    ).reduce(
                      (sum, item) =>
                        sum +
                        Number(
                          item?.qty ||
                            0,
                        ),
                      0,
                    ) > 99
                      ? '99+'
                      : Object.values(
                          cart || {},
                        ).reduce(
                          (
                            sum,
                            item,
                          ) =>
                            sum +
                            Number(
                              item?.qty ||
                                0,
                            ),
                          0,
                        )}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>


      {/* ===================================================
          CONTENT
      =================================================== */}

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        {/* =================================================
            IMAGE GALLERY
        ================================================= */}

        <View
          style={[
            styles.galleryCard,
            {
              backgroundColor:
                cardBackground,
              borderColor:
                borderColor,
            },
          ]}
        >
          <Image
            source={{
              uri:
                productImages[
                  selectedImage
                ],
            }}
            style={
              styles.mainProductImage
            }
          />

          {productPricing.hasDiscount && productPricing.discountBadge ? (
            <View
              style={
                styles.discountBadge
              }
            >
              <Text
                style={
                  styles.discountBadgeText
                }
              >
                {productPricing.discountBadge}
              </Text>
            </View>
          ) : null}

          {product.rating >= 4.5 ? (
            <View
              style={
                styles.bestSellerBadge
              }
            >
              <MaterialCommunityIcons
                name="crown"
                size={14}
                color="#f59e0b"
              />

              <Text
                style={
                  styles.bestSellerText
                }
              >
                TOP RATED
              </Text>
            </View>
          ) : null}
        </View>


        {/* =================================================
            THUMBNAILS
        ================================================= */}

        {productImages.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.thumbnailScroll
            }
          >
            {productImages.map(
              (image, index) => (
                <TouchableOpacity
                  key={`${image}-${index}`}
                  activeOpacity={0.85}
                  onPress={() =>
                    setSelectedImage(
                      index,
                    )
                  }
                  style={[
                    styles.thumbnail,
                    selectedImage ===
                      index &&
                      styles.thumbnailActive,
                  ]}
                >
                  <Image
                    source={{
                      uri: image,
                    }}
                    style={
                      styles.thumbnailImage
                    }
                  />
                </TouchableOpacity>
              ),
            )}
          </ScrollView>
        ) : null}


        {/* =================================================
            BASIC PRODUCT INFO
        ================================================= */}

        <View
          style={styles.infoSection}
        >
          {product.brand ? (
            <Text
              style={[
                styles.brandText,
                {
                  color:
                    '#0b9d50',
                },
              ]}
            >
              {product.brand}
            </Text>
          ) : null}

          <Text
            style={[
              styles.productName,
              {
                color:
                  primaryText,
              },
            ]}
          >
            {product.name}
          </Text>

          {product.subName ? (
            <Text
              style={[
                styles.subName,
                {
                  color:
                    secondaryText,
                },
              ]}
            >
              {product.subName}
            </Text>
          ) : null}

          {product.model ? (
            <Text
              style={[
                styles.modelText,
                {
                  color:
                    secondaryText,
                },
              ]}
            >
              Model: {product.model}
            </Text>
          ) : null}


          {/* Rating */}

          <View
            style={
              styles.ratingMainRow
            }
          >
            {renderStars(
              product.rating,
            )}

            <Text
              style={[
                styles.ratingNumber,
                {
                  color:
                    primaryText,
                },
              ]}
            >
              {Number(
                product.rating || 0,
              ).toFixed(1)}
            </Text>

            {product.reviewCount >
            0 ? (
              <Text
                style={[
                  styles.reviewCount,
                  {
                    color:
                      secondaryText,
                  },
                ]}
              >
                (
                {product.reviewCount.toLocaleString(
                  'en-IN',
                )}{' '}
                reviews)
              </Text>
            ) : null}
          </View>
        </View>


        {/* =================================================
            PRICE
        ================================================= */}

        <View
          style={[
            styles.priceCard,
            {
              backgroundColor:
                cardBackground,
              borderColor:
                borderColor,
            },
          ]}
        >
          <View>
            <View
              style={
                styles.priceRow
              }
            >
              <Text
                style={
                  styles.currentPrice
                }
              >
                ₹
                {Number(
                  productPricing.price || 0,
                ).toLocaleString(
                  'en-IN',
                )}
              </Text>

              {productPricing.hasDiscount &&
              productPricing.originalPrice >
              productPricing.price ? (
                <Text
                  style={[
                    styles.oldPrice,
                    {
                      color:
                        secondaryText,
                    },
                  ]}
                >
                  ₹
                  {Number(
                    productPricing.originalPrice,
                  ).toLocaleString(
                    'en-IN',
                  )}
                </Text>
              ) : null}
            </View>

            {productPricing.hasDiscount &&
            productPricing.discountBadge ? (
              <Text
                style={
                  styles.saveText
                }
              >
                Save {productPricing.discountBadge}
              </Text>
            ) : null}
          </View>

          <View
            style={
              styles.stockBadge
            }
          >
            <MaterialCommunityIcons
              name="check-circle"
              size={16}
              color="#0b9d50"
            />

            <Text
              style={
                styles.stockText
              }
            >
              {product.quantity >
              0
                ? 'In Stock'
                : 'Out of Stock'}
            </Text>
          </View>
        </View>


        {/* =================================================
            PRODUCT DETAILS
        ================================================= */}

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor:
                cardBackground,
              borderColor:
                borderColor,
            },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color:
                  primaryText,
              },
            ]}
          >
            Product Details
          </Text>

          {product.brand ? (
            <View
              style={
                styles.specRow
              }
            >
              <Text
                style={[
                  styles.specLabel,
                  {
                    color:
                      secondaryText,
                  },
                ]}
              >
                Brand
              </Text>

              <Text
                style={[
                  styles.specValue,
                  {
                    color:
                      primaryText,
                  },
                ]}
              >
                {product.brand}
              </Text>
            </View>
          ) : null}

          {product.model ? (
            <View
              style={
                styles.specRow
              }
            >
              <Text
                style={[
                  styles.specLabel,
                  {
                    color:
                      secondaryText,
                  },
                ]}
              >
                Model
              </Text>

              <Text
                style={[
                  styles.specValue,
                  {
                    color:
                      primaryText,
                  },
                ]}
              >
                {product.model}
              </Text>
            </View>
          ) : null}

          {product.subName ? (
            <View
              style={
                styles.specRow
              }
            >
              <Text
                style={[
                  styles.specLabel,
                  {
                    color:
                      secondaryText,
                  },
                ]}
              >
                Sub Name
              </Text>

              <Text
                style={[
                  styles.specValue,
                  {
                    color:
                      primaryText,
                  },
                ]}
              >
                {product.subName}
              </Text>
            </View>
          ) : null}

          {product.category ? (
            <View
              style={
                styles.specRow
              }
            >
              <Text
                style={[
                  styles.specLabel,
                  {
                    color:
                      secondaryText,
                  },
                ]}
              >
                Category
              </Text>

              <Text
                style={[
                  styles.specValue,
                  {
                    color:
                      primaryText,
                  },
                ]}
              >
                {product.category}
              </Text>
            </View>
          ) : null}

          {product.itemNo ? (
            <View
              style={
                styles.specRow
              }
            >
              <Text
                style={[
                  styles.specLabel,
                  {
                    color:
                      secondaryText,
                  },
                ]}
              >
                Product Code
              </Text>

              <Text
                style={[
                  styles.specValue,
                  {
                    color:
                      primaryText,
                  },
                ]}
              >
                {product.itemNo}
              </Text>
            </View>
          ) : null}

          {product.unit ? (
            <View
              style={
                styles.specRow
              }
            >
              <Text
                style={[
                  styles.specLabel,
                  {
                    color:
                      secondaryText,
                  },
                ]}
              >
                Unit
              </Text>

              <Text
                style={[
                  styles.specValue,
                  {
                    color:
                      primaryText,
                  },
                ]}
              >
                {product.unit}
              </Text>
            </View>
          ) : null}
        </View>


        {/* =================================================
            DESCRIPTION
        ================================================= */}

        {product.description ? (
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor:
                  cardBackground,
                borderColor:
                  borderColor,
              },
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                {
                  color:
                    primaryText,
                },
              ]}
            >
              Description
            </Text>

            <Text
              style={[
                styles.description,
                {
                  color:
                    secondaryText,
                },
              ]}
            >
              {product.description}
            </Text>
          </View>
        ) : null}


        {/* =================================================
            SHOP INFORMATION
        ================================================= */}

        <View
          style={[
            styles.shopCard,
            {
              backgroundColor:
                '#edf9f2',
            },
          ]}
        >
          <View
            style={
              styles.shopIcon
            }
          >
            <MaterialCommunityIcons
              name="store-outline"
              size={25}
              color="#0b9d50"
            />
          </View>

          <View
            style={styles.shopInfo}
          >
            <Text
              style={
                styles.shopSmall
              }
            >
              SOLD BY
            </Text>

            <Text
              style={
                styles.shopName
              }
              numberOfLines={1}
            >
              {product.shopName}
            </Text>

            <Text
              style={
                styles.shopLocation
              }
              numberOfLines={1}
            >
              {product.sellerAddress
                ?.city ||
                product.sellerAddress
                  ?.district ||
                'Available seller'}
            </Text>
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color="#64748b"
          />
        </View>


        {/* =================================================
            SAME PRODUCT OFFERS
        ================================================= */}

        <View
          style={styles.offersSection}
        >
          <View
            style={
              styles.offersHeader
            }
          >
            <View
              style={{flex: 1}}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color:
                      primaryText,
                  },
                ]}
              >
                {marketMode ===
                'local'
                  ? 'Same Product Nearby'
                  : 'Same Product Globally'}
              </Text>

              <Text
                style={[
                  styles.sectionSubtitle,
                  {
                    color:
                      secondaryText,
                  },
                ]}
              >
                Compare shops and
                prices
              </Text>
            </View>

            <View
              style={
                styles.modeBadge
              }
            >
              <MaterialCommunityIcons
                name={
                  marketMode ===
                  'local'
                    ? 'map-marker-radius'
                    : 'earth'
                }
                size={15}
                color="#0b9d50"
              />

              <Text
                style={
                  styles.modeBadgeText
                }
              >
                {marketMode ===
                'local'
                  ? 'Nearby'
                  : 'Global'}
              </Text>
            </View>
          </View>


          {loadingOffers ? (
            <View
              style={
                styles.offerLoading
              }
            >
              <ActivityIndicator
                size="small"
                color="#0b9d50"
              />

              <Text
                style={[
                  styles.offerLoadingText,
                  {
                    color:
                      secondaryText,
                  },
                ]}
              >
                Finding other shops...
              </Text>
            </View>
          ) : offers.length ===
            0 ? (
            <View
              style={
                styles.noOffers
              }
            >
              <MaterialCommunityIcons
                name="store-search-outline"
                size={32}
                color="#94a3b8"
              />

              <Text
                style={[
                  styles.noOffersTitle,
                  {
                    color:
                      primaryText,
                  },
                ]}
              >
                No other shops found
              </Text>

              <Text
                style={[
                  styles.noOffersText,
                  {
                    color:
                      secondaryText,
                  },
                ]}
              >
                This product is
                currently available
                only from this shop.
              </Text>
            </View>
          ) : (
            <>
              {offers.map(
                renderOffer,
              )}
            </>
          )}
        </View>


        {/* =================================================
            BOTTOM SPACE
        ================================================= */}

        <View
          style={{height: 150}}
        />
      </ScrollView>


      {/* ===================================================
          BOTTOM PURCHASE BAR
      =================================================== */}

      <SafeAreaView
        edges={['bottom']}
        style={[
          styles.bottomSafeArea,
          {
            backgroundColor:
              cardBackground,
            borderTopColor:
              borderColor,
          },
        ]}
      >
        <View
          style={styles.bottomBar}
        >
          <View
            style={
              styles.bottomQuantity
            }
          >
            <TouchableOpacity
              activeOpacity={0.8}
              style={
                styles.bottomQtyButton
              }
              onPress={
                decreaseQuantity
              }
            >
              <MaterialCommunityIcons
                name="minus"
                size={19}
                color="#0b9d50"
              />
            </TouchableOpacity>

            <Text
              style={[
                styles.bottomQtyText,
                {
                  color:
                    primaryText,
                },
              ]}
            >
              {quantity}
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              style={
                styles.bottomQtyButton
              }
              onPress={
                increaseQuantity
              }
            >
              <MaterialCommunityIcons
                name="plus"
                size={19}
                color="#0b9d50"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.addMainButton,
              product.quantity <= 0 &&
                styles.disabledButton,
            ]}
            disabled={
              product.quantity <= 0 ||
              adding
            }
            onPress={
              handleAddToCart
            }
          >
            {adding ? (
              <ActivityIndicator
                size="small"
                color="#ffffff"
              />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="cart-plus"
                  size={21}
                  color="#ffffff"
                />

                <Text
                  style={
                    styles.addMainButtonText
                  }
                >
                  Add to Cart
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {flyingImage ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flyingProduct,
            {
              opacity: flyOpacity,
              transform: [
                {translateX: flyTranslateX},
                {translateY: flyTranslateY},
                {scale: flyScale},
              ],
            },
          ]}
        >
          <Image
            source={{uri: flyingImage}}
            style={styles.flyingImage}
            resizeMode="contain"
          />
          <View style={styles.flyingCheckBadge}>
            <MaterialCommunityIcons
              name="check"
              size={12}
              color="#ffffff"
            />
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}


/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  safeArea: {
    width: '100%',
  },

  header: {
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '900',
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerCartBadge: {
    position: 'absolute',
    right: 0,
    top: 1,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerCartBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
  },

  content: {
    paddingTop: 8,
    paddingHorizontal: 14,
  },

  galleryCard: {
    width: '100%',
    height: 330,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },

  mainProductImage: {
    width: '88%',
    height: '88%',
    resizeMode: 'contain',
  },

  discountBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
  },

  discountBadgeText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '900',
  },

  bestSellerBadge: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7df',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  bestSellerText: {
    marginLeft: 4,
    color: '#b77900',
    fontSize: 9,
    fontWeight: '900',
  },

  thumbnailScroll: {
    paddingTop: 11,
    paddingBottom: 5,
    gap: 9,
  },

  thumbnail: {
    width: 62,
    height: 62,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  thumbnailActive: {
    borderWidth: 2,
    borderColor: '#0b9d50',
  },

  thumbnailImage: {
    width: '86%',
    height: '86%',
    resizeMode: 'contain',
  },

  infoSection: {
    paddingTop: 18,
    paddingBottom: 10,
  },

  brandText: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 5,
  },

  productName: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
  },

  subName: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
    fontWeight: '600',
  },

  modelText: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },

  ratingMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 11,
  },

  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  ratingNumber: {
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 6,
  },

  reviewCount: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },

  priceCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  currentPrice: {
    color: '#0b9d50',
    fontSize: 25,
    fontWeight: '900',
  },

  oldPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    marginLeft: 8,
    fontWeight: '600',
  },

  saveText: {
    color: '#0b9d50',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },

  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f7ed',
    borderRadius: 13,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  stockText: {
    color: '#0b9d50',
    fontSize: 10,
    fontWeight: '900',
    marginLeft: 4,
  },

  sectionCard: {
    borderRadius: 19,
    borderWidth: 1,
    padding: 15,
    marginTop: 12,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 13,
  },

  specRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  specLabel: {
    width: '35%',
    fontSize: 12,
    fontWeight: '600',
  },

  specValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },

  description: {
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '500',
  },

  shopCard: {
    marginTop: 12,
    borderRadius: 19,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },

  shopIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#d9f5e4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  shopInfo: {
    flex: 1,
    marginLeft: 11,
  },

  shopSmall: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  shopName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },

  shopLocation: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },

  offersSection: {
    marginTop: 25,
  },

  offersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 11,
  },

  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: -7,
  },

  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f7ed',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  modeBadgeText: {
    color: '#0b9d50',
    fontSize: 9,
    fontWeight: '900',
    marginLeft: 4,
  },

  offerLoading: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },

  offerLoadingText: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
  },

  noOffers: {
    minHeight: 150,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  noOffersTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '900',
  },

  noOffersText: {
    textAlign: 'center',
    marginTop: 4,
    fontSize: 11,
    lineHeight: 17,
  },

  offerCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },

  offerTop: {
    flexDirection: 'row',
  },

  offerImageWrap: {
    width: 66,
    height: 66,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  offerImage: {
    width: '88%',
    height: '88%',
    resizeMode: 'cover',
  },

  offerInfo: {
    flex: 1,
    marginLeft: 10,
  },

  offerShopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  offerShopName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },

  currentBadge: {
    backgroundColor: '#dcf6e6',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginLeft: 5,
  },

  currentBadgeText: {
    color: '#0b9d50',
    fontSize: 7,
    fontWeight: '900',
  },

  offerRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  offerRatingText: {
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 4,
  },

  distanceText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 5,
  },

  offerAvailability: {
    fontSize: 9,
    marginTop: 4,
    fontWeight: '600',
  },

  offerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },

  offerPrice: {
    fontSize: 17,
    fontWeight: '900',
  },

  offerOldPrice: {
    fontSize: 9,
    textDecorationLine: 'line-through',
    marginTop: 1,
  },

  offerAddButton: {
    minWidth: 83,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#0b9d50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  offerAddText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 5,
  },

  offerQtySelector: {
    height: 38,
    borderRadius: 12,
    backgroundColor: '#e8f7ed',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },

  offerQtyButton: {
    width: 32,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  offerQtyText: {
    color: '#0f172a',
    minWidth: 20,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
  },

  bottomSafeArea: {
    borderTopWidth: 1,
  },

  bottomBar: {
    minHeight: 68,
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  bottomQuantity: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#e8f7ed',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },

  bottomQtyButton: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomQtyText: {
    minWidth: 25,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '900',
  },

  addMainButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0b9d50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addMainButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 7,
  },

  disabledButton: {
    backgroundColor: '#94a3b8',
  },

  centerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
  },

  flyingProduct: {
    position: 'absolute',
    width: 72,
    height: 72,
    left: SCREEN_WIDTH / 2 - 36,
    top: '42%',
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#b8e7ca',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 14,
    shadowColor: '#0b9d50',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 5},
    zIndex: 999,
  },

  flyingImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },

  flyingCheckBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: '#0b9d50',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
 
