import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, type } from '../../theme/tokens';

export default function AppHeader({
  title,
  navigation,
  showBack = true,
  rightComponent = null,
}) {
  const handleBack = () => {
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('CustomerHome');
    }
  };

  const headerBgColor = colors.dark;

  return (
    <>
      <StatusBar
        backgroundColor={headerBgColor}
        barStyle="light-content"
        translucent={false}
      />
      <SafeAreaView edges={['top']} style={{ backgroundColor: headerBgColor }}>
      <View style={[styles.headerContainer, { backgroundColor: headerBgColor }]}>
        {/* Left Section: Back Button */}
        <View style={styles.actionColumn}>
          {showBack ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              activeOpacity={0.7}
              accessibilityLabel="Go back"
            >
              <Icon name="arrow-left" size={21} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Center Section: Title */}
        <View style={styles.titleColumn}>
          <Text
            numberOfLines={1}
            style={styles.headerTitle}
          >
            {title}
          </Text>
        </View>

        {/* Right Section: Actions */}
        <View style={[styles.actionColumn, styles.alignRight]}>
          {rightComponent || <View style={styles.emptySpace} />}
        </View>
      </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    height: Platform.OS === 'ios' ? 48 : 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    ...shadow.card,
  },
  actionColumn: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  titleColumn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: { ...type.cardTitle, color: '#fff' },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.13)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySpace: {
    width: 36,
    height: 36,
  },
});
