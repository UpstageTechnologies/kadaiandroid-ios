import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { TEXTURED_DARK, TEXTURED_LIGHT } from './theme';
import { calculateEffectivePricing } from '../../utils/pricing';

export const TopShopsCarousel = ({
  offers = [],
  loadingOffers = false,
  onSelectOffer,
  // Backwards compatibility props
  shops = [],
  selectedShop = null,
  onSelectShop,
  language = 'en',
  cityName = '',
  marketMode = 'local',
  isDarkMode = true,
}) => {
  const isTamil = language === 'ta';
  const isGlobal = marketMode === 'global';
  const theme = isDarkMode ? TEXTURED_DARK : TEXTURED_LIGHT;

  // Use offers if provided; if legacy shops passed without offers, fall back gracefully
  const displayOffers = offers;

  const headerTitle = isGlobal
    ? (isTamil ? 'உலகளாவிய சலுகைகள்' : 'Global Offers')
    : (isTamil ? 'உள்ளூர் சலுகைகள்' : 'Local Offers');

  const badgeText = isGlobal
    ? (isTamil ? 'அனைத்து இடங்களிலும்' : 'Worldwide')
    : (cityName ? cityName : (isTamil ? 'உள்ளூர்' : 'Local Deals'));

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithBadge}>
          <Ionicons
            name="flash"
            size={16}
            color={isGlobal ? '#60A5FA' : theme.neonGreen}
          />
          <Text style={[styles.sectionTitle, { color: theme.textWhite }]}>
            {headerTitle}
          </Text>
          <View
            style={[
              styles.modeIndicatorBadge,
              {
                backgroundColor: isGlobal
                  ? 'rgba(59, 130, 246, 0.15)'
                  : 'rgba(34, 197, 94, 0.15)',
              },
            ]}
          >
            <Text
              style={[
                styles.modeIndicatorText,
                { color: isGlobal ? '#60A5FA' : theme.neonGreen },
              ]}
              numberOfLines={1}
            >
              {badgeText}
            </Text>
          </View>
        </View>

        {displayOffers.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={[styles.countBadgeText, { color: theme.textMuted }]}>
              {displayOffers.length} {isTamil ? 'சலுகைகள்' : 'Deals'}
            </Text>
          </View>
        )}
      </View>

      {/* Loading state */}
      {loadingOffers ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.neonGreen} />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>
            {isTamil ? 'சலுகைகள் ஏற்றப்படுகின்றன...' : 'Finding best offers...'}
          </Text>
        </View>
      ) : displayOffers.length === 0 ? (
        /* Empty State */
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
        >
          <Ionicons
            name="pricetag-outline"
            size={20}
            color={isGlobal ? '#60A5FA' : theme.neonGreen}
          />
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            {isGlobal
              ? (isTamil
                  ? 'உலகளாவிய தள்ளுபடி சலுகைகள் தற்போது இல்லை'
                  : 'No active worldwide discount offers right now')
              : (isTamil
                  ? `${cityName ? cityName + '-ல் ' : ''}தற்போது சிறப்பு சலுகைகள் இல்லை`
                  : `No active discount offers right now in ${cityName || 'your city'}`)}
          </Text>
        </View>
      ) : (
        /* Horizontal Offers Carousel */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
        >
          {displayOffers.map(offer => {
            const displayName = offer.name || offer.itemName || 'Offer Product';
            const imageUrl =
              offer.img ||
              offer.image ||
              offer.imageUrl ||
              'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80';
            const pricing = calculateEffectivePricing(offer);
            const price = pricing.price;
            const originalPrice = pricing.originalPrice;
            const hasValidDiscount = pricing.hasDiscount;
            const discountBadge = offer.discountBadge || pricing.discountBadge;
            const enrichedOffer = {
              ...offer,
              price,
              salesPrice: price,
              originalPrice,
              originalSalesPrice: originalPrice,
              discountBadge,
              discountPercent: pricing.discountPercent,
            };

            return (
              <TouchableOpacity
                key={`${offer.shopId || 'shop'}_${offer.id}`}
                style={[
                  styles.offerCard,
                  {
                    backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                    borderColor: isDarkMode
                      ? 'rgba(34, 197, 94, 0.22)'
                      : 'rgba(22, 163, 74, 0.18)',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isDarkMode ? 0 : 0.05,
                    shadowRadius: 3,
                    elevation: isDarkMode ? 0 : 2,
                  },
                ]}
                onPress={() => onSelectOffer && onSelectOffer(enrichedOffer)}
                activeOpacity={0.85}
              >
                {/* Product Image Box */}
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.offerImage}
                    resizeMode="cover"
                  />

                  {/* Real Discount Badge (Only shown when valid) */}
                  {discountBadge ? (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>
                        {discountBadge}
                      </Text>
                    </View>
                  ) : null}

                  {/* Unit or weight if present */}
                  {offer.unit ? (
                    <View style={styles.unitBadge}>
                      <Text style={styles.unitBadgeText} numberOfLines={1}>
                        {offer.unit}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Offer Details Body */}
                <View style={styles.offerCardBody}>
                  {/* Shop Name */}
                  <View style={styles.shopNameRow}>
                    <Ionicons
                      name="storefront-outline"
                      size={10}
                      color={isDarkMode ? '#A7F3D0' : '#15803D'}
                    />
                    <Text
                      style={[
                        styles.shopNameText,
                        { color: isDarkMode ? '#A7F3D0' : '#15803D' },
                      ]}
                      numberOfLines={1}
                    >
                      {offer.shopName || 'Local Shop'}
                    </Text>
                  </View>

                  {/* Product Title */}
                  <Text
                    style={[styles.productName, { color: theme.textWhite }]}
                    numberOfLines={1}
                  >
                    {isTamil && offer.nameTa ? offer.nameTa : displayName}
                  </Text>

                  {/* Pricing Row */}
                  <View style={styles.priceRow}>
                    <Text
                      style={[
                        styles.dealPrice,
                        { color: isDarkMode ? theme.neonGreen : '#15803D' },
                      ]}
                    >
                      ₹{price}
                    </Text>

                    {hasValidDiscount && (
                      <Text style={styles.strikethroughPrice}>
                        ₹{originalPrice}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

export const OffersCarousel = TopShopsCarousel;
export default TopShopsCarousel;

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  modeIndicatorBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    maxWidth: 120,
  },
  modeIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    marginHorizontal: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  carouselContent: {
    paddingHorizontal: 8,
    gap: 10,
  },
  offerCard: {
    width: 148,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 90,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  offerImage: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  unitBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 75,
  },
  unitBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '600',
  },
  offerCardBody: {
    padding: 8,
    gap: 3,
  },
  shopNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  shopNameText: {
    fontSize: 9.5,
    fontWeight: '700',
    flex: 1,
  },
  productName: {
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  dealPrice: {
    fontSize: 13.5,
    fontWeight: '900',
  },
  strikethroughPrice: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
});
