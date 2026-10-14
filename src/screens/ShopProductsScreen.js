import React, { useEffect, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Easing,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from '@react-native-firebase/auth';
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
} from '@react-native-firebase/firestore';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { calculateEffectivePricing } from '../utils/pricing';

const { width } = Dimensions.get('window');

const H_PADDING = 14;
const GAP = 10;
const CARD_WIDTH = (width - H_PADDING * 2 - GAP) / 2;

const ShopProductsScreen = ({ navigation, route }) => {
  const {
    shopId,
    shopName = 'Shop',
    shopImage = '',
    marketMode = 'local',
  } = route.params || {};

  const db = getFirestore();
  const authInstance = getAuth();

  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState(null);

  // Flying product animation
  const flyOpacity = useRef(new Animated.Value(0)).current;
  const flyScale = useRef(new Animated.Value(1)).current;
  const flyTranslateY = useRef(new Animated.Value(0)).current;
  const flyTranslateX = useRef(new Animated.Value(0)).current;

  const [flyingImage, setFlyingImage] = useState(null);

  /* -------------------------------------------------------
     INVENTORY
  ------------------------------------------------------- */

  useEffect(() => {
    if (!shopId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const targetCollection =
      marketMode === 'global'
        ? 'global_inventory'
        : 'inventory';

    const inventoryRef = collection(db, 'users', shopId, targetCollection);

    const unsubscribe = onSnapshot(
      inventoryRef,
      snapshot => {
        const items = snapshot.docs.map(doc => {
          const data = doc.data() || {};
          const pricing = calculateEffectivePricing(data);

          return {
            id: doc.id,

            shopId,
            shopName,
            marketType: marketMode,
            marketMode,
            inventoryCollection: targetCollection,

            name:
              data.itemName ||
              data.name ||
              'Product',

            brand: data.brand || data.brandName || '',
            subName: data.subName || data.productSubName || data.modelName || data.variant || '',
            model: data.model || data.modelNumber || data.modelNo || '',
            description: data.description || data.productDescription || data.details || '',

            price: pricing.price,
            salesPrice: pricing.price,
            originalPrice: pricing.originalPrice,
            originalSalesPrice: pricing.originalPrice,
            mrp: pricing.originalPrice > 0 ? pricing.originalPrice : (Number(data.mrp) || pricing.price),
            hasDiscount: pricing.hasDiscount,
            discountPercent: pricing.discountPercent,
            discountBadge: pricing.discountBadge,
            discountType: pricing.discountType,
            discountValue: data.discountValue ?? 0,

            quantity: Number(
              data.quantity || 0
            ),

            category:
              data.category ||
              data.categoryName ||
              'General',

            subcategory:
              data.subcategory ||
              data.subCategory ||
              '',

            img:
              data.image ||
              data.img ||
              data.imageUrl ||
              'https://picsum.photos/500',

            images: Array.isArray(data.images) && data.images.length ? data.images : undefined,

            itemNo:
              data.itemNo ||
              data.sku ||
              data.productCode ||
              '',

            unit:
              data.unit ||
              data.measurement ||
              '',
          };
        });

        const availableProducts = items.filter(
          item => item.quantity > 0
        );

        setProducts(availableProducts);
        setLoading(false);
      },
      error => {
        console.log(
          'SHOP PRODUCTS ERROR:',
          error
        );

        setProducts([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, shopId, shopName, marketMode]);

  /* -------------------------------------------------------
     LIVE CART
  ------------------------------------------------------- */

  useEffect(() => {
    const firebaseUser = authInstance.currentUser;

    if (!firebaseUser) return;

    const cartDocRef = doc(db, 'customers', firebaseUser.uid, 'cart', 'mainCart');

    const unsubscribe = onSnapshot(
      cartDocRef,
      snapshot => {
        setCart(
          snapshot.exists()
            ? snapshot.data()?.items || {}
            : {}
        );
      },
      error => {
        console.log(
          'SHOP CART ERROR:',
          error
        );
      }
    );

    return () => unsubscribe();
  }, [authInstance, db]);

  /* -------------------------------------------------------
     CART TOTALS
  ------------------------------------------------------- */

  const cartItems = Object.values(cart || {});

  const totalItems = cartItems.reduce(
    (sum, item) =>
      sum + Number(item?.qty || 0),
    0
  );

  const totalAmount = cartItems.reduce(
    (sum, item) =>
      sum +
      Number(item?.price || 0) *
        Number(item?.qty || 0),
    0
  );

  const cartPreviewItems = cartItems
    .filter(item => item?.img)
    .slice(0, 3);

  /* -------------------------------------------------------
     FLYING CART ANIMATION
  ------------------------------------------------------- */

  const playAddAnimation = image => {
    setFlyingImage(image);

    flyOpacity.setValue(1);
    flyScale.setValue(1);
    flyTranslateX.setValue(0);
    flyTranslateY.setValue(0);

    Animated.parallel([
      Animated.timing(
        flyTranslateY,
        {
          toValue: 250,
          duration: 600,
          easing: Easing.inOut(
            Easing.cubic
          ),
          useNativeDriver: true,
        }
      ),

      Animated.timing(
        flyTranslateX,
        {
          toValue: 40,
          duration: 600,
          easing: Easing.inOut(
            Easing.cubic
          ),
          useNativeDriver: true,
        }
      ),

      Animated.timing(
        flyScale,
        {
          toValue: 0.18,
          duration: 600,
          easing: Easing.inOut(
            Easing.cubic
          ),
          useNativeDriver: true,
        }
      ),

      Animated.timing(
        flyOpacity,
        {
          toValue: 0,
          duration: 650,
          delay: 100,
          useNativeDriver: true,
        }
      ),
    ]).start(() => {
      setFlyingImage(null);
    });
  };

  /* -------------------------------------------------------
     ADD TO CART
  ------------------------------------------------------- */

  const handleAddToCart = async item => {
    const firebaseUser = authInstance.currentUser;

    if (!firebaseUser) {
      navigation.navigate('Login');
      return;
    }

    const existingQty = Number(
      cart?.[item.id]?.qty || 0
    );

    if (
      existingQty >=
      Number(item.quantity || 0)
    ) {
      return;
    }

    try {
      setAddingId(item.id);

      const updatedCart = {
        ...cart,

        [item.id]: {
          ...item,
          marketType: marketMode,
          qty: existingQty + 1,
        },
      };

      await setDoc(
        doc(db, 'customers', firebaseUser.uid, 'cart', 'mainCart'),
        {
          items: updatedCart,
          updatedAt:
            new Date().toISOString(),
        },
      );

      setCart(updatedCart);

      // Product → cart animation
      playAddAnimation(item.img);
    } catch (error) {
      console.log(
        'ADD TO CART ERROR:',
        error
      );
    } finally {
      setTimeout(() => {
        setAddingId(null);
      }, 250);
    }
  };

  /* -------------------------------------------------------
     UPDATE QUANTITY
  ------------------------------------------------------- */

  const updateQty = async (
    item,
    action
  ) => {
    const firebaseUser =
      authInstance.currentUser;

    if (!firebaseUser) return;

    if (!cart[item.id]) return;

    const updatedCart = {
      ...cart,
    };

    const currentQty = Number(
      updatedCart[item.id]?.qty || 0
    );

    if (action === 'add') {
      if (
        currentQty >=
        Number(item.quantity || 0)
      ) {
        return;
      }

      updatedCart[item.id] = {
        ...updatedCart[item.id],
        qty: currentQty + 1,
      };
    }

    if (action === 'remove') {
      const newQty = currentQty - 1;

      if (newQty <= 0) {
        delete updatedCart[item.id];
      } else {
        updatedCart[item.id] = {
          ...updatedCart[item.id],
          qty: newQty,
        };
      }
    }

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
    } catch (error) {
      console.log(
        'UPDATE CART ERROR:',
        error
      );
    }
  };

  /* -------------------------------------------------------
     PRODUCT CARD
  ------------------------------------------------------- */

  const renderProduct = ({
    item,
  }) => {
    const qty = Number(
      cart?.[item.id]?.qty || 0
    );

    const isAdding =
      addingId === item.id;

    return (
      <View style={styles.productCard}>

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() =>
            navigation.navigate('ProductDetailsScreen', {
              product: item,
              marketMode: item.marketType || marketMode,
            })
          }
        >
          {/* IMAGE */}

          <View style={styles.imageWrapper}>

            <Image
              source={{
                uri: item.img,
              }}
              style={styles.productImage}
              resizeMode="contain"
            />

            {item.hasDiscount && item.discountBadge ? (
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>
                  {item.discountBadge}
                </Text>
              </View>
            ) : null}

            {qty > 0 && (
              <View style={styles.addedBadge}>
                <MaterialCommunityIcons
                  name="check"
                  size={13}
                  color="#ffffff"
                />

                <Text style={styles.addedBadgeText}>
                  Added
                </Text>
              </View>
            )}

          </View>

          {/* PRODUCT INFO */}

          <View style={styles.productInfo}>

            <Text
              style={styles.productName}
              numberOfLines={2}
            >
              {item.name}
            </Text>

            <View style={styles.metaRow}>

              <Text
                style={styles.category}
                numberOfLines={1}
              >
                {item.category}
              </Text>

              {item.unit ? (
                <Text
                  style={styles.unit}
                  numberOfLines={1}
                >
                  {item.unit}
                </Text>
              ) : null}

            </View>

            <View style={styles.priceRow}>

              <View style={{flexDirection: 'row', alignItems: 'baseline', gap: 4}}>
                <Text style={styles.price}>
                  ₹{Number(item.price || 0).toLocaleString('en-IN')}
                </Text>

                {item.hasDiscount && item.originalPrice > item.price ? (
                  <Text style={styles.oldPrice}>
                    ₹{Number(item.originalPrice).toLocaleString('en-IN')}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.stock}>
                {item.quantity} left
              </Text>

            </View>

          </View>

        </TouchableOpacity>

          {/* ADD / QUANTITY */}

          {qty === 0 ? (

            <TouchableOpacity
              activeOpacity={0.88}
              style={[
                styles.addButton,
                isAdding &&
                  styles.addButtonPressed,
              ]}
              onPress={() =>
                handleAddToCart(item)
              }
            >

              <MaterialCommunityIcons
                name="plus"
                size={20}
                color="#ffffff"
              />

              <Text style={styles.addButtonText}>
                Add
              </Text>

            </TouchableOpacity>

          ) : (

            <View style={styles.quantityControl}>

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.qtyButton}
                onPress={() =>
                  updateQty(
                    item,
                    'remove'
                  )
                }
              >
                <MaterialCommunityIcons
                  name="minus"
                  size={19}
                  color="#0a8f48"
                />
              </TouchableOpacity>

              <Text style={styles.qtyText}>
                {qty}
              </Text>

             <TouchableOpacity
  activeOpacity={0.8}
  style={[
    styles.qtyButton,
    styles.qtyPlusButton,
  ]}
  onPress={() =>
    updateQty(item, 'add')
  }
>
                <MaterialCommunityIcons
                  name="plus"
                  size={19}
                  color="#ffffff"
                />
              </TouchableOpacity>

            </View>

          )}

      </View>
    );
  };

  /* -------------------------------------------------------
     HEADER
  ------------------------------------------------------- */

  const renderHeader = () => (
    <>

      <View style={styles.header}>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.backButton}
          onPress={() =>
            navigation.goBack()
          }
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color="#10251b"
          />
        </TouchableOpacity>

        <View style={styles.shopHeaderInfo}>

          {shopImage ? (
            <Image
              source={{
                uri: shopImage,
              }}
              style={styles.shopImage}
            />
          ) : (
            <View
              style={styles.shopPlaceholder}
            >
              <MaterialCommunityIcons
                name="store-outline"
                size={25}
                color="#0a9f50"
              />
            </View>
          )}

          <View
            style={styles.shopTextContainer}
          >

            <Text
              style={styles.shopName}
              numberOfLines={1}
            >
              {shopName}
            </Text>

            <View
              style={styles.openRow}
            >
              <View
                style={styles.openDot}
              />

              <Text
                style={styles.openText}
              >
                Open now
              </Text>
            </View>

          </View>

        </View>

        <View style={styles.headerStoreIcon}>
          <MaterialCommunityIcons
            name="storefront-outline"
            size={20}
            color="#0a9f50"
          />
        </View>

      </View>

      <View style={styles.shopLine} />

      <View style={styles.sectionHeader}>

        <View>
          <Text style={styles.sectionTitle}>
            Products
          </Text>

          <Text style={styles.sectionSubtitle}>
            Fresh products from this shop
          </Text>
        </View>

        <View style={styles.productCountPill}>
          <Text
            style={styles.productCountText}
          >
            {products.length}
          </Text>
        </View>

      </View>

    </>
  );

  /* -------------------------------------------------------
     MAIN
  ------------------------------------------------------- */

  return (
   <SafeAreaView
  style={styles.safeArea}
  edges={['top']}
>
  <StatusBar
    backgroundColor="#effbf4"
    barStyle="dark-content"
  />

      {loading ? (

        <>
          {renderHeader()}

          <View style={styles.loadingContainer}>

            <View style={styles.loaderCircle}>
              <ActivityIndicator
                size="large"
                color="#0a9f50"
              />
            </View>

            <Text style={styles.loadingTitle}>
              Loading products
            </Text>

            <Text style={styles.loadingSubtitle}>
              Please wait a moment...
            </Text>

          </View>
        </>

      ) : (

        <FlatList
          data={products}
          keyExtractor={item =>
            `${shopId}-${item.id}`
          }
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={
            styles.columnWrapper
          }
          showsVerticalScrollIndicator={
            false
          }
          ListHeaderComponent={
            renderHeader
          }
          contentContainerStyle={[
            styles.listContent,
            products.length === 0 &&
              styles.emptyList,
            totalItems > 0 &&
              styles.listWithCart,
          ]}
          ListEmptyComponent={

            <View style={styles.emptyContainer}>

              <View
                style={styles.emptyIcon}
              >
                <MaterialCommunityIcons
                  name="store-off-outline"
                  size={42}
                  color="#94a3b8"
                />
              </View>

              <Text
                style={styles.emptyTitle}
              >
                No products available
              </Text>

              <Text
                style={styles.emptyText}
              >
                This shop currently has no
                available products.
              </Text>

            </View>

          }
        />

      )}

      {/* ---------------------------------------------------
          FLYING PRODUCT IMAGE
      --------------------------------------------------- */}

      {flyingImage && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flyingProduct,
            {
              opacity: flyOpacity,
              transform: [
                {
                  translateX:
                    flyTranslateX,
                },
                {
                  translateY:
                    flyTranslateY,
                },
                {
                  scale: flyScale,
                },
              ],
            },
          ]}
        >
          <Image
            source={{
              uri: flyingImage,
            }}
            style={styles.flyingImage}
            resizeMode="contain"
          />
        </Animated.View>
      )}

      {/* ---------------------------------------------------
          FLOATING CART
      --------------------------------------------------- */}

      {totalItems > 0 && (

        <View
          style={styles.floatingCartWrapper}
          pointerEvents="box-none"
        >

          <TouchableOpacity
            activeOpacity={0.92}
            style={styles.floatingCart}
            onPress={() =>
              navigation.navigate(
                'CartScreen',
                {
                  cartData: cart,
                }
              )
            }
          >

            {/* CART ICON */}

            <View style={styles.cartIconCircle}>

              <MaterialCommunityIcons
                name="cart-outline"
                size={25}
                color="#ffffff"
              />

              <View
                style={styles.cartBadge}
              >
                <Text
                  style={styles.cartBadgeText}
                >
                  {totalItems > 99
                    ? '99+'
                    : totalItems}
                </Text>
              </View>

            </View>

            {/* PRODUCT THUMBNAILS */}

            <View
              style={styles.cartThumbs}
            >

              {cartPreviewItems.map(
                (item, index) => (
                  <Image
                    key={`${item.id}-${index}`}
                    source={{
                      uri: item.img,
                    }}
                    style={[
                      styles.cartThumb,
                      {
                        marginLeft:
                          index === 0
                            ? 0
                            : -12,
                        zIndex:
                          10 - index,
                      },
                    ]}
                  />
                )
              )}

            </View>

            {/* TEXT */}

            <View
              style={styles.cartTextContainer}
            >

              <Text
                style={styles.viewCartText}
              >
                View cart
              </Text>

              <Text
                style={styles.cartItemsText}
              >
                {totalItems} item
                {totalItems > 1
                  ? 's'
                  : ''}{' '}
                • ₹
                {totalAmount.toFixed(0)}
              </Text>

            </View>

            {/* ARROW */}

            <View
              style={styles.cartArrow}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={25}
                color="#ffffff"
              />
            </View>

          </TouchableOpacity>

        </View>

      )}

    </SafeAreaView>
  );
};

export default ShopProductsScreen;

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: '#f7faf8',
  },

  /* HEADER */

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#effbf4',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    marginRight: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  shopHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  shopImage: {
    width: 50,
    height: 50,
    borderRadius: 15,
    marginRight: 12,
    backgroundColor: '#e8f5ed',
  },

  shopPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#dcf8e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  shopTextContainer: {
    flex: 1,
  },

  shopName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10251b',
    letterSpacing: -0.3,
  },

  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  openDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16a05a',
    marginRight: 6,
  },

  openText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4f6b5b',
  },

  headerStoreIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dcf8e8',
    marginLeft: 8,
  },

  shopLine: {
    height: 1,
    backgroundColor: '#e2eee7',
  },

  /* SECTION */

  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 13,
    backgroundColor: '#f7faf8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#10251b',
    letterSpacing: -0.5,
  },

  sectionSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#809087',
  },

  productCountPill: {
    minWidth: 40,
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    backgroundColor: '#e2f7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },

  productCountText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#078b46',
  },

  /* LIST */

  listContent: {
    paddingHorizontal: H_PADDING,
    paddingBottom: 25,
  },

  listWithCart: {
    paddingBottom: 125,
  },

  columnWrapper: {
    justifyContent: 'space-between',
  },

  /* PRODUCT CARD */

  productCard: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',

    borderWidth: 1,
    borderColor: '#edf2ee',

    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.035,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  imageWrapper: {
    width: '100%',
    height: CARD_WIDTH * 0.92,
    backgroundColor: '#f8faf9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  productImage: {
    width: '88%',
    height: '88%',
  },

  addedBadge: {
    position: 'absolute',
    top: 9,
    left: 9,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#0a9f50',
  },

  addedBadgeText: {
    marginLeft: 3,
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },

  productInfo: {
    paddingHorizontal: 11,
    paddingTop: 10,
    paddingBottom: 11,
  },

  productName: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '750',
    color: '#15271d',
    minHeight: 38,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  category: {
    flex: 1,
    fontSize: 10,
    color: '#9aa8a0',
    fontWeight: '600',
  },

  unit: {
    fontSize: 10,
    color: '#9aa8a0',
    fontWeight: '600',
    marginLeft: 4,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
    marginBottom: 10,
  },

  price: {
    fontSize: 17,
    fontWeight: '900',
    color: '#078f48',
    letterSpacing: -0.3,
  },

  oldPrice: {
    fontSize: 12,
    color: '#9aa8a0',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },

  discountBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },

  discountBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  stock: {
    fontSize: 10,
    color: '#77877e',
    fontWeight: '600',
  },

  /* ADD */

  addButton: {
    height: 42,
    borderRadius: 14,
    backgroundColor: '#0aa353',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    elevation: 1,
    shadowColor: '#0aa353',
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  addButtonPressed: {
    opacity: 0.7,
  },

  addButtonText: {
    marginLeft: 5,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },

  /* QUANTITY */

  quantityControl: {
    height: 42,
    borderRadius: 14,
    backgroundColor: '#e9f8ef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: '#bce9ce',
  },

  qtyButton: {
    width: 34,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
qtyPlusButton: {
  backgroundColor: '#0aa353',
},
  qtyText: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '900',
    color: '#153127',
  },

  /* LOADING */

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },

  loaderCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e4f8ed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingTitle: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: '800',
    color: '#20382b',
  },

  loadingSubtitle: {
    marginTop: 5,
    fontSize: 12,
    color: '#8a9991',
  },

  /* EMPTY */

  emptyList: {
    flexGrow: 1,
  },

  emptyContainer: {
    flex: 1,
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#edf3ef',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '800',
    color: '#33483b',
  },

  emptyText: {
    marginTop: 7,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    color: '#94a39a',
  },

  /* FLYING IMAGE */

  flyingProduct: {
    position: 'absolute',

    width: 72,
    height: 72,

    borderRadius: 36,

    left:
      width / 2 - 36,

    top:
      '42%',

    backgroundColor: '#ffffff',

    alignItems: 'center',
    justifyContent: 'center',

    elevation: 12,

    shadowColor: '#0aa353',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    zIndex: 999,
  },

  flyingImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },

  /* FLOATING CART */

  floatingCartWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    alignItems: 'center',
    zIndex: 500,
  },

  floatingCart: {
    width: Math.min(
      width - 36,
      390
    ),
    minHeight: 72,
    borderRadius: 36,

    backgroundColor: '#087d27',

    flexDirection: 'row',
    alignItems: 'center',

    paddingLeft: 8,
    paddingRight: 8,

    elevation: 12,

    shadowColor: '#087d27',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 7,
    },
  },

  cartIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#096f25',

    alignItems: 'center',
    justifyContent: 'center',

    position: 'relative',
  },

  cartBadge: {
    position: 'absolute',
    right: -1,
    top: -2,

    minWidth: 20,
    height: 20,

    borderRadius: 10,

    paddingHorizontal: 5,

    backgroundColor: '#ff4545',

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 2,
    borderColor: '#087d27',
  },

  cartBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },

  cartThumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 7,
  },

  cartThumb: {
    width: 42,
    height: 42,
    borderRadius: 21,

    backgroundColor: '#ffffff',

    borderWidth: 2,
    borderColor: '#ffffff',
  },

  cartTextContainer: {
    flex: 1,
    marginLeft: 10,
  },

  viewCartText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },

  cartItemsText: {
    marginTop: 2,
    color: '#d9f8e3',
    fontSize: 11,
    fontWeight: '600',
  },

  cartArrow: {
    width: 48,
    height: 48,
    borderRadius: 24,

    backgroundColor: '#096f25',

    alignItems: 'center',
    justifyContent: 'center',

    marginLeft: 5,
  },

});
