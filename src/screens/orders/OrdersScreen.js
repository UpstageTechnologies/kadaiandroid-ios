import React, { useEffect, useState, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  StatusBar,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection,
  getFirestore,
  onSnapshot,
} from '@react-native-firebase/firestore';
import AppHeader from '../../components/layout/AppHeader';

import { AuthContext } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { EmptyState, StatusBadge } from '../../components/ui';
import { colors, radius, shadow, spacing, type } from '../../theme/tokens';

export default function OrdersScreen({ navigation }) {
  const db = getFirestore();
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMode, setCurrentMode] = useState('local');
useEffect(() => {
  let unsubscribe = null;
  let isMounted = true;

  const loadCustomerOrders = async () => {
    if (!user) {
      if (isMounted) setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const ordersRef = collection(db, 'customers', user.uid, 'orders');

      unsubscribe = onSnapshot(
        ordersRef,
        snapshot => {
          if (!isMounted) return;

          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Latest orders first
          data.sort((a, b) => {
            const dateA = a.createdAt
              ? new Date(a.createdAt).getTime()
              : 0;

            const dateB = b.createdAt
              ? new Date(b.createdAt).getTime()
              : 0;

            return dateB - dateA;
          });

          setOrders(data);
          setLoading(false);

          console.log('CUSTOMER ORDERS:', data);
        },
        error => {
          console.log('Customer orders fetch error:', error);
          setLoading(false);
        }
      );
    } catch (error) {
      console.log('Customer orders error:', error);
      if (isMounted) setLoading(false);
    }
  };

  loadCustomerOrders();

  return () => {
    isMounted = false;

    if (unsubscribe) {
      unsubscribe();
    }
  };
}, [db, user]);
  const getStatusColor = status => {
    switch (status) {
      case 'Delivered': return '#16a34a';
      case 'Out For Delivery': return '#2563eb';
      case 'Packed': return '#9333ea';
      case 'Accepted': return '#007185';
      case 'Rejected': return '#ef4444';
      default: return '#ff9900';
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#ffd814" />
        <Text style={{ marginTop: 12, fontWeight: '600', color: '#555' }}>Loading Orders Summary...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
      <AppHeader
  title="My Orders"
  navigation={navigation}
  showBack={true}
/>
        {orders.length === 0 ? (
          <EmptyState title={`No ${currentMode.toUpperCase()} orders yet`} description="Orders you place will appear here with their latest status." action="Start shopping" onPress={() => navigation.navigate('CustomerHome')} />
        ) : (
          <FlatList
            data={orders}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.orderCard}
              onPress={() =>
  navigation.navigate('TrackOrderScreen', {
    orderId: item.orderId,
    appMode: item.appMode
  })
}
                activeOpacity={0.85}
              >
                <View style={styles.row}>
                  <Text style={styles.orderId}>ID: {item.orderId}</Text>
                  <StatusBadge status={item.status} />
                </View>

                <Text style={styles.date}>
                  Ordered on: {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                </Text>

                {item.orderedShops && item.orderedShops.map((shop, shopIdx) => (
                  <View key={shopIdx} style={styles.shopSection}>
                    <View style={styles.shopHeaderRow}>
                      <View style={styles.shopTitle}><Icon name="storefront-outline" size={16} color={colors.brand} /><Text style={styles.shopNameTxt}>{shop.shopName}</Text></View>
                      <Text style={styles.shopSubtotalTxt}>
                        Subtotal: ₹{Number(shop.subTotal || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>

                    {shop.items && shop.items.map((product, prodIdx) => (
                      <View key={prodIdx} style={styles.productRow}>
                        <Image 
                          source={{ uri: product.img || 'https://via.placeholder.com/60' }} 
                          style={styles.productImage} 
                        />
                        <View style={styles.productDetails}>
                          <Text style={styles.productName} numberOfLines={1}>
                            {product.itemName}
                          </Text>
                          <Text style={styles.itemNoText}>Code: {product.itemNo}</Text>
                          <Text style={styles.qtyText}>
                            Qty: {product.qty} × ₹{Number(product.price || 0).toLocaleString('en-IN')}
                          </Text>
                        </View>
                        
                        <Text style={styles.itemTotal}>
                          ₹{Number((product.price || 0) * (product.qty || 1)).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}

                <View style={styles.divider} />

                <View style={styles.priceRow}>
                  <Text style={styles.grandTotalLabel}>Grand Total Amount:</Text>
                  <Text style={styles.amount}>
                    ₹{Number(item.totalAmount || item.total || 0).toLocaleString('en-IN')}
                  </Text>
                </View>

                <View style={styles.trackRow}><Text style={styles.track}>Track order</Text><Icon name="arrow-right" size={16} color={colors.brand} /></View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.dark }, container: { flex: 1, backgroundColor: colors.canvas }, loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas },
  orderCard: { 
    backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.md, ...shadow.card
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { ...type.cardTitle, color: colors.ink },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontWeight: '700', fontSize: 11 },
  date: { color: colors.muted, marginTop: 5, ...type.caption },
  shopSection: { 
    backgroundColor: colors.canvas, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border
  },
  shopHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderBottomWidth: 1, 
    borderColor: colors.border,
    paddingBottom: 8, 
    marginBottom: 8 
  },
  shopTitle: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }, shopNameTxt: { ...type.label, color: colors.ink, marginLeft: 6, flex: 1 }, shopSubtotalTxt: { ...type.label, color: colors.brand, backgroundColor: colors.brandSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  productRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  productImage: { width: 55, height: 55, borderRadius: radius.sm, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  productDetails: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  productName: { ...type.label, color: colors.ink }, itemNoText: { ...type.caption, color: colors.subtle, marginTop: 1 }, qtyText: { ...type.caption, color: colors.muted, marginTop: 2 }, itemTotal: { ...type.label, color: colors.ink, marginLeft: 10 }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grandTotalLabel: { ...type.cardTitle, color: colors.ink }, amount: { ...type.title, color: colors.brand }, trackRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 12 }, track: { color: colors.brand, fontWeight: '600', fontSize: 12, marginRight: 4 },
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIcon: { fontSize: 50, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  emptySub: { color: '#6b7280', marginTop: 6, textAlign: 'center', fontSize: 14, marginBottom: 20 },
  shopBtn: { backgroundColor: '#ff9900', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, elevation: 1 },
  shopBtnTxt: { color: '#111', fontWeight: 'bold', fontSize: 14 }
});
