import React, { useContext, useEffect } from 'react';
import { View, ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createNavigationContainerRef } from '@react-navigation/native';
import notifee, { EventType } from '@notifee/react-native';

import { AuthContext } from '../../context/AuthContext';
import NotificationService from '../../notification/NotificationService';

import Toast from 'react-native-toast-message';
import { colors } from '../../theme/tokens';
import ShopProductsScreen from '../../screens/ShopProductsScreen';
import LoginScreen from '../../screens/auth/LoginScreen';
import Onboarding from '../../screens/auth/Onboarding';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RegisterPhoneScreen from '../../screens/auth/RegisterPhoneScreen';
import RegisterOtpScreen from '../../screens/auth/RegisterOtpScreen';
import RegisterDetailsScreen from '../../screens/auth/RegisterDetailsScreen';
import RegisterAddressScreen from '../../screens/auth/RegisterAddressScreen';
import CustomerHome from '../../screens/home/CustomerHome';
import LiquidGlassHome from '../../screens/home/LiquidGlassHome';
import AIMicScreen from '../../screens/AIMicScreen';
import ProductDetailsScreen from '../../screens/ProductDetailsScreen';
import CartScreen from '../../screens/cart/CartScreen';
import CheckoutScreen from '../../screens/checkout/CheckoutScreen';
import TrackOrderScreen from '../../screens/tracking/TrackOrderScreen';
import OrdersScreen from '../../screens/orders/OrdersScreen';
import ProfileSettingsScreen from '../../screens/profile/ProfileSettingsScreen';
import LocationPickerScreen from '../../screens/location/LocationPickerScreen';
const Stack = createStackNavigator();

export const navigationRef = createNavigationContainerRef();

export default function AppNavigator() {
const {
  user,
  isLoading,
  registrationInProgress,
} = useContext(AuthContext);
  const [onboardingSeen, setOnboardingSeen] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('onboardingSeen').then((v) => {
      if (!mounted) return;
      setOnboardingSeen(!!v);
    }).catch(() => setOnboardingSeen(false));
    return () => { mounted = false; };
  }, []);
useEffect(() => {
  if (!user?.uid) return undefined;

  const unsubscribeTokenRefresh =
    NotificationService.subscribeToTokenRefresh(user.uid);
  NotificationService.requestPermission(user.uid);

  return unsubscribeTokenRefresh;
}, [user?.uid]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.dark}
      />

      <Stack.Navigator screenOptions={{ headerShown: false }}>
{!user || registrationInProgress ? (

          // If onboardingSeen is null we are still loading the flag
          onboardingSeen === null ? (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="RegisterPhone" component={RegisterPhoneScreen} />
              <Stack.Screen name="RegisterOtp" component={RegisterOtpScreen} />
              <Stack.Screen name="RegisterAddress" component={RegisterAddressScreen} />
              <Stack.Screen name="RegisterDetails" component={RegisterDetailsScreen} />
            </>
          ) : !onboardingSeen ? (
            <>
              <Stack.Screen name="Onboarding" component={Onboarding} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="RegisterPhone" component={RegisterPhoneScreen} />
              <Stack.Screen name="RegisterOtp" component={RegisterOtpScreen} />
              <Stack.Screen name="RegisterAddress" component={RegisterAddressScreen} />
              <Stack.Screen name="RegisterDetails" component={RegisterDetailsScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="RegisterPhone" component={RegisterPhoneScreen} />
              <Stack.Screen name="RegisterOtp" component={RegisterOtpScreen} />
              <Stack.Screen name="RegisterAddress" component={RegisterAddressScreen} />
              <Stack.Screen name="RegisterDetails" component={RegisterDetailsScreen} />
            </>
          )

        ) : (

          <>
            <Stack.Screen
              name="CustomerHome"
              component={LiquidGlassHome}
            />
            <Stack.Screen
              name="LegacyCustomerHome"
              component={CustomerHome}
            />
            <Stack.Screen
  name="AIMicScreen"
  component={AIMicScreen}
/>
            <Stack.Screen
  name="ShopProductsScreen"
  component={ShopProductsScreen}
/>
<Stack.Screen
  name="ProductDetailsScreen"
  component={ProductDetailsScreen}
/>
            <Stack.Screen
              name="CartScreen"
              component={CartScreen}
            />

            <Stack.Screen
              name="CheckoutScreen"
              component={CheckoutScreen}
            />

            <Stack.Screen
              name="OrdersScreen"
              component={OrdersScreen}
            />

            <Stack.Screen
              name="TrackOrderScreen"
              component={TrackOrderScreen}
            />

            <Stack.Screen
              name="ProfileSettingsScreen"
              component={ProfileSettingsScreen}
            />
            <Stack.Screen 
  name="LocationPickerScreen" 
  component={LocationPickerScreen} 
  options={{ headerShown: false }} 
/>

          </>

        )}

      </Stack.Navigator>

      <Toast />

    </>
  );

}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.canvas,
  },
});
