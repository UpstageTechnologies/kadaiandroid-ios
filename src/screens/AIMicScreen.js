import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { getApp } from '@react-native-firebase/app';

import {
  getAI,
  getGenerativeModel,
  Schema,
} from '@react-native-firebase/ai';

import { getAuth } from '@react-native-firebase/auth';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
} from '@react-native-firebase/firestore';

import Voice from '../services/SpeechRecognition';
import { getAppCheckInstance } from '../services/firebaseAppCheck';

const { width } = Dimensions.get('window');

const GREEN = '#0b9d50';
const BG = '#f7fbf8';
const TEXT = '#17251d';
const SUB = '#718078';
const WHITE = '#ffffff';
const BORDER = '#e3eee7';

const normalize = value =>
  String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const makeProduct = (
  id,
  data,
  shopId,
  market,
) => ({
  id,
  shopId,
  market,

  shopName:
    data.shopName ||
    data.sellerName ||
    'Shop',

  name:
    data.itemName ||
    data.name ||
    'Product',

  price: Number(
    data.salesPrice ??
      data.price ??
      0,
  ),

  quantity: Number(
    data.quantity ?? 0,
  ),

  category:
    data.category ||
    'General',

  img:
    data.image ||
    data.img ||
    'https://picsum.photos/500',

  itemNo:
    data.itemNo ||
    '',

  unit:
    data.unit ||
    data.measurement ||
    '',
});

export default function AIMicScreen({
  navigation,
  route,
}) {
  const insets = useSafeAreaInsets();

  const auth = getAuth();
  const db = getFirestore();

  /*
   * CustomerHome will send the seller IDs that are already
   * relevant for this customer/location.
   */
  const nearSellerIds = Array.isArray(
    route?.params?.nearSellerIds,
  )
    ? route.params.nearSellerIds
    : [];

  const addressText =
    route?.params?.addressText ||
    'Your delivery location';

  const [
    isListening,
    setIsListening,
  ] = useState(false);

  const [
    isProcessing,
    setIsProcessing,
  ] = useState(false);

  const [
    transcript,
    setTranscript,
  ] = useState('');

  const [
    errorText,
    setErrorText,
  ] = useState('');

  const [
    results,
    setResults,
  ] = useState([]);

  const [
    selectedQty,
    setSelectedQty,
  ] = useState({});

  const [
    savingCart,
    setSavingCart,
  ] = useState(false);

  const mountedRef =
    useRef(true);

  const processingRef =
    useRef(false);

  const finalResultRef =
    useRef(false);

  const transcriptRef =
    useRef('');

  const endTimerRef =
    useRef(null);

  const processRef =
    useRef(null);

  /* ---------------- ANIMATION ---------------- */

  const pulse =
    useRef(
      new Animated.Value(1),
    ).current;

  const glow =
    useRef(
      new Animated.Value(0.35),
    ).current;

  const wave1 =
    useRef(
      new Animated.Value(0.3),
    ).current;

  const wave2 =
    useRef(
      new Animated.Value(0.5),
    ).current;

  const wave3 =
    useRef(
      new Animated.Value(0.8),
    ).current;

  const wave4 =
    useRef(
      new Animated.Value(0.45),
    ).current;

  const wave5 =
    useRef(
      new Animated.Value(0.65),
    ).current;

  /* =========================================================
     LOAD LOCAL + GLOBAL PRODUCTS
     ========================================================= */

  const fetchProducts = async (
    requestedItems,
  ) => {
    if (!nearSellerIds.length) {
      throw new Error(
        'Nearby shop information is not available. Please return to Customer Home and try again.',
      );
    }

    const allProducts = [];

    /*
     * IMPORTANT:
     * We deliberately read BOTH collections.
     *
     * inventory          -> Local
     * global_inventory   -> Global
     */

    for (
      const sellerId of nearSellerIds
    ) {
      const [
        localSnapshot,
        globalSnapshot,
      ] = await Promise.all([
        getDocs(
          collection(
            db,
            'users',
            sellerId,
            'inventory',
          ),
        ),

        getDocs(
          collection(
            db,
            'users',
            sellerId,
            'global_inventory',
          ),
        ),
      ]);

      localSnapshot.forEach(
        snap => {
          const data =
            snap.data() || {};

          const product =
            makeProduct(
              snap.id,
              data,
              sellerId,
              'local',
            );

          if (
            product.quantity > 0
          ) {
            allProducts.push(
              product,
            );
          }
        },
      );

      globalSnapshot.forEach(
        snap => {
          const data =
            snap.data() || {};

          const product =
            makeProduct(
              snap.id,
              data,
              sellerId,
              'global',
            );

          if (
            product.quantity > 0
          ) {
            allProducts.push(
              product,
            );
          }
        },
      );
    }

    const matched = [];

    /*
     * Match every product spoken by customer.
     */

    for (
      const requestItem of requestedItems
    ) {
      const search =
        normalize(
          requestItem.product,
        );

      const matches =
        allProducts
          .map(product => {
            const productText =
              normalize(
                `${product.name} ${product.itemNo} ${product.category}`,
              );

            let score = 0;

            if (
              productText ===
              search
            ) {
              score = 100;
            } else if (
              normalize(
                product.name,
              ) === search
            ) {
              score = 95;
            } else if (
              productText.includes(
                search,
              )
            ) {
              score = 80;
            } else if (
              search.includes(
                normalize(
                  product.name,
                ),
              )
            ) {
              score = 70;
            }

            return {
              product,
              score,
            };
          })
          .filter(
            x => x.score > 0,
          )
          .sort(
            (a, b) =>
              b.score - a.score,
          );

      /*
       * For every spoken product we show
       * BOTH local and global matches.
       */

      matches.forEach(
        match => {
          matched.push({
            product:
              match.product,

            requestedQty: Math.max(
              1,
              Math.min(
                99,
                Math.floor(
                  Number(
                    requestItem.quantity,
                  ) || 1,
                ),
              ),
            ),
          });
        },
      );
    }

    /*
     * Remove duplicate product records.
     */

    const unique = [];
    const seen = new Set();

    matched.forEach(
      item => {
        const key =
          `${item.product.market}-${item.product.shopId}-${item.product.id}`;

        if (
          !seen.has(key)
        ) {
          seen.add(key);

          unique.push(
            item,
          );
        }
      },
    );

    if (!unique.length) {
      throw new Error(
        `I could not find ${requestedItems
          .map(
            x => x.product,
          )
          .join(
            ', ',
          )} in the available shops.`,
      );
    }

    /*
     * Initial quantity comes from voice.
     *
     * Example:
     * "2 kg tomato"
     * => Tomato quantity = 2
     */

    const initialQty = {};

    unique.forEach(
      ({
        product,
        requestedQty,
      }) => {
        const stock =
          Math.max(
            1,
            Math.floor(
              product.quantity ||
                requestedQty,
            ),
          );

        initialQty[
          `${product.market}-${product.shopId}-${product.id}`
        ] = Math.min(
          requestedQty,
          stock,
        );
      },
    );

    if (
      mountedRef.current
    ) {
      setResults(
        unique,
      );

      setSelectedQty(
        initialQty,
      );
    }
  };

  /* =========================================================
     GEMINI VOICE PROCESSING
     ========================================================= */

  const processTranscript =
    async spokenText => {
      const requestText =
        String(
          spokenText || '',
        ).trim();

      if (
        !requestText ||
        processingRef.current
      ) {
        if (
          !requestText &&
          mountedRef.current
        ) {
          setErrorText(
            'I did not catch that. Please try speaking again.',
          );
        }

        return;
      }

      processingRef.current =
        true;

      finalResultRef.current =
        true;

      if (
        endTimerRef.current
      ) {
        clearTimeout(
          endTimerRef.current,
        );
      }

      setTranscript(
        requestText,
      );

      transcriptRef.current =
        requestText;

      setIsListening(
        false,
      );

      setIsProcessing(
        true,
      );

      setErrorText('');

      setResults([]);

      try {
        const appCheckInstance =
          getAppCheckInstance();

        const model =
          getGenerativeModel(
            getAI(
              getApp(),
              {
                appCheck:
                  appCheckInstance,
              },
            ),
            {
              model:
                'gemini-3.1-flash-lite',

              generationConfig:
                {
                  responseMimeType:
                    'application/json',

                  responseSchema:
                    Schema.object(
                      {
                        properties:
                          {
                            intent:
                              Schema.enumString(
                                {
                                  enum: [
                                    'SEARCH_PRODUCT',
                                    'ADD_TO_CART',
                                    'NO_ACTION',
                                  ],
                                },
                              ),

                            items:
                              Schema.array(
                                {
                                  minItems: 1,
                                  maxItems: 50,

                                  items:
                                    Schema.object(
                                      {
                                        properties:
                                          {
                                            product:
                                              Schema.string(),

                                            quantity:
                                              Schema.integer(
                                                {
                                                  minimum: 1,
                                                  maximum: 99,
                                                },
                                              ),
                                          },
                                      },
                                    ),
                                },
                              ),
                          },
                      },
                    ),
                },
            },
          );
const request =
  model.generateContent(
    `You are an advanced shopping-list parser for a grocery ecommerce app.

RETURN ONLY VALID JSON.

Your most important job is to extract EVERY SINGLE PRODUCT
mentioned by the customer.

The customer may say:
- 1 product
- 5 products
- 10 products
- 20 products
- 30 or more products

NEVER stop after the first product.
NEVER return only the last product.
NEVER summarize the shopping list.
NEVER merge different products into one item.

Create ONE item object for EACH DISTINCT PRODUCT.

For every product:
- product = clean product name only
- quantity = requested quantity
- if quantity is not mentioned, use 1
- preserve the order in which products were spoken

Remove command words such as:
add, buy, get, give me, want, need, show me,
please, bring, purchase.

Remove measurement words from product names when they are
only describing quantity:
kg, kilo, kgs, gram, grams, g,
litre, liter, litres, l,
ml, packet, packets, pack, bottle, bottles,
piece, pieces, dozen.

Examples:

Customer:
"add 2 kg tomato and 1 litre milk"

Return:
{
  "intent": "SEARCH_PRODUCT",
  "items": [
    {"product": "tomato", "quantity": 2},
    {"product": "milk", "quantity": 1}
  ]
}

Customer:
"give me rice, sugar, oil, salt, milk and eggs"

Return SIX separate items.

Customer:
"add 2 tomato, 3 milk, 1 rice, 2 sugar"

Return FOUR separate items.

If the same product is mentioned more than once,
combine the quantities into ONE item.

Example:
"2 milk and another 1 milk"

Return:
{
  "product": "milk",
  "quantity": 3
}

VERY IMPORTANT:
If the customer speaks 23 different products,
the response MUST contain 23 item objects.

Do not invent products.
Do not omit products.
Do not stop early.

Spoken shopping request:
${requestText}`,
  );

        let timeout;

        const result =
          await Promise.race([
            request,

            new Promise(
              (_, reject) => {
                timeout =
                  setTimeout(
                    () =>
                      reject(
                        new Error(
                          'The AI request timed out. Please try again.',
                        ),
                      ),
                    25000,
                  );
              },
            ),
          ]).finally(
            () =>
              clearTimeout(
                timeout,
              ),
          );

        const raw =
          result?.response?.text?.();

        if (
          !raw?.trim()
        ) {
          throw new Error(
            'The AI returned an empty response.',
          );
        }

        const jsonStart =
          raw.indexOf('{');

        const jsonEnd =
          raw.lastIndexOf('}');

        const parsed =
          JSON.parse(
            raw.slice(
              jsonStart >= 0
                ? jsonStart
                : 0,

              jsonEnd >= 0
                ? jsonEnd + 1
                : undefined,
            ),
          );

        if (
          !Array.isArray(
            parsed?.items,
          ) ||
          parsed.items.length === 0
        ) {
          throw new Error(
            'I could not understand the products in your voice request.',
          );
        }

        await fetchProducts(
          parsed.items,
        );
      } catch (error) {
        console.warn(
          '[AI SHOPPING]',
          error?.message ||
            error,
        );

        if (
          mountedRef.current
        ) {
          const message =
            String(
              error?.message ||
                '',
            );

          setErrorText(
            message.includes(
              'App Check token is invalid',
            )
              ? 'Firebase App Check rejected this debug build.'
              : message ||
                  'Unable to process your request.',
          );
        }
      } finally {
        processingRef.current =
          false;

        if (
          mountedRef.current
        ) {
          setIsProcessing(
            false,
          );
        }
      }
    };

  processRef.current =
    processTranscript;

  /* =========================================================
     SPEECH EVENTS
     ========================================================= */

  useEffect(() => {
    mountedRef.current =
      true;

    Voice.onSpeechStart =
      () => {
        if (
          mountedRef.current
        ) {
          setIsListening(
            true,
          );
        }
      };

    Voice.onSpeechPartialResults =
      event => {
        const partial =
          event?.value?.[0];

        if (
          mountedRef.current &&
          typeof partial ===
            'string'
        ) {
          transcriptRef.current =
            partial;

          setTranscript(
            partial,
          );
        }
      };

    Voice.onSpeechResults =
      event => {
        const finalText =
          event?.value?.[0];

        if (
          typeof finalText ===
            'string' &&
          finalText.trim()
        ) {
          processRef.current?.(
            finalText,
          );
        }
      };

    Voice.onSpeechError =
      event => {
        if (
          endTimerRef.current
        ) {
          clearTimeout(
            endTimerRef.current,
          );
        }

        if (
          mountedRef.current &&
          !processingRef.current
        ) {
          setIsListening(
            false,
          );

          setErrorText(
            event?.error
              ? `Speech recognition error: ${event.error}`
              : 'Speech recognition failed. Please try again.',
          );
        }
      };

    Voice.onSpeechEnd =
      () => {
        if (
          !mountedRef.current ||
          processingRef.current
        ) {
          return;
        }

        setIsListening(
          false,
        );

        endTimerRef.current =
          setTimeout(() => {
            if (
              !finalResultRef.current &&
              mountedRef.current
            ) {
              const lastPartial =
                transcriptRef.current;

              if (
                lastPartial.trim()
              ) {
                processRef.current?.(
                  lastPartial,
                );
              } else {
                setErrorText(
                  'No speech was detected. Please try again.',
                );
              }
            }
          }, 500);
      };

    return () => {
      mountedRef.current =
        false;

      if (
        endTimerRef.current
      ) {
        clearTimeout(
          endTimerRef.current,
        );
      }

      Voice.onSpeechStart =
        undefined;

      Voice.onSpeechPartialResults =
        undefined;

      Voice.onSpeechResults =
        undefined;

      Voice.onSpeechError =
        undefined;

      Voice.onSpeechEnd =
        undefined;

      Voice.cancel()
        .catch(() => {})
        .finally(() =>
          Voice.destroy().catch(
            () => {},
          ),
        );

      Voice.removeAllListeners();
    };
  }, []);

  /* =========================================================
     MIC ANIMATION
     ========================================================= */

  useEffect(() => {
    const animation =
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(
              pulse,
              {
                toValue: 1.06,
                duration: 850,
                useNativeDriver: true,
              },
            ),

            Animated.timing(
              glow,
              {
                toValue: 0.7,
                duration: 850,
                useNativeDriver: true,
              },
            ),
          ]),

          Animated.parallel([
            Animated.timing(
              pulse,
              {
                toValue: 1,
                duration: 850,
                useNativeDriver: true,
              },
            ),

            Animated.timing(
              glow,
              {
                toValue: 0.35,
                duration: 850,
                useNativeDriver: true,
              },
            ),
          ]),
        ]),
      );

    animation.start();

    return () =>
      animation.stop();
  }, [
    pulse,
    glow,
  ]);

  useEffect(() => {
    if (!isListening)
      return;

    const animation =
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(
              wave1,
              {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
              },
            ),

            Animated.timing(
              wave1,
              {
                toValue: 0.25,
                duration: 350,
                useNativeDriver: true,
              },
            ),
          ]),

          Animated.sequence([
            Animated.timing(
              wave2,
              {
                toValue: 0.35,
                duration: 420,
                useNativeDriver: true,
              },
            ),

            Animated.timing(
              wave2,
              {
                toValue: 1,
                duration: 420,
                useNativeDriver: true,
              },
            ),
          ]),

          Animated.sequence([
            Animated.timing(
              wave3,
              {
                toValue: 0.4,
                duration: 300,
                useNativeDriver: true,
              },
            ),

            Animated.timing(
              wave3,
              {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              },
            ),
          ]),

          Animated.sequence([
            Animated.timing(
              wave4,
              {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
              },
            ),

            Animated.timing(
              wave4,
              {
                toValue: 0.3,
                duration: 500,
                useNativeDriver: true,
              },
            ),
          ]),

          Animated.sequence([
            Animated.timing(
              wave5,
              {
                toValue: 0.35,
                duration: 380,
                useNativeDriver: true,
              },
            ),

            Animated.timing(
              wave5,
              {
                toValue: 1,
                duration: 380,
                useNativeDriver: true,
              },
            ),
          ]),
        ]),
      );

    animation.start();

    return () =>
      animation.stop();
  }, [
    isListening,
    wave1,
    wave2,
    wave3,
    wave4,
    wave5,
  ]);

  /* =========================================================
     MIC START / STOP
     ========================================================= */

  const startListening =
    async () => {
      if (isProcessing)
        return;

      setErrorText('');
      setResults([]);
      setSelectedQty({});
      setTranscript('');

      transcriptRef.current =
        '';

      finalResultRef.current =
        false;

      try {
        if (
          Platform.OS ===
          'android'
        ) {
          const permission =
            await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS
                .RECORD_AUDIO,
              {
                title:
                  'Microphone permission',

                message:
                  'Allow microphone access to search and shop using your voice.',

                buttonPositive:
                  'Allow',

                buttonNegative:
                  'Deny',
              },
            );

          if (
            permission !==
            PermissionsAndroid.RESULTS
              .GRANTED
          ) {
            setErrorText(
              'Microphone permission was denied.',
            );

            return;
          }
        }

        const available =
          await Voice.isAvailable();

        if (!available) {
          setErrorText(
            'Speech recognition is not available on this device.',
          );

          return;
        }

        await Voice.start(
          'en-IN',
          {
            EXTRA_PARTIAL_RESULTS:
              true,

            REQUEST_PERMISSIONS_AUTO:
              true,
          },
        );

        setIsListening(
          true,
        );
      } catch (error) {
        setIsListening(
          false,
        );

        setErrorText(
          error?.message ||
            'Unable to start speech recognition.',
        );
      }
    };

  const stopListening =
    async () => {
      try {
        await Voice.stop();
      } catch {
        setIsListening(
          false,
        );
      }
    };

  /* =========================================================
     QUANTITY
     ========================================================= */

  const updateQty = (
    key,
    delta,
    stock,
  ) => {
    setSelectedQty(
      current => {
        const currentQty =
          Number(
            current[key] || 1,
          );

        const next =
          Math.max(
            1,
            Math.min(
              Math.max(
                1,
                Number(
                  stock || 1,
                ),
              ),
              currentQty +
                delta,
            ),
          );

        return {
          ...current,
          [key]: next,
        };
      },
    );
  };

  /* =========================================================
     GROUP LOCAL / GLOBAL
     ========================================================= */

  const localResults =
    useMemo(
      () =>
        results.filter(
          item =>
            item.product
              .market ===
            'local',
        ),
      [results],
    );

  const globalResults =
    useMemo(
      () =>
        results.filter(
          item =>
            item.product
              .market ===
            'global',
        ),
      [results],
    );

  const createShopGroups =
    list => {
      const map =
        new Map();

      list.forEach(
        item => {
          const key =
            item.product
              .shopId;

          if (
            !map.has(key)
          ) {
            map.set(
              key,
              {
                shopId:
                  key,

                shopName:
                  item.product
                    .shopName,

                market:
                  item.product
                    .market,

                items: [],
              },
            );
          }

          map
            .get(key)
            .items.push(
              item,
            );
        },
      );

      return Array.from(
        map.values(),
      );
    };

  const localShops =
    useMemo(
      () =>
        createShopGroups(
          localResults,
        ),
      [localResults],
    );

  const globalShops =
    useMemo(
      () =>
        createShopGroups(
          globalResults,
        ),
      [globalResults],
    );

  /* =========================================================
     TOTAL
     ========================================================= */

  const totalSelectedItems =
    results.reduce(
      (sum, item) => {
        const key =
          `${item.product.market}-${item.product.shopId}-${item.product.id}`;

        return (
          sum +
          Number(
            selectedQty[key] ||
              0,
          )
        );
      },
      0,
    );

  const totalSelectedAmount =
    results.reduce(
      (sum, item) => {
        const key =
          `${item.product.market}-${item.product.shopId}-${item.product.id}`;

        return (
          sum +
          Number(
            item.product
              .price || 0,
          ) *
            Number(
              selectedQty[
                key
              ] || 0,
            )
        );
      },
      0,
    );

  /* =========================================================
     PROCEED TO CHECKOUT
     ========================================================= */

  const saveAndCheckout =
    async () => {
      const user =
        auth.currentUser;

      if (!user?.uid) {
        navigation.navigate(
          'Login',
        );

        return;
      }

      const chosen =
        results
          .map(item => {
            const key =
              `${item.product.market}-${item.product.shopId}-${item.product.id}`;

            return {
              ...item.product,

              qty: Number(
                selectedQty[
                  key
                ] || 0,
              ),
            };
          })
          .filter(
            item =>
              item.qty > 0,
          );

      if (!chosen.length) {
        setErrorText(
          'Select at least one product before checkout.',
        );

        return;
      }

      setSavingCart(
        true,
      );

      try {
        const cartRef =
          doc(
            db,
            'customers',
            user.uid,
            'cart',
            'mainCart',
          );

        const existingSnap =
          await getDoc(
            cartRef,
          );

        const existingItems =
          existingSnap.exists() &&
          existingSnap.data()
            ?.items
            ? existingSnap.data()
                .items
            : {};

        const merged = {
          ...existingItems,
        };

        chosen.forEach(
          item => {
            const key =
              item.id;

            merged[key] = {
              ...item,

              qty:
                Number(
                  merged[key]
                    ?.qty || 0,
                ) +
                Number(
                  item.qty || 0,
                ),
            };
          },
        );

        await setDoc(
          cartRef,
          {
            items:
              merged,

            updatedAt:
              new Date().toISOString(),
          },
        );

        navigation.navigate(
          'CartScreen',
          {
            cartData:
              merged,
          },
        );
      } catch (error) {
        console.warn(
          '[AI SHOPPING CART]',
          error?.message ||
            error,
        );

        setErrorText(
          'Unable to prepare your cart. Please try again.',
        );
      } finally {
        if (
          mountedRef.current
        ) {
          setSavingCart(
            false,
          );
        }
      }
    };

  /* =========================================================
     UI HELPERS
     ========================================================= */

  const renderWave = (
    animation,
    height,
  ) => (
    <Animated.View
      style={[
        styles.waveBar,
        {
          height,
          transform: [
            {
              scaleY:
                animation,
            },
          ],
        },
      ]}
    />
  );

  const renderProduct =
    item => {
      const product =
        item.product;

      const key =
        `${product.market}-${product.shopId}-${product.id}`;

      const qty =
        Number(
          selectedQty[key] ||
            1,
        );

      const stock =
        Math.max(
          1,
          Number(
            product.quantity ||
              1,
          ),
        );

      return (
        <View
          key={key}
          style={
            styles.productRow
          }
        >
          <Image
            source={{
              uri: product.img,
            }}
            style={
              styles.productImage
            }
          />

          <View
            style={
              styles.productInfo
            }
          >
            <Text
              style={
                styles.productName
              }
              numberOfLines={1}
            >
              {product.name}
            </Text>

            <Text
              style={
                styles.productPrice
              }
            >
              ₹
              {product.price.toFixed(
                0,
              )}

              {product.unit
                ? ` / ${product.unit}`
                : ''}
            </Text>
          </View>

          <View
            style={
              styles.qtyControl
            }
          >
            <TouchableOpacity
              style={
                styles.qtyButton
              }
              onPress={() =>
                updateQty(
                  key,
                  -1,
                  stock,
                )
              }
            >
              <MaterialCommunityIcons
                name="minus"
                size={17}
                color={
                  GREEN
                }
              />
            </TouchableOpacity>

            <Text
              style={
                styles.qtyText
              }
            >
              {qty}
            </Text>

            <TouchableOpacity
              style={[
                styles.qtyButton,
                qty >=
                  stock &&
                  styles.qtyButtonDisabled,
              ]}
              disabled={
                qty >=
                stock
              }
              onPress={() =>
                updateQty(
                  key,
                  1,
                  stock,
                )
              }
            >
              <MaterialCommunityIcons
                name="plus"
                size={17}
                color={
                  qty >=
                  stock
                    ? '#a6b8ae'
                    : GREEN
                }
              />
            </TouchableOpacity>
          </View>
        </View>
      );
    };

  const renderShop =
    shop => (
      <View
        key={`${shop.market}-${shop.shopId}`}
        style={
          styles.shopCard
        }
      >
        <View
          style={
            styles.shopHeader
          }
        >
          <View
            style={
              styles.shopIcon
            }
          >
            <MaterialCommunityIcons
              name={
                shop.market ===
                'local'
                  ? 'map-marker-radius'
                  : 'earth'
              }
              size={21}
              color={GREEN}
            />
          </View>

          <View
            style={
              styles.shopTitleWrap
            }
          >
            <Text
              style={
                styles.shopName
              }
            >
              {shop.shopName}
            </Text>

            <View
              style={
                styles.shopBadge
              }
            >
              <Text
                style={
                  styles.shopBadgeText
                }
              >
                {shop.market ===
                'local'
                  ? 'LOCAL • NEARBY'
                  : 'GLOBAL • DELIVERY'}
              </Text>
            </View>
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color="#789087"
          />
        </View>

        <View
          style={
            styles.divider
          }
        />

        {shop.items.map(
          renderProduct,
        )}

        <View
          style={
            styles.shopSubtotal
          }
        >
          <Text
            style={
              styles.subtotalLabel
            }
          >
            Subtotal
          </Text>

          <Text
            style={
              styles.subtotalValue
            }
          >
            ₹
            {shop.items
              .reduce(
                (
                  sum,
                  item,
                ) => {
                  const key =
                    `${item.product.market}-${item.product.shopId}-${item.product.id}`;

                  return (
                    sum +
                    Number(
                      item.product
                        .price ||
                        0,
                    ) *
                      Number(
                        selectedQty[
                          key
                        ] || 0,
                      )
                  );
                },
                0,
              )
              .toFixed(0)}
          </Text>
        </View>
      </View>
    );

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <View
      style={
        styles.container
      }
    >
      <StatusBar
        backgroundColor={
          WHITE
        }
        barStyle="dark-content"
      />

      <SafeAreaView
        edges={['top']}
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.header
          }
        >
          <TouchableOpacity
            style={
              styles.backButton
            }
            onPress={() =>
              navigation.goBack()
            }
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="#26352d"
            />
          </TouchableOpacity>

          <View
            style={
              styles.headerCenter
            }
          >
            <View
              style={
                styles.aiMiniIcon
              }
            >
              <MaterialCommunityIcons
                name="creation"
                size={17}
                color={GREEN}
              />
            </View>

            <Text
              style={
                styles.headerTitle
              }
            >
              AI Shopping
            </Text>
          </View>

          <View
            style={
              styles.statusDot
            }
          />
        </View>
      </SafeAreaView>

      <ScrollView
        style={
          styles.scroll
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              Math.max(
                insets.bottom,
                16,
              ) + 110,
          },
        ]}
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* =================================================
            EMPTY / MIC STATE
            ================================================= */}

        {results.length ===
        0 ? (
          <>
            <View
              style={
                styles.topCopy
              }
            >
              <Text
                style={
                  styles.title
                }
              >
                What are you{'\n'}
                looking for?
              </Text>

              <Text
                style={
                  styles.subtitle
                }
              >
                Search for products or
                add them to your cart
                using your voice.
              </Text>
            </View>

            <View
              style={
                styles.micSection
              }
            >
              <Animated.View
                style={[
                  styles.outerGlow,
                  {
                    opacity:
                      glow,
                    transform: [
                      {
                        scale:
                          pulse,
                      },
                    ],
                  },
                ]}
              />

              <Animated.View
                style={[
                  styles.outerRing,
                  {
                    transform: [
                      {
                        scale:
                          pulse,
                      },
                    ],
                  },
                ]}
              />

              <TouchableOpacity
                style={
                  styles.micButton
                }
                activeOpacity={
                  0.9
                }
                disabled={
                  isProcessing
                }
                onPress={
                  isListening
                    ? stopListening
                    : startListening
                }
              >
                <MaterialCommunityIcons
                  name={
                    isProcessing
                      ? 'progress-clock'
                      : isListening
                        ? 'stop'
                        : 'microphone'
                  }
                  size={42}
                  color="#ffffff"
                />
              </TouchableOpacity>
            </View>

            <View
              style={
                styles.statusArea
              }
            >
              {isProcessing ? (
                <>
                  <Text
                    style={
                      styles.listeningTitle
                    }
                  >
                    Finding products...
                  </Text>

                  <Text
                    style={
                      styles.listeningSubtitle
                    }
                  >
                    Checking local and global shops
                  </Text>

                  <ActivityIndicator
                    style={{
                      marginTop: 10,
                    }}
                    color={
                      GREEN
                    }
                  />
                </>
              ) : isListening ? (
                <>
                  <Text
                    style={
                      styles.listeningTitle
                    }
                  >
                    Listening...
                  </Text>

                  <Text
                    style={
                      styles.listeningSubtitle
                    }
                  >
                    Tell me everything you want to buy
                  </Text>

                  <View
                    style={
                      styles.waveform
                    }
                  >
                    {renderWave(
                      wave1,
                      22,
                    )}
                    {renderWave(
                      wave2,
                      36,
                    )}
                    {renderWave(
                      wave3,
                      52,
                    )}
                    {renderWave(
                      wave4,
                      32,
                    )}
                    {renderWave(
                      wave5,
                      42,
                    )}
                  </View>
                </>
              ) : (
                <>
                  <Text
                    style={
                      styles.readyTitle
                    }
                  >
                    Search your products
                  </Text>

                  <Text
                    style={
                      styles.readySubtitle
                    }
                  >
                    “Add 2 kg tomato and 1 litre milk”
                  </Text>
                </>
              )}

              {transcript ? (
                <View
                  style={
                    styles.transcriptBubble
                  }
                >
                  <Text
                    style={
                      styles.transcriptText
                    }
                  >
                    “{transcript}”
                  </Text>
                </View>
              ) : null}

              {errorText ? (
                <Text
                  style={
                    styles.errorText
                  }
                >
                  {errorText}
                </Text>
              ) : null}
            </View>

            <View
              style={
                styles.examplesSection
              }
            >
              <Text
                style={
                  styles.examplesTitle
                }
              >
                Try saying
              </Text>

              {[
                [
                  'Add 2 kg tomato',
                  'food-apple-outline',
                ],
                [
                  'Add 1 litre milk',
                  'bottle-tonic-outline',
                ],
                [
                  'Add 10 eggs',
                  'egg-outline',
                ],
              ].map(
                ([label, icon]) => (
                  <TouchableOpacity
                    key={
                      label
                    }
                    style={
                      styles.exampleCard
                    }
                    activeOpacity={
                      0.85
                    }
                    onPress={() =>
                      processTranscript(
                        label,
                      )
                    }
                  >
                    <View
                      style={
                        styles.exampleIcon
                      }
                    >
                      <MaterialCommunityIcons
                        name={
                          icon
                        }
                        size={20}
                        color={
                          GREEN
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.exampleTextWrap
                      }
                    >
                      <Text
                        style={
                          styles.exampleText
                        }
                      >
                        “{label}”
                      </Text>

                      <Text
                        style={
                          styles.exampleHint
                        }
                      >
                        Product + quantity
                      </Text>
                    </View>

                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={21}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                ),
              )}
            </View>
          </>
        ) : (
          /* =================================================
             RESULTS STATE
             ================================================= */

          <>
            <View
              style={
                styles.resultTop
              }
            >
              <View
                style={
                  styles.requestBubble
                }
              >
                <View
                  style={
                    styles.requestIcon
                  }
                >
                  <MaterialCommunityIcons
                    name="microphone"
                    size={21}
                    color={
                      GREEN
                    }
                  />
                </View>

                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={
                      styles.requestLabel
                    }
                  >
                    YOUR REQUEST
                  </Text>

                  <Text
                    style={
                      styles.requestText
                    }
                  >
                    “{transcript}”
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.foundRow
                }
              >
                <View
                  style={
                    styles.foundCheck
                  }
                >
                  <MaterialCommunityIcons
                    name="check"
                    size={14}
                    color="#fff"
                  />
                </View>

                <Text
                  style={
                    styles.foundText
                  }
                >
                  Found{' '}
                  {results.length}{' '}
                  matching products
                </Text>
              </View>

              <Text
                style={
                  styles.foundSub
                }
              >
                Review products and update quantity if needed.
              </Text>
            </View>

            {/* LOCAL */}

            {localShops.length >
            0 ? (
              <View
                style={
                  styles.section
                }
              >
                <View
                  style={
                    styles.sectionHeader
                  }
                >
                  <View
                    style={
                      styles.sectionTitleRow
                    }
                  >
                    <View
                      style={
                        styles.sectionIconLocal
                      }
                    >
                      <MaterialCommunityIcons
                        name="map-marker"
                        size={18}
                        color="#ef684e"
                      />
                    </View>

                    <View>
                      <Text
                        style={
                          styles.sectionTitle
                        }
                      >
                        Local Shops
                      </Text>

                      <Text
                        style={
                          styles.sectionMeta
                        }
                      >
                        Nearby stores
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={
                      styles.seeAll
                    }
                  >
                    {localShops.length}{' '}
                    shops
                  </Text>
                </View>

                {localShops.map(
                  renderShop,
                )}
              </View>
            ) : null}

            {/* GLOBAL */}

            {globalShops.length >
            0 ? (
              <View
                style={
                  styles.section
                }
              >
                <View
                  style={
                    styles.sectionHeader
                  }
                >
                  <View
                    style={
                      styles.sectionTitleRow
                    }
                  >
                    <View
                      style={
                        styles.sectionIconGlobal
                      }
                    >
                      <MaterialCommunityIcons
                        name="earth"
                        size={18}
                        color="#2588e8"
                      />
                    </View>

                    <View>
                      <Text
                        style={
                          styles.sectionTitle
                        }
                      >
                        Global Shops
                      </Text>

                      <Text
                        style={
                          styles.sectionMeta
                        }
                      >
                        Delivery available
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={
                      styles.seeAll
                    }
                  >
                    {globalShops.length}{' '}
                    shops
                  </Text>
                </View>

                {globalShops.map(
                  renderShop,
                )}
              </View>
            ) : null}

            {errorText ? (
              <Text
                style={
                  styles.errorText
                }
              >
                {errorText}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* =================================================
          CHECKOUT BAR
          ================================================= */}

      {results.length >
      0 ? (
        <View
          style={[
            styles.checkoutBarWrap,
            {
              paddingBottom:
                Math.max(
                  insets.bottom,
                  10,
                ),
            },
          ]}
        >
          <View
            style={
              styles.checkoutInfo
            }
          >
            <View
              style={
                styles.checkoutCartIcon
              }
            >
              <MaterialCommunityIcons
                name="cart-outline"
                size={24}
                color="#fff"
              />

              <View
                style={
                  styles.checkoutBadge
                }
              >
                <Text
                  style={
                    styles.checkoutBadgeText
                  }
                >
                  {totalSelectedItems}
                </Text>
              </View>
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.checkoutLabel
                }
              >
                {totalSelectedItems}{' '}
                items
              </Text>

              <Text
                style={
                  styles.checkoutAddress
                }
                numberOfLines={1}
              >
                {addressText}
              </Text>
            </View>

            <Text
              style={
                styles.checkoutAmount
              }
            >
              ₹
              {totalSelectedAmount.toFixed(
                0,
              )}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.checkoutButton,
              savingCart &&
                styles.checkoutButtonDisabled,
            ]}
            disabled={
              savingCart
            }
            activeOpacity={
              0.9
            }
            onPress={
              saveAndCheckout
            }
          >
            {savingCart ? (
              <ActivityIndicator
                color="#fff"
              />
            ) : (
              <>
                <Text
                  style={
                    styles.checkoutButtonText
                  }
                >
                  Proceed to Checkout
                </Text>

                <MaterialCommunityIcons
                  name="arrow-right"
                  size={22}
                  color="#fff"
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

/* =========================================================
   STYLES
   ========================================================= */

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: BG,
    },

    safeArea: {
      backgroundColor: WHITE,
    },

    header: {
      height: 68,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      paddingHorizontal: 18,
      backgroundColor:
        WHITE,
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        WHITE,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        BORDER,
    },

    headerCenter: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    aiMiniIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor:
        '#dff7e8',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 8,
    },

    headerTitle: {
      color: TEXT,
      fontSize: 15,
      fontWeight:
        '800',
    },

    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor:
        GREEN,
    },

    scroll: {
      flex: 1,
    },

    content: {
      paddingHorizontal: 20,
    },

    topCopy: {
      alignItems:
        'center',
      marginTop: 24,
    },

    title: {
      color: TEXT,
      fontSize: 32,
      lineHeight: 38,
      fontWeight:
        '900',
      textAlign:
        'center',
    },

    subtitle: {
      color: SUB,
      fontSize: 13,
      lineHeight: 20,
      textAlign:
        'center',
      marginTop: 12,
      maxWidth: 340,
    },

    micSection: {
      height: 190,
      alignItems:
        'center',
      justifyContent:
        'center',
      position:
        'relative',
      marginTop: 4,
    },

    outerGlow: {
      position:
        'absolute',
      width: 148,
      height: 148,
      borderRadius: 74,
      backgroundColor:
        '#bdebd0',
    },

    outerRing: {
      position:
        'absolute',
      width: 132,
      height: 132,
      borderRadius: 66,
      borderWidth: 1,
      borderColor:
        '#8ed8ac',
      backgroundColor:
        '#e8f7ee',
    },

    micButton: {
      width: 94,
      height: 94,
      borderRadius: 47,
      backgroundColor:
        GREEN,
      alignItems:
        'center',
      justifyContent:
        'center',
      elevation: 8,
    },

    statusArea: {
      alignItems:
        'center',
      minHeight: 100,
    },

    readyTitle: {
      color: TEXT,
      fontSize: 19,
      fontWeight:
        '800',
    },

    readySubtitle: {
      color: SUB,
      fontSize: 12,
      marginTop: 6,
      textAlign:
        'center',
    },

    listeningTitle: {
      color: GREEN,
      fontSize: 21,
      fontWeight:
        '900',
    },

    listeningSubtitle: {
      color: SUB,
      fontSize: 12,
      marginTop: 4,
    },

    waveform: {
      height: 58,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 6,
      gap: 5,
    },

    waveBar: {
      width: 5,
      borderRadius: 5,
      backgroundColor:
        '#5dcc86',
    },

    transcriptBubble: {
      marginTop: 12,
      backgroundColor:
        '#e9f6ef',
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 10,
      maxWidth:
        width - 48,
    },

    transcriptText: {
      color: '#496158',
      fontSize: 12,
      lineHeight: 18,
      textAlign:
        'center',
    },

    errorText: {
      color: '#c24132',
      fontSize: 12,
      lineHeight: 17,
      textAlign:
        'center',
      marginTop: 12,
      paddingHorizontal: 12,
    },

    examplesSection: {
      marginTop: 16,
    },

    examplesTitle: {
      color: '#82958b',
      fontSize: 11,
      fontWeight:
        '800',
      letterSpacing:
        0.8,
      marginBottom: 8,
    },

    exampleCard: {
      minHeight: 60,
      borderRadius: 16,
      backgroundColor:
        WHITE,
      borderWidth: 1,
      borderColor:
        BORDER,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 12,
      marginBottom: 9,
      elevation: 2,
    },

    exampleIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor:
        '#e5f7ec',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },

    exampleTextWrap: {
      flex: 1,
    },

    exampleText: {
      color: TEXT,
      fontSize: 13,
      fontWeight:
        '700',
    },

    exampleHint: {
      color: SUB,
      fontSize: 9,
      marginTop: 3,
    },

    resultTop: {
      marginTop: 14,
      marginBottom: 12,
    },

    requestBubble: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#e9f6ef',
      borderRadius: 18,
      padding: 12,
    },

    requestIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor:
        WHITE,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    requestLabel: {
      color: '#729085',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing:
        1,
    },

    requestText: {
      color: TEXT,
      fontSize: 14,
      lineHeight: 19,
      fontWeight:
        '700',
      marginTop: 3,
    },

    foundRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginTop: 15,
    },

    foundCheck: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor:
        GREEN,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 7,
    },

    foundText: {
      color: TEXT,
      fontSize: 15,
      fontWeight:
        '800',
    },

    foundSub: {
      color: SUB,
      fontSize: 11,
      marginTop: 3,
      marginLeft: 29,
    },

    section: {
      marginTop: 14,
    },

    sectionHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginBottom: 8,
    },

    sectionTitleRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    sectionIconLocal: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor:
        '#fff0eb',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 9,
    },

    sectionIconGlobal: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor:
        '#e9f3ff',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 9,
    },

    sectionTitle: {
      color: TEXT,
      fontSize: 17,
      fontWeight:
        '900',
    },

    sectionMeta: {
      color: SUB,
      fontSize: 10,
      marginTop: 2,
    },

    seeAll: {
      color: '#1d73d5',
      fontSize: 11,
      fontWeight:
        '700',
    },

    shopCard: {
      backgroundColor:
        WHITE,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        BORDER,
      marginBottom: 12,
      overflow: 'hidden',
      elevation: 2,
    },

    shopHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      padding: 12,
    },

    shopIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor:
        '#e7f7ed',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    shopTitleWrap: {
      flex: 1,
    },

    shopName: {
      color: TEXT,
      fontSize: 15,
      fontWeight:
        '900',
    },

    shopBadge: {
      alignSelf:
        'flex-start',
      backgroundColor:
        '#dff5e8',
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
      marginTop: 4,
    },

    shopBadgeText: {
      color: GREEN,
      fontSize: 8,
      fontWeight:
        '900',
      letterSpacing:
        0.3,
    },

    divider: {
      height: 1,
      backgroundColor:
        '#edf3ef',
    },

    productRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 10,
      paddingVertical: 10,
    },

    productImage: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor:
        '#f1f5f2',
      marginRight: 9,
    },

    productInfo: {
      flex: 1,
      minWidth: 0,
    },

    productName: {
      color: TEXT,
      fontSize: 13,
      fontWeight:
        '800',
    },

    productPrice: {
      color: SUB,
      fontSize: 10,
      marginTop: 3,
    },

    qtyControl: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#f1faf5',
      borderRadius: 12,
      padding: 3,
      marginLeft: 7,
    },

    qtyButton: {
      width: 30,
      height: 30,
      borderRadius: 9,
      backgroundColor:
        '#e0f5e9',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    qtyButtonDisabled: {
      backgroundColor:
        '#eef3f0',
    },

    qtyText: {
      minWidth: 25,
      textAlign:
        'center',
      color: TEXT,
      fontSize: 13,
      fontWeight:
        '900',
    },

    shopSubtotal: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      backgroundColor:
        '#eaf8f0',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },

    subtotalLabel: {
      color: '#23643f',
      fontSize: 11,
      fontWeight:
        '800',
    },

    subtotalValue: {
      color: '#175f38',
      fontSize: 14,
      fontWeight:
        '900',
    },

    checkoutBarWrap: {
      position:
        'absolute',
      left: 12,
      right: 12,
      bottom: 8,
      backgroundColor:
        WHITE,
      borderRadius: 20,
      padding: 9,
      elevation: 12,
    },

    checkoutInfo: {
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 5,
      paddingBottom: 8,
    },

    checkoutCartIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor:
        GREEN,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 9,
      position:
        'relative',
    },

    checkoutBadge: {
      position:
        'absolute',
      top: -5,
      right: -5,
      minWidth: 17,
      height: 17,
      borderRadius: 9,
      backgroundColor:
        '#ef684e',
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 3,
    },

    checkoutBadgeText: {
      color: WHITE,
      fontSize: 8,
      fontWeight:
        '900',
    },

    checkoutLabel: {
      color: TEXT,
      fontSize: 12,
      fontWeight:
        '900',
    },

    checkoutAddress: {
      color: SUB,
      fontSize: 9,
      marginTop: 2,
    },

    checkoutAmount: {
      color: TEXT,
      fontSize: 18,
      fontWeight:
        '900',
      marginLeft: 8,
    },

    checkoutButton: {
      height: 54,
      borderRadius: 16,
      backgroundColor:
        GREEN,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 16,
    },

    checkoutButtonDisabled: {
      opacity: 0.7,
    },

    checkoutButtonText: {
      color: WHITE,
      fontSize: 15,
      fontWeight:
        '900',
      marginRight: 8,
    },
  });