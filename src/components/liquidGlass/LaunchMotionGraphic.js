import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Animated,
  Dimensions,
  TouchableOpacity,
  Image,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const KOODAI_LOGO = require('../../assets/koodai-mark-transparent.png');

/**
 * Splash Screen for Kadai App Launch (Clean White Edition)
 * 
 * Features:
 * - Pure white background (#FFFFFF)
 * - Large, crisp Upstage Koodai Logo centered on screen (no animations)
 * - Auto-dismiss with smooth fade-out or instant tap-to-skip
 */
export const LaunchMotionGraphic = ({ onFinish }) => {
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const hasExited = useRef(false);

  const triggerExit = () => {
    if (hasExited.current) return;
    hasExited.current = true;

    Animated.timing(exitOpacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      if (onFinish) onFinish();
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerExit();
    }, 1500);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const logoSize = Math.round(Math.min(SCREEN_WIDTH * 0.94, 460));

  return (
    <Animated.View
      style={[
        styles.fullScreenOverlay,
        {
          opacity: exitOpacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.touchContainer}
        activeOpacity={1}
        onPress={triggerExit}
      >
        <View style={styles.centerContainer}>
          <Image
            source={KOODAI_LOGO}
            style={{ width: logoSize, height: logoSize }}
            resizeMode="contain"
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fullScreenOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    zIndex: 999999,
  },
  touchContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LaunchMotionGraphic;
