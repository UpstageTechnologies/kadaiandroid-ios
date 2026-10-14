import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { TEXTURED_DARK, TEXTURED_LIGHT } from './theme';
import { calculateEffectivePricing } from '../../utils/pricing';

export const ProductCompareModal = ({
  visible = false,
  product = null,
  onClose,
  onAddToCart,
  cart = {},
  language = 'en',
  isDarkMode = true,
  marketMode = 'local',
}) => {
  if (!product) return null;

  const isTamil = language === 'ta';
  const isGlobal = marketMode === 'global';
  const theme = isDarkMode ? TEXTURED_DARK : TEXTURED_LIGHT;

  const pricing = calculateEffectivePricing(product);
  const price = pricing.price;
  const mrp = pricing.originalPrice;
  const savings = pricing.savings;
  const storePrices = product.storePrices || [
    {
      shopId: product.shopId,
      shopName: product.shopName || 'Neighborhood Store',
      price: price,
      inStock: true,
      distanceKm: product.distanceKm || '1.1',
    },
  ];

  const inCartQty = cart[product.id]?.qty || 0;

  const handleAdd = () => {
    if (onAddToCart) onAddToCart(product);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: isDarkMode ? '#080E0A' : '#F8FAFC' },
        ]}
      >
        {/* Header with grab handle & close button */}
        <View style={styles.grabHandleBar}>
          <View style={styles.grabHandle} />
        </View>

        <View style={[styles.header, { borderBottomColor: theme.glassBorder }]}>
          <TouchableOpacity
            style={[
              styles.closeBtn,
              {
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                borderColor: theme.glassBorder,
              },
            ]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={theme.textWhite} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <View
              style={[
                styles.compareBadge,
                {
                  backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7',
                  borderColor: theme.neonGreen,
                },
              ]}
            >
              <Ionicons name="git-compare" size={13} color={theme.neonGreen} />
              <Text style={[styles.compareBadgeText, { color: theme.neonGreen }]}>
                {isTamil ? 'உள்ளூர் விலை ஒப்பீடு' : 'Local Price Compare'}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.radiusChip,
              {
                borderColor: theme.neonGreen,
                backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.12)' : '#DCFCE7',
              },
            ]}
          >
            <Ionicons name="location-outline" size={12} color={theme.neonGreen} />
            <Text style={[styles.radiusChipText, { color: theme.neonGreen }]}>
              {isGlobal ? 'Pan-India' : '< 3 km'}
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Product Hero Banner */}
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                borderColor: theme.glassBorder,
              },
            ]}
          >
            <View style={styles.imageWrap}>
              <Image
                source={{
                  uri:
                    product.img ||
                    product.image ||
                    'https://static.vecteezy.com/system/resources/previews/015/413/291/non_2x/shopping-trolley-full-of-food-fruit-products-grocery-goods-grocery-shopping-cart-buying-food-in-supermarket-illustration-for-banner-vector.jpg',
                }}
                style={styles.productImage}
                resizeMode="contain"
              />
              {savings > 0 && (
                <View style={styles.saveTag}>
                  <Text style={styles.saveTagText}>
                    {isTamil ? `₹${savings} சேமிப்பு` : `Save ₹${savings}`}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.heroDetails}>
              <Text style={[styles.productName, { color: theme.textWhite }]}>
                {product.name}
              </Text>
              <Text
                style={[
                  styles.productCategory,
                  { color: isDarkMode ? '#6EE7B7' : '#15803D' },
                ]}
              >
                {product.category || 'General Store'} {product.unit ? `• ${product.unit}` : ''}
              </Text>

              {/* Price row */}
              <View style={styles.priceRow}>
                <Text style={[styles.lowestPrice, { color: theme.neonGreen }]}>
                  ₹{price}
                </Text>
                {mrp > price && (
                  <Text style={styles.mrpPrice}>₹{mrp}</Text>
                )}
                <View style={styles.lowestPriceBadge}>
                  <Text style={styles.lowestPriceBadgeText}>
                    {isTamil ? 'சிறந்த விலை' : 'Best Local Price'}
                  </Text>
                </View>
              </View>

              {/* Add to Cart CTA */}
              <TouchableOpacity
                style={[
                  styles.primaryAddBtn,
                  { backgroundColor: theme.neonGreen },
                ]}
                onPress={handleAdd}
                activeOpacity={0.85}
              >
                <Ionicons name="cart" size={17} color="#050906" />
                <Text style={styles.primaryAddBtnText}>
                  {inCartQty > 0
                    ? `${isTamil ? 'கார்ட்டில் சேர்க்கப்பட்டது' : 'In Cart'} (${inCartQty})`
                    : isTamil ? 'கார்ட்டில் சேர்' : 'Add to Cart'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Store Availability Section */}
          <Text style={[styles.sectionHeading, { color: theme.textWhite }]}>
            {isTamil ? 'கிடைக்கும் உள்ளூர் கடைகள்' : 'Available at Local Shops'}
          </Text>

          {storePrices.map((sp, idx) => (
            <View
              key={sp.shopId || idx}
              style={[
                styles.storeRowCard,
                {
                  backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <View style={styles.storeRowLeft}>
                <Text style={[styles.storeRowName, { color: theme.textWhite }]}>
                  {sp.shopName}
                </Text>
                <View style={styles.storeSubRow}>
                  <Ionicons name="navigate-outline" size={11} color={theme.neonGreen} />
                  <Text style={[styles.storeRowDist, { color: isDarkMode ? '#A7F3D0' : '#64748B' }]}>
                    {sp.distanceKm || '1.1'} km away
                  </Text>
                  <Text style={styles.stockBadge}>
                    {sp.inStock !== false ? '• In Stock' : '• Low Stock'}
                  </Text>
                </View>
              </View>

              <View style={styles.storeRowRight}>
                <Text style={[styles.storeRowPrice, { color: theme.neonGreen }]}>
                  ₹{sp.price}
                </Text>
                <TouchableOpacity
                  style={[styles.miniAddBtn, { backgroundColor: theme.neonGreen }]}
                  onPress={handleAdd}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color="#050906" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  grabHandleBar: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  compareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  compareBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  radiusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  radiusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 20,
  },
  imageWrap: {
    height: 180,
    width: '100%',
    backgroundColor: '#0F172A',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    width: '80%',
    height: '80%',
  },
  saveTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  saveTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  heroDetails: {
    padding: 14,
  },
  productName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  lowestPrice: {
    fontSize: 22,
    fontWeight: '900',
  },
  mrpPrice: {
    fontSize: 14,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  lowestPriceBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lowestPriceBadgeText: {
    color: '#22C55E',
    fontSize: 10,
    fontWeight: '700',
  },
  primaryAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryAddBtnText: {
    color: '#050906',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  storeRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  storeRowLeft: {
    flex: 1,
  },
  storeRowName: {
    fontSize: 14,
    fontWeight: '700',
  },
  storeSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  storeRowDist: {
    fontSize: 11,
  },
  stockBadge: {
    fontSize: 11,
    color: '#22C55E',
    fontWeight: '600',
  },
  storeRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  storeRowPrice: {
    fontSize: 16,
    fontWeight: '800',
  },
  miniAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
