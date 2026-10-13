import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { AuthContext } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

export default function ShopDashboard() {
  const { logout, user } = useContext(AuthContext);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Shop Header */}
      <View style={styles.shopHeader}>
        <Text style={styles.shopName}>{user?.name || 'My Premium Shop'}</Text>
        <Text style={styles.shopStatus}>🟢 Open & Accepting Orders</Text>
      </View>

      {/* Analytics Cards */}
      <View style={styles.row}>
        <View style={[styles.card, { backgroundColor: '#4a00e0' }]}>
          <Text style={styles.cardLabel}>Today's Sales</Text>
          <Text style={styles.cardValue}>₹8,450</Text>
        </View>
        <View style={[styles.card, { backgroundColor: '#00b894' }]}>
          <Text style={styles.cardLabel}>Active Orders</Text>
          <Text style={styles.cardValue}>12 New</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Store Management</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => alert('Add Product Screen')}>
          <Text style={styles.actionIcon}>🛍️</Text>
          <Text style={styles.actionText}>Add Product</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => alert('Inventory')}>
          <Text style={styles.actionIcon}>📦</Text>
          <Text style={styles.actionText}>Manage Stock</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => alert('Offers')}>
          <Text style={styles.actionIcon}>🏷️</Text>
          <Text style={styles.actionText}>Create Coupon</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Orders List */}
      <Text style={styles.sectionTitle}>Recent Live Orders</Text>
      <View style={styles.orderListItem}>
        <View>
          <Text style={styles.orderId}>Order #9824 - Rajesh Kumar</Text>
          <Text style={styles.orderItems}>1x Wireless Mouse, 2x USB Cable</Text>
        </View>
        <TouchableOpacity style={styles.acceptBtn} onPress={() => alert('Order Packed!')}>
          <Text style={styles.acceptBtnText}>Pack</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Logout Store Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 15 },
  shopHeader: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 15, elevation: 2 },
  shopName: { fontSize: 22, fontWeight: 'bold', color: '#2d3436' },
  shopStatus: { color: '#2ed573', fontWeight: '600', marginTop: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  card: { width: width * 0.43, padding: 20, borderRadius: 12, elevation: 3 },
  cardLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  cardValue: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', marginVertical: 10 },
  actionGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionBtn: { backgroundColor: '#fff', width: width * 0.28, padding: 15, borderRadius: 10, alignItems: 'center', elevation: 2 },
  actionIcon: { fontSize: 24, marginBottom: 5 },
  actionText: { fontSize: 12, fontWeight: '600', color: '#555' },
  orderListItem: { backgroundColor: '#fff', padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, elevation: 1 },
  orderId: { fontWeight: 'bold', color: '#333' },
  orderItems: { color: '#777', fontSize: 12, marginTop: 3 },
  acceptBtn: { backgroundColor: '#ff9900', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 5 },
  acceptBtnText: { color: '#fff', fontWeight: 'bold' },
  logoutBtn: { backgroundColor: '#ff4757', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 40 },
  logoutText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});