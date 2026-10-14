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

export const DEFAULT_FALLBACK_STORES = [];

export const DEFAULT_RAIL_CATEGORIES = [
  {
    id: 'groceries',
    name: 'Rice, Maligai & Staples',
    nameTa: 'மளிகை & அரிசி',
    shortName: 'Groceries',
    icon: 'nutrition-outline',
    keywords: ['grocery', 'groceries', 'maligai', 'staples', 'rice', 'dal', 'toor dal', 'wheat', 'atta', 'flour', 'arisi', 'paruppu'],
  },
  {
    id: 'fruits',
    name: 'Fresh Veggies & Fruits',
    nameTa: 'காய்கறிகள் & பழங்கள்',
    shortName: 'Veggies & Fruits',
    icon: 'leaf-outline',
    keywords: ['fruit', 'fruits', 'veggie', 'veggies', 'vegetables', 'strawberry', 'persimmon', 'onion', 'tomato', 'potato', 'keerai', 'greens'],
  },
  {
    id: 'dairy',
    name: 'Dairy, Milk & Ghee',
    nameTa: 'பால் & பால் பொருட்கள்',
    shortName: 'Dairy & Milk',
    icon: 'water-outline',
    keywords: ['dairy', 'milk', 'curd', 'butter', 'paneer', 'cheese', 'ghee', 'paal', 'thayir'],
  },
  {
    id: 'oils',
    name: 'Cooking Oils & Ghee',
    nameTa: 'சமையல் எண்ணெய் & நெய்',
    shortName: 'Cooking Oils',
    icon: 'color-fill-outline',
    keywords: ['oil', 'oils', 'ghee', 'sunflower', 'gingelly', 'groundnut', 'ennai', 'deepam'],
  },
  {
    id: 'spices',
    name: 'Spices, Masalas & Powders',
    nameTa: 'மசாலா & பொடிகள்',
    shortName: 'Spices & Masalas',
    icon: 'flame-outline',
    keywords: ['spice', 'spices', 'masala', 'masalas', 'powder', 'chilli', 'turmeric', 'pepper', 'coriander', 'podigal', 'sambhar'],
  },
  {
    id: 'snacks',
    name: 'Snacks, Biscuits & Sweets',
    nameTa: 'சிற்றுண்டி & பிஸ்கட்',
    shortName: 'Snacks & Biscuits',
    icon: 'fast-food-outline',
    keywords: ['snack', 'snacks', 'biscuit', 'biscuits', 'cookies', 'chips', 'murukku', 'mixture', 'sweets', 'chocolate'],
  },
  {
    id: 'beverages',
    name: 'Beverages, Tea & Coffee',
    nameTa: 'குளிர்பானங்கள் & டீ, காபி',
    shortName: 'Beverages',
    icon: 'cafe-outline',
    keywords: ['beverage', 'beverages', 'tea', 'coffee', 'juice', 'soda', 'cool drinks', 'drink', 'horlicks', 'boost'],
  },
  {
    id: 'pooja',
    name: 'Pooja Divine Essentials',
    nameTa: 'பூஜை பொருட்கள்',
    shortName: 'Pooja Items',
    icon: 'sparkles-outline',
    keywords: ['pooja', 'puja', 'camphor', 'agarbathi', 'incense', 'oil', 'sambrani', 'divine', 'vilakku'],
  },
  {
    id: 'cleaning',
    name: 'Household & Cleaning',
    nameTa: 'வீட்டு உபயோக பொருட்கள்',
    shortName: 'Cleaning & Home',
    icon: 'home-outline',
    keywords: ['cleaning', 'household', 'detergent', 'soap', 'dishwash', 'cleaner', 'surf', 'rin', 'broom', 'mop'],
  },
  {
    id: 'personal_care',
    name: 'Personal Care & Hygiene',
    nameTa: 'தனிநபர் பராமரிப்பு',
    shortName: 'Personal Care',
    icon: 'heart-outline',
    keywords: ['personal', 'care', 'hygiene', 'soap', 'shampoo', 'toothpaste', 'brush', 'lotion', 'hair', 'face'],
  },
  {
    id: 'hardware',
    name: 'Hardware & Electricals',
    nameTa: 'ஹார்டுவேர் & டூல்ஸ்',
    shortName: 'Hardware & Tools',
    icon: 'hammer-outline',
    keywords: ['hardware', 'electrical', 'tools', 'bulb', 'wire', 'switch', 'tape', 'battery', 'lock', 'plumbing'],
  },
  {
    id: 'stationery',
    name: 'Stationery & Books',
    nameTa: 'நோட்டு & ஸ்டேஷனரி',
    shortName: 'Stationery',
    icon: 'book-outline',
    keywords: ['stationery', 'book', 'books', 'notebook', 'pen', 'pencil', 'eraser', 'scale', 'paper'],
  },
  {
    id: 'apparel',
    name: 'Handlooms & Apparel',
    nameTa: 'கைத்தறி ஆடைகள்',
    shortName: 'Handlooms',
    icon: 'shirt-outline',
    keywords: ['clothes', 'clothing', 'dhoti', 'veshti', 'towel', 'saree', 'cotton', 'lungi', 'handloom', 'wear'],
  },
  {
    id: 'bakery',
    name: 'Bakery & Fresh Breads',
    nameTa: 'பேக்கரி பொருட்கள்',
    shortName: 'Bakery & Bread',
    icon: 'pizza-outline',
    keywords: ['bakery', 'bread', 'bun', 'cake', 'rusk', 'toast', 'puff', 'pastry'],
  },
];

export const UPSTAGE_POS_BASE_CATEGORIES = DEFAULT_RAIL_CATEGORIES;

export const StoreSidebarRail = ({
  shops = [],
  selectedShop = null,
  onSelectShop,
  language = 'en',
  marketMode = 'local',
  isDarkMode = true,
}) => {
  const isTamil = language === 'ta';
  const isGlobal = marketMode === 'global';
  const theme = isDarkMode ? TEXTURED_DARK : TEXTURED_LIGHT;

  const displayShops = shops || [];
  const isAllActive = !selectedShop;

  const handleSelectAll = () => {
    if (onSelectShop) onSelectShop(null);
  };

  const handleSelectShop = shop => {
    if (selectedShop?.id === shop.id) {
      if (onSelectShop) onSelectShop(null);
    } else {
      if (onSelectShop) onSelectShop(shop);
    }
  };

  return (
    <View
      style={[
        styles.sidebarContainer,
        {
          backgroundColor: isDarkMode ? '#0B120E' : '#F8FAFC',
          borderRightColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
        },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. "ALL STORES" ITEM */}
        <TouchableOpacity
          style={[styles.railItem, isAllActive && styles.railItemActive]}
          activeOpacity={0.8}
          onPress={handleSelectAll}
        >
          {isAllActive && <View style={styles.activeIndicatorBar} />}

          <View
            style={[
              styles.avatarCircle,
              {
                borderColor: isAllActive ? '#10B981' : (isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'),
                backgroundColor: isAllActive ? 'rgba(16, 185, 129, 0.18)' : (isDarkMode ? '#16231B' : '#E8F5E9'),
              },
            ]}
          >
            <Ionicons
              name="apps"
              size={24}
              color={isAllActive ? '#10B981' : (isDarkMode ? '#A7F3D0' : '#475569')}
            />
          </View>
          <Text
            style={[
              styles.itemLabel,
              {
                color: isAllActive ? (isDarkMode ? '#FFFFFF' : '#0F172A') : (isDarkMode ? '#9CA3AF' : '#64748B'),
                fontWeight: isAllActive ? '800' : '500',
              },
            ]}
            numberOfLines={2}
          >
            {isTamil ? 'அனைத்து கடைகள்' : 'All Stores'}
          </Text>
        </TouchableOpacity>

        {/* 2. STORES SECTION DIVIDER */}
        <View style={styles.storeSectionHeader}>
          <View style={[styles.sectionDivider, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]} />
          <View style={styles.sectionTitleRow}>
            <Ionicons name="storefront-outline" size={10} color="#10B981" />
            <Text style={styles.sectionHeaderText}>
              {isTamil ? 'கடைகள்' : 'STORES'}
            </Text>
          </View>
        </View>

        {/* 3. LIST OF LOCAL STORES */}
        {displayShops.map(shop => {
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
              style={[styles.railItem, isSelected && styles.railItemActive]}
              activeOpacity={0.8}
              onPress={() => handleSelectShop(shop)}
            >
              {isSelected && <View style={styles.activeIndicatorBar} />}

              <View
                style={[
                  styles.avatarCircle,
                  {
                    borderColor: isSelected ? '#10B981' : (isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'),
                    backgroundColor: isDarkMode ? '#16231B' : '#F1F5F9',
                  },
                ]}
              >
                <Image source={{ uri: imageUrl }} style={styles.avatarImage} />
                <View
                  style={[
                    styles.posDotBadge,
                    {
                      backgroundColor: '#10B981',
                      borderColor: isDarkMode ? '#0B120E' : '#FFFFFF',
                    },
                  ]}
                />
              </View>

              <Text
                style={[
                  styles.itemLabel,
                  {
                    color: isSelected ? (isDarkMode ? '#FFFFFF' : '#0F172A') : (isDarkMode ? '#9CA3AF' : '#64748B'),
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
                numberOfLines={2}
              >
                {displayName}
              </Text>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebarContainer: {
    width: 76,
    borderRightWidth: 1,
    height: '100%',
  },
  scrollContent: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  railItem: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    position: 'relative',
    marginBottom: 4,
  },
  railItemActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  activeIndicatorBar: {
    position: 'absolute',
    right: 0,
    top: 8,
    bottom: 8,
    width: 3.5,
    backgroundColor: '#10B981',
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    resizeMode: 'cover',
  },
  posDotBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  itemLabel: {
    fontSize: 10.5,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 13,
  },
  subInfoLabel: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '600',
    color: '#34D399',
  },
  storeSectionHeader: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 6,
  },
  sectionDivider: {
    width: '70%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 6,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sectionHeaderText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#10B981',
  },
});
