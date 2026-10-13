import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../../context/AuthContext';
import AppHeader from '../../components/layout/AppHeader';
import {
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
} from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { EmptyState, PrimaryButton } from '../../components/ui';
import { colors, radius, shadow, spacing, type } from '../../theme/tokens';

export default function CartScreen({ route, navigation }) {
  const db = getFirestore();
  const { user } = useContext(AuthContext); 
  const [cartItems, setCartItems] = useState({});
  const [screenLoading, setScreenLoading] = useState(true);

  // 🔄 Fixed Live Firestore Listener: Clears state properly when document is deleted
  useEffect(() => {
    if (!user) {
      setScreenLoading(false);
      return;
    }
   const cartDocRef = doc(db, 'customers', user.uid, 'cart', 'mainCart');

const unsubscribe = onSnapshot(
  cartDocRef,
  (snapshot) => {
    if (snapshot.exists()) {
      setCartItems(snapshot.data()?.items || {});
    } else {
      setCartItems({});
    }

    setScreenLoading(false);
  },
  (error) => {
    console.error('Firestore Cart Fetch Error:', error);
    console.error('CODE:', error?.code);
    console.error('MESSAGE:', error?.message);
    setScreenLoading(false);
  }
);

    return () => unsubscribe();
  }, [user, db]);

  const syncCartToFirestore = async (updatedItems) => {
    if (!user) return;
   const cartDocRef = doc(db, 'customers', user.uid, 'cart', 'mainCart');

try {
  if (Object.keys(updatedItems).length === 0) {
    await deleteDoc(cartDocRef);
  } else {
    await setDoc(cartDocRef, {
        items: updatedItems,
        updatedAt: new Date().toISOString(),
      });
  }
}
    catch (error) {
      console.error("Firestore Cart Sync Error:", error);
    }
  };

  const updateQty = async (id, type) => {
    // 🛠️ Fixed local data reference cloning mutation bug
    const updated = JSON.parse(JSON.stringify(cartItems)); 
    if (!updated[id]) return;

    if (type === 'add') {
      updated[id].qty += 1;
    } else {
      updated[id].qty -= 1;
      if (updated[id].qty <= 0) {
        delete updated[id];
      }
    }
    setCartItems(updated);
    await syncCartToFirestore(updated);
  };

  const cartArray = Object.values(cartItems);
  const groupedByShop = cartArray.reduce((groups, item) => {
    const shop = item.shopName || 'Unknown Shop';
    if (!groups[shop]) groups[shop] = [];
    groups[shop].push(item);
    return groups;
  }, {});

  const grandTotal = cartArray.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleProceed = () => {
    if (user) {
      navigation.navigate('CheckoutScreen', { amount: grandTotal, cartItems: cartItems });
    } else {
      alert("🔒 Please login or register to complete your order!");
      navigation.navigate('Login');
    }
  };

  if (screenLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#ffd814" />
        <Text style={styles.loaderTxt}>Loading your basket...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        <AppHeader title="Review Your Basket" navigation={navigation} showBack={true} />
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {cartArray.length === 0 ? (
            <EmptyState icon="cart-outline" title="Your cart is empty" description="Browse nearby stores and add products when you're ready." action="Start shopping" onPress={() => navigation.navigate('CustomerHome')} />
          ) : (
            Object.keys(groupedByShop).map((shopName) => {
              const shopItems = groupedByShop[shopName];
              const shopSubtotal = shopItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
              return (
                <View key={shopName} style={styles.shopSection}>
                  <View style={styles.shopHeaderRow}>
                    <View style={styles.shopIdentity}><Icon name="storefront-outline" size={17} color={colors.brand} /><Text style={styles.shopNameTxt}>{shopName}</Text></View>
                    <Text style={styles.shopSubtotalTxt}>Subtotal: ₹{shopSubtotal.toLocaleString('en-IN')}</Text>
                  </View>
                  {shopItems.map((item) => (
                    <View key={item.id} style={styles.cartCard}>
                      <Image source={{ uri: item.img }} style={styles.prodImg} />
                      <View style={styles.details}>
                        <Text style={styles.prodName} numberOfLines={2}>{item.name}</Text>
                        <Text style={styles.prodPrice}>₹{item.price.toLocaleString('en-IN')} x {item.qty}</Text>
                        <Text style={styles.totalItemPrice}>₹{(item.price * item.qty).toLocaleString('en-IN')}</Text>
                        <View style={styles.qtyRow}>
                          <TouchableOpacity accessibilityLabel="Reduce quantity" style={styles.qtyBtn} onPress={() => updateQty(item.id, 'sub')}>
                            <Icon name="minus" size={16} color={colors.ink} />
                          </TouchableOpacity>
                          <Text style={styles.qtyTxt}>{item.qty}</Text>
                          <TouchableOpacity accessibilityLabel="Increase quantity" style={styles.qtyBtn} onPress={() => updateQty(item.id, 'add')}>
                            <Icon name="plus" size={16} color={colors.ink} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })
          )}
        </ScrollView>

        {cartArray.length > 0 && (
          <View style={styles.billBox}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Total Shops:</Text>
              <Text style={styles.billValue}>{Object.keys(groupedByShop).length}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Charges:</Text>
              <Text style={[styles.billValue, { color: '#2d9c04', fontWeight: '700' }]}>FREE</Text>
            </View>
            <View style={[styles.billRow, { borderTopWidth: 1, borderColor: '#eee', paddingTop: 10, marginTop: 5 }]}>
              <Text style={styles.totalLabel}>Grand Total Amount:</Text>
              <Text style={styles.totalValue}>₹{grandTotal.toLocaleString('en-IN')}</Text>
            </View>
            <PrimaryButton title="Proceed to checkout" icon="arrow-right" onPress={handleProceed} style={styles.proceedBtn} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.dark }, container: { flex: 1, backgroundColor: colors.canvas }, loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas }, loaderTxt: { marginTop: 10, ...type.body, color: colors.muted },
  shopSection: { backgroundColor: colors.surface, marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: radius.lg, padding: spacing.md, ...shadow.card }, shopHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingBottom: spacing.sm, marginBottom: spacing.sm }, shopIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }, shopNameTxt: { ...type.cardTitle, color: colors.ink, marginLeft: 7, flex: 1 }, shopSubtotalTxt: { ...type.label, color: colors.brand, backgroundColor: colors.brandSoft, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill },
  cartCard: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }, prodImg: { width: 82, height: 82, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }, details: { flex: 1, marginLeft: spacing.md }, prodName: { ...type.cardTitle, color: colors.ink }, prodPrice: { ...type.label, color: colors.muted, marginTop: 3 }, totalItemPrice: { ...type.cardTitle, color: colors.brand, marginTop: 4 }, qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 }, qtyBtn: { backgroundColor: colors.surfaceMuted, width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }, qtyTxt: { marginHorizontal: 14, ...type.cardTitle, color: colors.ink },
  emptyContainer: { flex: 1, minHeight: 400, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyTxt: { color: '#777', fontSize: 15, marginBottom: 15, fontWeight: '500' },
  shopBtn: { backgroundColor: '#ff9900', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 8, elevation: 2 },
  shopBtnTxt: { color: '#111', fontWeight: 'bold', fontSize: 15 },
  billBox: { backgroundColor: colors.surface, padding: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...shadow.floating }, billRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 }, billLabel: { ...type.body, color: colors.muted }, billValue: { ...type.body, fontWeight: '600', color: colors.ink }, totalLabel: { ...type.cardTitle, color: colors.ink }, totalValue: { ...type.title, color: colors.brand }, proceedBtn: { marginTop: spacing.lg }
});
