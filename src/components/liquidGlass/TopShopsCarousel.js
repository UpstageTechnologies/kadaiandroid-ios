import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { TEXTURED_DARK, TEXTURED_LIGHT } from './theme';

export const TopShopsCarousel = ({
  shops = [],
  selectedShop = null,
  onSelectShop,
  language = 'en',
  radiusKm = 3,
  marketMode = 'local',
  isDarkMode = true,
}) => {
  const isTamil = language === 'ta';
  const isGlobal = marketMode === 'global';
  const theme = isDarkMode ? TEXTURED_DARK : TEXTURED_LIGHT;

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithBadge}>
          <Text style={[styles.sectionTitle, { color: theme.textWhite }]}>
            {isGlobal
              ? (isTamil ? 'தொலைதூர கடைகள் & மையங்கள்' : 'Outstation Stores & Depots')
              : (isTamil ? 'அருகிலுள்ள கடைகள்' : 'Nearby Local Stores')}
          </Text>
          <View
            style={[
              styles.modeIndicatorBadge,
              isGlobal && styles.modeIndicatorBadgeGlobal,
              { backgroundColor: isGlobal ? 'rgba(59, 130, 246, 0.15)' : 'rgba(34, 197, 94, 0.15)' },
            ]}
          >
            <Text
              style={[
                styles.modeIndicatorText,
                { color: isGlobal ? '#60A5FA' : theme.neonGreen },
              ]}
            >
              {isGlobal
                ? (radiusKm === 'all' ? 'Pan-India' : `< ${radiusKm} km (Bus)`)
                : `< ${radiusKm} km`}
            </Text>
          </View>
        </View>

        {selectedShop && (
          <TouchableOpacity
            style={[styles.clearShopBtn, { borderColor: theme.neonGreen }]}
            onPress={() => onSelectShop && onSelectShop(null)}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={13} color={theme.neonGreen} />
            <Text style={[styles.clearShopBtnText, { color: theme.neonGreen }]}>
              {isTamil ? 'அனைத்தும்' : 'View All'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
      >
        {/* "All Stores" Card */}
        <TouchableOpacity
          style={[
            styles.allShopsCard,
            {
              backgroundColor: isDarkMode ? '#0F1A12' : '#FFFFFF',
              borderColor: selectedShop === null ? theme.neonGreen : theme.glassBorder,
            },
          ]}
          onPress={() => onSelectShop && onSelectShop(null)}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.allShopsIconCircle,
              {
                backgroundColor:
                  selectedShop === null
                    ? theme.neonGreen
                    : isDarkMode
                    ? 'rgba(255,255,255,0.06)'
                    : '#F1F5F9',
              },
            ]}
          >
            <Ionicons
              name="apps"
              size={22}
              color={selectedShop === null ? '#050906' : (isDarkMode ? '#A7F3D0' : '#475569')}
            />
          </View>
          <Text
            style={[
              styles.allShopsCardTitle,
              {
                color: selectedShop === null ? theme.neonGreen : theme.textWhite,
              },
            ]}
          >
            {isTamil ? 'அனைத்து கடைகள்' : 'All Stores'}
          </Text>
          <Text style={[styles.allShopsCountText, { color: isDarkMode ? '#6EE7B7' : '#64748B' }]}>
            {shops.length} {isTamil ? 'கடைகள்' : 'Stores'}
          </Text>
        </TouchableOpacity>

        {/* Individual Upstage POS Store Cards */}
        {shops.map(shop => {
          const isSelected = selectedShop?.id === shop.id;
          const displayName = shop.shopName || shop.name || 'Store';
          const imageUrl =
            shop.shopImage ||
            shop.profileImage ||
            shop.image ||
            'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=300&q=80';

          return (
            <TouchableOpacity
              key={shop.id}
              style={[
                styles.shopCard,
                {
                  backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                  borderColor: isSelected ? theme.neonGreen : theme.glassBorder,
                },
              ]}
              onPress={() => onSelectShop && onSelectShop(shop)}
              activeOpacity={0.85}
            >
              <View style={styles.imageContainer}>
                <Image source={{ uri: imageUrl }} style={styles.shopImage} />

                {/* Distance Badge */}
                <View style={styles.distanceBadge}>
                  <Ionicons name="navigate" size={10} color="#FFFFFF" />
                  <Text style={styles.distanceText}>
                    {isGlobal ? 'Pan-India' : `${shop.distanceKm || 1.2} km`}
                  </Text>
                </View>

                {/* POS Verified Badge */}
                <View style={styles.verifiedMiniTag}>
                  <Ionicons name="checkmark-circle" size={13} color="#22C55E" />
                </View>
              </View>

              <View style={styles.shopCardBody}>
                <Text
                  style={[styles.shopName, { color: theme.textWhite }]}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Text
                  style={[styles.shopCategory, { color: isDarkMode ? '#A7F3D0' : '#15803D' }]}
                  numberOfLines={1}
                >
                  {shop.address?.area || shop.address?.city || 'Neighborhood Shop'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modeIndicatorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  modeIndicatorBadgeGlobal: {},
  modeIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
  },
  clearShopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  clearShopBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  carouselContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  allShopsCard: {
    width: 105,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allShopsIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  allShopsCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  allShopsCountText: {
    fontSize: 10,
    marginTop: 2,
  },
  shopCard: {
    width: 135,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 72,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  shopImage: {
    width: '100%',
    height: '100%',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  distanceText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  verifiedMiniTag: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    padding: 2,
  },
  shopCardBody: {
    padding: 8,
  },
  shopName: {
    fontSize: 12,
    fontWeight: '700',
  },
  shopCategory: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
});
