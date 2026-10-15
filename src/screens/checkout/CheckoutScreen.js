import React, { useState, useContext, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../../context/AuthContext';
import {
  deleteDoc,
  doc,
  getFirestore,
  setDoc,
} from '@react-native-firebase/firestore';
import AppHeader from '../../components/layout/AppHeader';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PrimaryButton, SectionHeader } from '../../components/ui';
import { colors, radius, shadow, spacing, type } from '../../theme/tokens';

export default function CheckoutScreen({ route, navigation }) {
  const db = getFirestore();
  const { user, customerData, clearCart } = useContext(AuthContext);
  
  const { amount, cartItems } = route.params || { amount: 0, cartItems: {} };
  const defaultAddress =
    customerData?.address?.googleFormattedAddress ||
    customerData?.address?.formatted_address ||
    '';
  const [address, setAddress] = useState(defaultAddress);
  const [phone, setPhone] = useState(customerData?.mobile || '9876543210');
  const [orderLoading, setOrderLoading] = useState(false);
  const [isOrderSuccess, setIsOrderSuccess] = useState(false);

  // 💡 ஆர்டர் வெற்றியடைந்த பிறகு மொபைல் பேக் பட்டன் அழுத்தினால் முந்தைய பக்கங்களுக்குப் போவதைத் தடுக்கிறது
  useEffect(() => {
    const backAction = () => { 
      if (isOrderSuccess) { 
        navigation.reset({
          index: 0,
          routes: [{ name: 'CustomerHome' }],
        });
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [isOrderSuccess]);

const handlePlaceOrder = async () => {
  if (!user?.uid) {
    Alert.alert('Error', 'Please login before placing an order.');
    return;
  }

  if (!address?.trim() || !phone?.trim()) {
    Alert.alert('Error', 'Please fill delivery details');
    return;
  }

  const cartArray = Object.values(cartItems || {});

  if (cartArray.length === 0) {
    Alert.alert('Error', 'Your cart is empty.');
    return;
  }

  setOrderLoading(true);

  try {
    // --------------------------------
    // 1. Generate Order ID
    // --------------------------------
    const rawOrderId = Math.floor(
      100000 + Math.random() * 900000
    );

    const mainOrderId = `KADAI-${rawOrderId}`;
    const timestamp = new Date().toISOString();

    // --------------------------------
    // 2. Group by SHOP + MARKET MODE
    // --------------------------------
    const shopGroups = cartArray.reduce((acc, item) => {
      const sellerId = item.shopId || item.sellerId || 'default_shop';

      const marketType =
        String(
          item.marketType || item.marketMode || item.deliveryScope || 'local',
        ).trim().toLowerCase() === 'global'
          ? 'global'
          : 'local';

      const groupKey = `${sellerId}_${marketType}`;

      if (!acc[groupKey]) {
        acc[groupKey] = {
          shopId: sellerId,
          marketType,
          shopName: item.shopName || 'POS Store',
          items: [],
          shopTotal: 0,
        };
      }

      acc[groupKey].items.push({
        id: item.id,
        itemName: item.name,
        itemNo: item.itemNo,
        price: Number(item.price || 0),
        qty: Number(item.qty || 0),
        img: item.img || '',
        marketType,
      });

      acc[groupKey].shopTotal +=
        Number(item.price || 0) *
        Number(item.qty || 0);

      return acc;
    }, {});

    console.log(
      '🔥 SHOP GROUPS:',
      JSON.stringify(shopGroups, null, 2)
    );
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
const customerOrderRef = doc(db, 'customers', user.uid, 'orders', mainOrderId);
await setDoc(customerOrderRef, {
      orderId: mainOrderId,
      customerUid: user.uid,
      customerName: customerData?.name || 'Smart Customer',
      customerEmail: user.email || '',
      customerPhone: phone,
      deliveryAddress: address,

      totalAmount: Number(amount || 0),

      paymentMethod: 'Cash on Delivery (COD)',

      status: 'Order Placed',

      createdAt: timestamp,

      orderedShops,
    });

    console.log(
      '✅ CUSTOMER ORDER CREATED:',
      mainOrderId
    );

    // --------------------------------
    // 5. Create seller orders
    // --------------------------------
   // --------------------------------
    // 5. Create seller orders
    // --------------------------------
    for (const groupKey of Object.keys(shopGroups)) {

      const currentShop = shopGroups[groupKey];
      const sellerId = currentShop.shopId;
      const isGlobal = currentShop.marketType === 'global';

      const orderCollection = isGlobal ? 'global_orders' : 'local_orders';

      const sellerOrderRef = doc(db, 'users', sellerId, orderCollection, mainOrderId);
      await setDoc(sellerOrderRef, {
        orderId: mainOrderId,
        customerUid: user.uid,
        customerName: customerData?.name || 'Smart Customer',
        customerEmail: user.email || '',
        customerPhone: phone,
        deliveryAddress: address,
        marketType: currentShop.marketType,
        isGlobalMode: isGlobal, // 👈 Intha flag-ah add pannikonga
        deliveryScope: isGlobal ? 'global' : 'local', // 👈 Shop app match panrathukaaga
        status: 'Pending Verification',
        createdAt: timestamp,
        total: currentShop.shopTotal,
        items: currentShop.items,
      });

      console.log(
        `✅ SELLER ORDER CREATED: users/${sellerId}/${orderCollection}/${mainOrderId}`
      );
    }

   const cartRef = doc(db, 'customers', user.uid, 'cart', 'mainCart');

await deleteDoc(cartRef);

    // --------------------------------
    // 7. Success
    // --------------------------------
    setOrderLoading(false);
    setIsOrderSuccess(true);

    Alert.alert(
      '🎉 Order Successful!',
      'Your multi-store orders have been successfully placed.',
      [
        {
          text: 'Track Live Status ➔',
          onPress: () => {
            navigation.reset({
              index: 1,
              routes: [
                { name: 'CustomerHome' },
                {
                  name: 'TrackOrderScreen',
                  params: {
                    orderId: mainOrderId,
                  },
                },
              ],
            });
          },
        },
      ],
      { cancelable: false }
    );

  } catch (error) {

    setOrderLoading(false);

    console.log(
      '❌ ORDER PROCESSING ERROR =',
      error
    );

    console.log(
      '❌ ERROR CODE =',
      error?.code
    );

    console.log(
      '❌ ERROR MESSAGE =',
      error?.message
    );

    Alert.alert(
      'Order Failed',
      `${error?.code || 'unknown-error'}\n\n${
        error?.message ||
        'Something went wrong while syncing with cloud database.'
      }`
    );
  }
};

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ✅ பிக்ஸ் செய்யப்பட்ட புதிய பிரீமியம் ஹெடர் பார் */}
        <AppHeader
          title="Delivery & Payment"
          navigation={navigation}
          showBack={true}
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Shipping Input Fields */}
          <View style={styles.section}>
            <SectionHeader title="Delivery details" />
            <TextInput 
              style={styles.input} 
              value={address} 
              onChangeText={setAddress} 
              placeholder="Enter Full Delivery Address"
              multiline
              placeholderTextColor="#999"
            />
            <TextInput 
              style={[styles.input, { height: 50 }]} 
              value={phone} 
              onChangeText={setPhone} 
              placeholder="Active Phone Number"
              keyboardType="phone-pad"
              placeholderTextColor="#999"
            />
          </View>

          {/* Payment Selection */}
          <View style={styles.section}>
            <SectionHeader title="Payment method" />
            <View style={styles.codBox}>
              <View style={styles.paymentIcon}><Icon name="cash" size={21} color={colors.brand} /></View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.codTitle}>Cash on Delivery (COD)</Text>
                <Text style={styles.codSub}>Pay securely with cash upon receiving delivery.</Text>
              </View>
              <View style={styles.iosRadioActive}>
                <View style={styles.iosRadioInnerDot} />
              </View>
            </View>
          </View>

          {/* Final Total Summary */}
          <View style={styles.summaryBox}>
            <SectionHeader title="Order summary" />
            <View style={styles.row}>
              <Text style={styles.label}>Items Subtotal:</Text>
              <Text style={styles.val}>₹{amount.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Delivery Service:</Text>
              <Text style={[styles.val, { color: '#2d9c04', fontWeight: '700' }]}>FREE</Text>
            </View>
            <View style={[styles.row, { borderTopWidth: 1, borderColor: '#eee', paddingTop: 12, marginTop: 10 }]}>
              <Text style={styles.totalLabel}>Gross Payable Total:</Text>
              <Text style={styles.totalVal}>₹{amount.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          <PrimaryButton title="Place order" icon="arrow-right" onPress={handlePlaceOrder} loading={orderLoading} style={styles.placeOrderBtn} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.dark },
  container: { flex: 1, backgroundColor: colors.canvas },
  section: { 
    backgroundColor: colors.surface, padding: spacing.lg, marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: radius.lg, ...shadow.card
  },
  sectionTitle: { ...type.cardTitle, color: colors.ink, marginBottom: 12 },
  input: { 
    borderWidth: 1, 
    borderColor: colors.border, borderRadius: radius.md, padding: 12, backgroundColor: colors.canvas, color: colors.ink,
    marginBottom: 12, 
    textAlignVertical: 'top',
    fontSize: 14
  },
  codBox: { 
    flexDirection: 'row', 
    backgroundColor: colors.brandSoft, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brand,
    alignItems: 'center' 
  },
  paymentIcon: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  codTitle: { ...type.cardTitle, color: colors.ink }, codSub: { ...type.label, fontWeight: '400', color: colors.muted, marginTop: 2 },
  iosRadioActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    borderColor: colors.brand,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  iosRadioInnerDot: {
    width: 8.5,
    height: 8.5,
    borderRadius: 4.25,
    backgroundColor: '#FFFFFF',
  },
  summaryBox: { 
    backgroundColor: colors.surface, padding: spacing.lg, marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: radius.lg, ...shadow.card
  },
  summaryTitle: { ...type.cardTitle, color: colors.ink, marginBottom: 12 }, row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 }, label: { ...type.body, color: colors.muted }, val: { ...type.body, fontWeight: '600', color: colors.ink }, totalLabel: { ...type.cardTitle, color: colors.ink }, totalVal: { ...type.title, color: colors.brand }, placeOrderBtn: { marginHorizontal: spacing.md, marginTop: spacing.xl, marginBottom: spacing.xxl }
});
