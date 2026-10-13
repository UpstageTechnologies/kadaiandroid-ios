import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing } from '../../theme/tokens';

/**
 * Production-quality reusable header for auth screens
 * Provides consistent back button, skip button, and spacing
 */
export default function AuthHeader({ onBack, onSkip, showSkip = false }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xs }]}>
      <TouchableOpacity 
        onPress={onBack} 
        style={styles.backBtn}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        accessible
        accessibilityLabel="Go back"
      >
        <Icon name="arrow-back" size={24} color={colors.ink} />
      </TouchableOpacity>

      {showSkip ? (
        <TouchableOpacity 
          onPress={onSkip}
          style={styles.skipBtn}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          accessible
          accessibilityLabel="Skip registration"
        >
          <Icon name="close" size={24} color={colors.ink} />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    minHeight: 56,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 0,
  },
  skipBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 0,
  },
  placeholder: {
    width: 44,
    height: 44,
  },
});
