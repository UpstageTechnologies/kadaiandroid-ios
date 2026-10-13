import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, Dimensions, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, radius, spacing, type, shadow } from '../../theme/tokens';

const { width } = Dimensions.get('window');

const PAGES = [
  {
    key: '1',
    title: 'Your Daily\nStore, Now\nin Your Pocket',
    subtitle: 'Shop smart, save time,\nget everything you need.',
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=900&q=80&auto=format&fit=crop',
    align: 'left',
  },
  {
    key: '2',
    title: 'Quick & Easy\nShopping',
    subtitle: 'Find what you need in seconds\nwith a simple and clean interface.',
    image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=900&q=80&auto=format&fit=crop',
  },
  {
    key: '3',
    title: 'Best Deals\nEveryday',
    subtitle: 'Get exclusive offers and discounts\non your favorite products.',
    image: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?w=900&q=80&auto=format&fit=crop',
  },
  {
    key: '4',
    title: 'Everything\nfor Your Home',
    subtitle: 'Groceries, household essentials,\nand more – all in one place.',
    image: 'https://images.unsplash.com/photo-1523475496153-3d6cc9e7f4c7?w=900&q=80&auto=format&fit=crop',
  },
];

export default function Onboarding({ navigation }) {
  const [index, setIndex] = useState(0);
  const [imgError, setImgError] = useState({});
  const listRef = useRef();
  const insets = useSafeAreaInsets();

  const markSeen = async () => {
    try {
      await AsyncStorage.setItem('onboardingSeen', '1');
    } catch (e) {}
  };

  const handleSkip = async () => {
    await markSeen();
    navigation.replace('Login');
  };

  const handleNext = async () => {
    if (index < PAGES.length - 1) {
      const next = index + 1;
      listRef.current?.scrollToIndex({ index: next });
      setIndex(next);
    } else {
      await markSeen();
      navigation.replace('Login');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} translucent={false} />
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs, paddingLeft: spacing.md, paddingRight: spacing.md }]}>
        <TouchableOpacity 
          onPress={handleSkip} 
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          style={styles.skipButton}
          accessible
          accessibilityLabel="Skip onboarding"
        >
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onMomentumScrollEnd={(ev) => {
          const i = Math.round(ev.nativeEvent.contentOffset.x / width);
          setIndex(i);
        }}
        keyExtractor={(i) => i.key}
        style={{ flex: 1 }}
        renderItem={({ item, index: idx }) => (
          <View style={[styles.page, { width }]}> 
            <View style={styles.illustrationWrap}>
              {!imgError[idx] ? (
                <Image
                  source={{ uri: item.image }}
                  style={styles.image}
                  onError={() => setImgError((s) => ({ ...s, [idx]: true }))}
                />
              ) : (
                <View style={styles.fallback}>
                  <Icon name={item.fallbackIcon || 'basket'} size={64} color={colors.brand} />
                </View>
              )}
            </View>
            <View style={[styles.textWrap, item.align === 'left' ? { alignItems: 'flex-start' } : { alignItems: 'center' }]}> 
              <Text style={[styles.title, item.align === 'left' && { textAlign: 'left' }]}>
                {item.title}
              </Text>
              <Text style={[styles.subtitle, item.align === 'left' && { textAlign: 'left' }]}>
                {item.subtitle}
              </Text>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View 
              key={i} 
              style={[styles.dot, index === i && styles.dotActive]} 
              accessibilityLabel={`Page ${i + 1}`} 
            />
          ))}
        </View>

        <TouchableOpacity 
          style={styles.cta} 
          onPress={handleNext} 
          accessibilityLabel={index === PAGES.length - 1 ? 'Get started' : 'Next page'}
        >
          <Text style={styles.ctaText}>
            {index === PAGES.length - 1 ? 'Get Started →' : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', minHeight: 52 },
  skipButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm },
  skip: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  illustrationWrap: { width: '100%', height: 300, borderRadius: radius.xl, overflow: 'hidden', ...shadow.card, backgroundColor: colors.surface },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  fallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  textWrap: { marginTop: spacing.xl, alignItems: 'center', paddingHorizontal: spacing.md },
  title: { ...type.display, textAlign: 'center', color: colors.ink },
  subtitle: { marginTop: spacing.md, textAlign: 'center', ...type.body, color: colors.muted, lineHeight: 22 },
  footer: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  dotActive: { backgroundColor: colors.brand, width: 24 },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
