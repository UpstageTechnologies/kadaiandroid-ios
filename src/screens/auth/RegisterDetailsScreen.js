import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

import Icon from 'react-native-vector-icons/Ionicons';import { getAuth } from '@react-native-firebase/auth';

import {
  getMessaging,
  requestPermission,
  getToken,
} from '@react-native-firebase/messaging';

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from '@react-native-firebase/firestore';

import {
  colors,
  spacing,
  type,
  radius,
} from '../../theme/tokens';

import AuthHeader from '../../components/layout/AuthHeader';
import { AuthContext } from '../../context/AuthContext';

export default function RegisterDetailsScreen({ navigation, route }) {
  const { setRegistrationInProgress } = useContext(AuthContext);

  const {
    phone,
    country,
    state,
    district,
    city,
    area,
    address,
    pincode,
    lat,
    lon,
    locationSource,
  } = route.params || {};

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [profession, setProfession] = useState('');

  const [loading, setLoading] = useState(false);

  const professions = [
    'Student',
    'Business',
    'Employee',
    'Teacher',
    'Doctor',
    'Engineer',
    'Farmer',
    'Homemaker',
    'Self Employed',
    'Other',
  ];

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBack
    );

    return () => backHandler.remove();
  }, []);

  const handleBack = () => {
    navigation.goBack();
    return true;
  };

  const validate = () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert('Validation', 'Full name is required');
      return null;
    }

    if (trimmedName.length < 2) {
      Alert.alert(
        'Validation',
        'Full name must be at least 2 characters'
      );
      return null;
    }

    const numericAge = Number(age);

    if (!age || !Number.isInteger(numericAge)) {
      Alert.alert('Validation', 'Please enter your age');
      return null;
    }

    if (numericAge < 13 || numericAge > 100) {
      Alert.alert(
        'Validation',
        'Please enter a valid age between 13 and 100'
      );
      return null;
    }

    if (!profession) {
      Alert.alert(
        'Validation',
        'Please select your profession'
      );
      return null;
    }

    return {
      trimmedName,
      numericAge,
    };
  };

  const handleCreateAccount = async () => {
    if (loading) return;

    const valid = validate();

    if (!valid) return;

    setLoading(true);

    try {
      const authInstance = getAuth();
const db = getFirestore();
const messagingInstance = getMessaging();

const currentUser = authInstance.currentUser;

      if (!currentUser) {
        Alert.alert(
          'Error',
          'Authentication not found. Please restart registration.'
        );
        return;
      }
const token = await requestPermission(messagingInstance)
  .then(() => getToken(messagingInstance))
  .catch(() => null);

      const uid = currentUser.uid;

      /*
       * Keep existing customer data if it already exists.
       */
      let existing = {};

      try {
      const existingDoc = await getDoc(
  doc(db, 'customers', uid)
);

        if (existingDoc.exists()) {
          existing = existingDoc.data() || {};
        }
      } catch (error) {
        console.log(
          'EXISTING CUSTOMER READ ERROR:',
          error?.message
        );
      }

      const profile = {
        uid,

        name: valid.trimmedName,
        fullName: valid.trimmedName,

        age: valid.numericAge,

        profession,

        mobile: phone || currentUser.phoneNumber || '',

        address: {
          country: country || 'IN',
          state: state || '',
          district: district || '',
          city: city || '',
          area: area || '',
          pincode: String(pincode || '').trim(),
          fullAddress: address || '',

          lat:
            locationSource === 'gps' &&
            Number.isFinite(Number(lat))
              ? Number(lat)
              : null,

          lon:
            locationSource === 'gps' &&
            Number.isFinite(Number(lon))
              ? Number(lon)
              : null,

          locationSource: locationSource || 'manual',
        },

        fcmToken: token || existing.fcmToken || '',

        createdAt:
          existing.createdAt ||
          new Date().toISOString(),

        updatedAt: new Date().toISOString(),
      };

      console.log(
        '========== FIRESTORE SAVE DEBUG =========='
      );

      console.log('UID:', uid);
      console.log('Phone:', profile.mobile);
      console.log('Name:', profile.name);
      console.log('Age:', profile.age);
      console.log('Profession:', profile.profession);
      console.log(
        'Customer path:',
        `customers/${uid}`
      );

      console.log(
        '=========================================='
      );
await setDoc(
  doc(db, 'customers', uid),
  profile,
  { merge: true }
);
      await setRegistrationInProgress(false);

    } catch (e) {
      console.log(
        '========== REGISTRATION ERROR =========='
      );

      console.log('ERROR CODE:', e?.code);
      console.log('ERROR MESSAGE:', e?.message);
      console.log('FULL ERROR:', e);

      console.log(
        '========================================'
      );

      Alert.alert(
        'Registration failed',
        `${e?.code || 'unknown-error'}\n\n${
          e?.message || 'Unable to create account'
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.canvas}
      />

      <AuthHeader
        onBack={handleBack}
        showSkip={false}
      />

      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>

            <Text style={styles.heading}>
              Tell us about you
            </Text>

            <Text style={styles.sub}>
              A few quick details to personalize your experience.
            </Text>

            {/* NAME */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Full Name *
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={colors.muted}
                value={name}
                onChangeText={setName}
                editable={!loading}
              />
            </View>

            {/* AGE */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Age *
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your age"
                placeholderTextColor={colors.muted}
                value={age}
                onChangeText={(text) =>
                  setAge(
                    text.replace(/[^0-9]/g, '')
                  )
                }
                keyboardType="number-pad"
                maxLength={3}
                editable={!loading}
              />
            </View>

            {/* PROFESSION */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Profession *
              </Text>

              <View style={styles.professionGrid}>
                {professions.map((item) => {
                  const selected =
                    profession === item;

                  return (
                    <TouchableOpacity
                      key={item}
                      activeOpacity={0.8}
                      disabled={loading}
                      onPress={() =>
                        setProfession(item)
                      }
                      style={[
                        styles.professionChip,
                        selected &&
                          styles.professionChipSelected,
                      ]}
                    >
                      {selected && (
                        <Icon
                          name="checkmark-circle"
                          size={18}
                          color="#fff"
                          style={styles.checkIcon}
                        />
                      )}

                      <Text
                        style={[
                          styles.professionText,
                          selected &&
                            styles.professionTextSelected,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

          </View>

          <TouchableOpacity
            style={[
              styles.cta,
              loading && { opacity: 0.6 },
            ]}
            onPress={handleCreateAccount}
            disabled={loading}
            accessibilityLabel="Create account"
          >
            <Text style={styles.ctaTxt}>
              {loading
                ? 'Creating...'
                : 'Continue'}
            </Text>

            {!loading && (
              <Icon
                name="arrow-forward"
                size={20}
                color="#fff"
                style={styles.ctaIcon}
              />
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },

  content: {
    paddingTop: spacing.xl,
  },

  heading: {
    ...type.heading,
    color: colors.ink,
    marginBottom: spacing.xs,
  },

  sub: {
    ...type.body,
    color: colors.muted,
    marginBottom: spacing.xxxl,
    lineHeight: 22,
  },

  inputGroup: {
    marginBottom: spacing.lg,
  },

  label: {
    ...type.label,
    color: colors.ink,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },

  input: {
    height: 52,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    color: colors.ink,
  },

  professionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  professionChip: {
    minHeight: 44,
    paddingHorizontal: 15,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  professionChipSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },

  professionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },

  professionTextSelected: {
    color: '#fff',
  },

  checkIcon: {
    marginRight: 5,
  },

  cta: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.brand,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  ctaTxt: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  ctaIcon: {
    marginLeft: 8,
  },
});
