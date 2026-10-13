import React, {
  useState,
  useContext,
  useMemo,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';

import {SafeAreaView} from 'react-native-safe-area-context';

import {
  getAuth,
  signInWithPhoneNumber,
} from '@react-native-firebase/auth';

import {
  collection,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
} from '@react-native-firebase/firestore';

import {AuthContext} from '../../context/AuthContext';
import {setConfirmation} from './phoneSession';

import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';


// ============================================================
// COLORS
// ============================================================

const COLORS = {
  primary: '#0B9D50',
  primaryDark: '#087C3F',

  background: '#ECF9F1',
  lightGreen: '#DCF6E6',
  softGreen: '#DFF5E8',
  paleGreen: '#E5F7EB',

  white: '#FFFFFF',

  text: '#0F172A',
  secondaryText: '#475569',
  muted: '#64748B',
  lightText: '#94A3B8',

  border: '#E2E8F0',
  softBorder: '#EDF1F4',

  danger: '#EF4444',

  black: '#000000',
};


// ============================================================
// COUNTRY DATA
// ============================================================

const COUNTRIES = [
  {name: 'India', flag: '🇮🇳', code: '+91'},
  {name: 'United States', flag: '🇺🇸', code: '+1'},
  {name: 'United Kingdom', flag: '🇬🇧', code: '+44'},
  {name: 'United Arab Emirates', flag: '🇦🇪', code: '+971'},
  {name: 'Singapore', flag: '🇸🇬', code: '+65'},
  {name: 'Australia', flag: '🇦🇺', code: '+61'},
  {name: 'Canada', flag: '🇨🇦', code: '+1'},
  {name: 'Malaysia', flag: '🇲🇾', code: '+60'},
  {name: 'Saudi Arabia', flag: '🇸🇦', code: '+966'},
  {name: 'Qatar', flag: '🇶🇦', code: '+974'},
  {name: 'Kuwait', flag: '🇰🇼', code: '+965'},
  {name: 'Oman', flag: '🇴🇲', code: '+968'},
  {name: 'Bahrain', flag: '🇧🇭', code: '+973'},
  {name: 'New Zealand', flag: '🇳🇿', code: '+64'},
  {name: 'South Africa', flag: '🇿🇦', code: '+27'},
  {name: 'Germany', flag: '🇩🇪', code: '+49'},
  {name: 'France', flag: '🇫🇷', code: '+33'},
  {name: 'Italy', flag: '🇮🇹', code: '+39'},
  {name: 'Spain', flag: '🇪🇸', code: '+34'},
  {name: 'Japan', flag: '🇯🇵', code: '+81'},
  {name: 'China', flag: '🇨🇳', code: '+86'},
  {name: 'South Korea', flag: '🇰🇷', code: '+82'},
  {name: 'Thailand', flag: '🇹🇭', code: '+66'},
  {name: 'Indonesia', flag: '🇮🇩', code: '+62'},
  {name: 'Philippines', flag: '🇵🇭', code: '+63'},
  {name: 'Bangladesh', flag: '🇧🇩', code: '+880'},
  {name: 'Sri Lanka', flag: '🇱🇰', code: '+94'},
  {name: 'Nepal', flag: '🇳🇵', code: '+977'},
  {name: 'Pakistan', flag: '🇵🇰', code: '+92'},
  {name: 'Brazil', flag: '🇧🇷', code: '+55'},
  {name: 'Mexico', flag: '🇲🇽', code: '+52'},
  {name: 'Russia', flag: '🇷🇺', code: '+7'},
  {name: 'Turkey', flag: '🇹🇷', code: '+90'},
  {name: 'Switzerland', flag: '🇨🇭', code: '+41'},
  {name: 'Netherlands', flag: '🇳🇱', code: '+31'},
  {name: 'Sweden', flag: '🇸🇪', code: '+46'},
  {name: 'Norway', flag: '🇳🇴', code: '+47'},
  {name: 'Denmark', flag: '🇩🇰', code: '+45'},
  {name: 'Ireland', flag: '🇮🇪', code: '+353'},
  {name: 'Portugal', flag: '🇵🇹', code: '+351'},
];


// ============================================================
// LOGIN SCREEN
// ============================================================

export default function LoginScreen({navigation}) {
  const db = getFirestore();

  const {setRegistrationInProgress} =
    useContext(AuthContext);

  const [loading, setLoading] = useState(false);

  const [selectedCountry, setSelectedCountry] =
    useState(COUNTRIES[0]);

  const [phone, setPhone] = useState('');

  const [countryModalVisible, setCountryModalVisible] =
    useState(false);

  const [countrySearch, setCountrySearch] =
    useState('');


  // ==========================================================
  // FILTER COUNTRY LIST
  // ==========================================================

  const filteredCountries = useMemo(() => {
    const search = countrySearch
      .trim()
      .toLowerCase();

    if (!search) {
      return COUNTRIES;
    }

    return COUNTRIES.filter(item => {
      return (
        item.name
          .toLowerCase()
          .includes(search) ||
        item.code.includes(search)
      );
    });
  }, [countrySearch]);


  // ==========================================================
  // PHONE VALIDATION
  // ==========================================================

  const validatePhone = number => {
    const digits = number.replace(/\D/g, '');

    if (!digits) {
      return false;
    }

    if (digits.length < 6 || digits.length > 15) {
      return false;
    }

    return true;
  };


  // ==========================================================
  // SEND OTP
  // ==========================================================

  const handleLogin = async () => {
    if (loading) {
      return;
    }

    const digits = phone.replace(/\D/g, '');

    if (!validatePhone(phone)) {
      Alert.alert(
        'Invalid phone number',
        'Please enter a valid mobile number.',
      );

      return;
    }

    const formattedPhone =
      `${selectedCountry.code}${digits}`;

    setLoading(true);

    try {
      // ------------------------------------------------------
      // CHECK EXISTING CUSTOMER
      // ------------------------------------------------------

      let customerExists = false;

      try {
        const snapshot = await getDocs(
          query(
            collection(db, 'customers'),
            where(
              'mobile',
              '==',
              formattedPhone,
            ),
            limit(1),
          ),
        );

        customerExists = !snapshot.empty;
      } catch (error) {
        console.log(
          'CUSTOMER EXISTING CHECK ERROR:',
          error?.message,
        );
      }


      // ------------------------------------------------------
      // SEND FIREBASE OTP
      // ------------------------------------------------------

      const authInstance = getAuth();

      const confirmation =
        await signInWithPhoneNumber(
          authInstance,
          formattedPhone,
        );

      setConfirmation(confirmation);


      // ------------------------------------------------------
      // NEW CUSTOMER
      // ------------------------------------------------------

      if (!customerExists) {
        await setRegistrationInProgress(true);
      }


      // ------------------------------------------------------
      // OTP SCREEN
      // ------------------------------------------------------

      navigation.navigate(
        'RegisterOtp',
        {
          phone: formattedPhone,

          mode: customerExists
            ? 'login'
            : 'register',
        },
      );

    } catch (error) {
      console.log(
        'PHONE LOGIN ERROR:',
        error,
      );

      Toast.show({
        type: 'error',
        text1: 'Unable to send OTP',
        text2:
          error?.message ||
          'Please check your mobile number and try again.',
      });

    } finally {
      setLoading(false);
    }
  };


  // ==========================================================
  // COUNTRY SELECT
  // ==========================================================

  const handleCountrySelect = country => {
    setSelectedCountry(country);

    setCountryModalVisible(false);

    setCountrySearch('');
  };


  // ==========================================================
  // COUNTRY ROW
  // ==========================================================

  const renderCountryItem = ({item}) => {
    const isSelected =
      selectedCountry.code === item.code &&
      selectedCountry.name === item.name;

    return (
      <TouchableOpacity
        style={[
          styles.countryItem,
          isSelected &&
            styles.countryItemSelected,
        ]}
        onPress={() =>
          handleCountrySelect(item)
        }
        activeOpacity={0.7}
      >

        <View style={styles.countryFlagBox}>
          <Text style={styles.countryFlag}>
            {item.flag}
          </Text>
        </View>

        <View style={styles.countryInfo}>

          <Text style={styles.countryName}>
            {item.name}
          </Text>

          <Text style={styles.countryCode}>
            {item.code}
          </Text>

        </View>

        {isSelected && (
          <View style={styles.selectedCheck}>
            <Icon
              name="checkmark"
              size={16}
              color={COLORS.white}
            />
          </View>
        )}

      </TouchableOpacity>
    );
  };


  // ==========================================================
  // UI
  // ==========================================================

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'bottom']}
    >

      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.background}
        translucent={false}
      />

      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios'
              ? 'interactive'
              : 'on-drag'
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            styles.scrollContent
          }
          bounces={false}
        >

          {/* ==================================================
              TOP BRAND
          ================================================== */}

          <View style={styles.topBar}>

            <View style={styles.logoRow}>



            </View>

          </View>


          {/* ==================================================
              HERO
          ================================================== */}

          <View style={styles.heroSection}>

            <View style={styles.heroGlowLarge} />

            <View style={styles.heroGlowSmall} />

            <View style={styles.heroIllustration}>

              <View style={styles.heroBasket}>

                <Icon
                  name="cart"
                  size={48}
                  color={COLORS.white}
                />

                <View style={styles.heroBasketLine} />

              </View>

              <View style={styles.heroLeafOne}>
                <Icon
                  name="leaf"
                  size={34}
                  color="#8BD99F"
                />
              </View>

              <View style={styles.heroLeafTwo}>
                <Icon
                  name="leaf"
                  size={26}
                  color="#B7E8C4"
                />
              </View>

              <View style={styles.heroDotOne} />
              <View style={styles.heroDotTwo} />
              <View style={styles.heroDotThree} />

            </View>

            <Text style={styles.welcomeText}>
              Welcome to
            </Text>

            <Text style={styles.brandLarge}>
              Kadai
              <Text style={styles.brandLargeGreen}>
                App
              </Text>
            </Text>

            <Text style={styles.tagline}>
              Fresh products delivered
              {'\n'}
              right to your doorstep
            </Text>

          </View>


          {/* ==================================================
              LOGIN CARD
          ================================================== */}

          <View style={styles.loginCard}>

            <View style={styles.cardTopRow}>

              <View>
                <Text style={styles.cardTitle}>
                  Sign in to continue
                </Text>
              </View>


            </View>


            {/* ==================================================
                PHONE INPUT
            ================================================== */}

            <Text style={styles.inputLabel}>
              MOBILE NUMBER
            </Text>

            <View style={styles.phoneInput}>

              {/* COUNTRY */}

              <TouchableOpacity
                style={styles.countrySelector}
                onPress={() =>
                  setCountryModalVisible(true)
                }
                disabled={loading}
                activeOpacity={0.7}
              >

                <Text style={styles.selectedFlag}>
                  {selectedCountry.flag}
                </Text>

                <Text
                  style={
                    styles.selectedCountryCode
                  }
                >
                  {selectedCountry.code}
                </Text>

                <Icon
                  name="chevron-down"
                  size={16}
                  color={COLORS.secondaryText}
                />

              </TouchableOpacity>


              <View
                style={styles.verticalDivider}
              />


              {/* PHONE */}

              <Icon
                name="call-outline"
                size={19}
                color={COLORS.primary}
                style={styles.inputIcon}
              />

              <TextInput
                style={styles.inputInner}
                placeholder="Enter mobile number"
                placeholderTextColor={
                  COLORS.lightText
                }
                value={phone}
                onChangeText={setPhone}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="phone-pad"
                maxLength={15}
                editable={!loading}
                returnKeyType="done"
                selectionColor={
                  COLORS.primary
                }
              />

            </View>


            <View style={styles.helperRow}>

              <Icon
                name="lock-closed-outline"
                size={14}
                color={COLORS.primary}
              />

              <Text style={styles.helperText}>
                We'll send a one-time verification
                code to this number.
              </Text>

            </View>


            {/* ==================================================
                CONTINUE BUTTON
            ================================================== */}

            <TouchableOpacity
              style={[
                styles.actionBtn,
                loading &&
                  styles.actionBtnLoading,
              ]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.88}
            >

              {loading ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color={COLORS.white}
                  />

                  <Text
                    style={[
                      styles.actionBtnTxt,
                      {
                        marginLeft: 9,
                      },
                    ]}
                  >
                    Sending OTP...
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.actionBtnTxt}>
                    Continue
                  </Text>

                  <View
                    style={styles.arrowCircle}
                  >
                    <Icon
                      name="arrow-forward"
                      size={17}
                      color={COLORS.primary}
                    />
                  </View>
                </>
              )}

            </TouchableOpacity>


            {/* ==================================================
                SECURITY NOTE
            ================================================== */}

            <View style={styles.securityBox}>

              <View style={styles.securityIcon}>
                <Icon
                  name="shield-checkmark"
                  size={18}
                  color={COLORS.primary}
                />
              </View>

              <View
                style={styles.securityContent}
              >

                <Text style={styles.securityTitle}>
                  Secure verification
                </Text>

                <Text style={styles.securityText}>
                  Your mobile number is protected
                  and used only for verification.
                </Text>

              </View>

            </View>

          </View>


          {/* ==================================================
              BOTTOM BENEFITS
          ================================================== */}

          <View style={styles.benefitsRow}>

            <View style={styles.benefitItem}>

              <View style={styles.benefitIcon}>
                <Icon
                  name="shield-checkmark"
                  size={18}
                  color={COLORS.primary}
                />
              </View>

              <Text style={styles.benefitTitle}>
                Secure
              </Text>

              <Text style={styles.benefitSub}>
                & encrypted
              </Text>

            </View>


            <View style={styles.benefitItem}>

              <View style={styles.benefitIcon}>
                <Icon
                  name="flash"
                  size={18}
                  color={COLORS.primary}
                />
              </View>

              <Text style={styles.benefitTitle}>
                Quick
              </Text>

              <Text style={styles.benefitSub}>
                login
              </Text>

            </View>


            <View style={styles.benefitItem}>

              <View style={styles.benefitIcon}>
                <Icon
                  name="lock-closed"
                  size={17}
                  color={COLORS.primary}
                />
              </View>

              <Text style={styles.benefitTitle}>
                Your data
              </Text>

              <Text style={styles.benefitSub}>
                is safe
              </Text>

            </View>

          </View>


          <Text style={styles.footerText}>
            By continuing, you agree to our
            {' '}
            Terms & Privacy Policy
          </Text>

        </ScrollView>

      </KeyboardAvoidingView>


      {/* ======================================================
          COUNTRY SELECTOR MODAL
      ====================================================== */}

      <Modal
        visible={countryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setCountryModalVisible(false);
          setCountrySearch('');
        }}
      >

        <View style={styles.modalOverlay}>

          <View style={styles.countryModal}>

            {/* HANDLE */}

            <View style={styles.modalHandle} />


            {/* HEADER */}

            <View style={styles.modalHeader}>

              <View>

                <Text style={styles.modalTitle}>
                  Select country
                </Text>

                <Text
                  style={styles.modalSubtitle}
                >
                  Choose your country code
                </Text>

              </View>


              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setCountryModalVisible(false);
                  setCountrySearch('');
                }}
                activeOpacity={0.75}
              >

                <Icon
                  name="close"
                  size={21}
                  color={COLORS.text}
                />

              </TouchableOpacity>

            </View>


            {/* SEARCH */}

            <View style={styles.searchBox}>

              <Icon
                name="search-outline"
                size={19}
                color={COLORS.muted}
              />

              <TextInput
                style={styles.searchInput}
                placeholder="Search country or code"
                placeholderTextColor={
                  COLORS.lightText
                }
                value={countrySearch}
                onChangeText={
                  setCountrySearch
                }
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={
                  COLORS.primary
                }
              />

              {countrySearch.length > 0 && (
                <TouchableOpacity
                  onPress={() =>
                    setCountrySearch('')
                  }
                >
                  <Icon
                    name="close-circle"
                    size={19}
                    color={COLORS.lightText}
                  />
                </TouchableOpacity>
              )}

            </View>


            {/* COUNTRY LIST */}

            <FlatList
              data={filteredCountries}
              keyExtractor={(item, index) =>
                `${item.name}-${item.code}-${index}`
              }
              renderItem={renderCountryItem}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.countryList
              }
              ItemSeparatorComponent={() => (
                <View
                  style={
                    styles.countrySeparator
                  }
                />
              )}
              ListEmptyComponent={
                <View
                  style={styles.emptyCountry}
                >

                  <View
                    style={
                      styles.emptyCountryIcon
                    }
                  >
                    <Icon
                      name="search-outline"
                      size={27}
                      color={COLORS.primary}
                    />
                  </View>

                  <Text
                    style={
                      styles.emptyCountryTitle
                    }
                  >
                    No country found
                  </Text>

                  <Text
                    style={
                      styles.emptyCountryText
                    }
                  >
                    Try another country name
                    or code.
                  </Text>

                </View>
              }
            />

          </View>

        </View>

      </Modal>

    </SafeAreaView>
  );
}


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  flexOne: {
    flex: 1,
  },


  // ==========================================================
  // SCROLL
  // ==========================================================

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },


  // ==========================================================
  // TOP BAR
  // ==========================================================

  topBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logoIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
    position: 'relative',
  },

  logoLeaf: {
    position: 'absolute',
    top: 2,
    right: 3,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },

  logoGreen: {
    color: COLORS.primary,
  },


  // ==========================================================
  // HERO
  // ==========================================================

  heroSection: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 17,
  },

  heroIllustration: {
    width: 190,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 5,
  },

  heroGlowLarge: {
    position: 'absolute',
    top: 72,
    width: 175,
    height: 175,
    borderRadius: 88,
    backgroundColor: '#D8F4E1',
    opacity: 0.6,
  },

  heroGlowSmall: {
    position: 'absolute',
    top: 91,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#C8EFD5',
    opacity: 0.65,
  },

  heroBasket: {
    width: 108,
    height: 80,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,

    shadowColor: '#087C3F',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 7,
  },

  heroBasketLine: {
    position: 'absolute',
    bottom: 13,
    width: 52,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  heroLeafOne: {
    position: 'absolute',
    left: 5,
    top: 34,
    transform: [
      {
        rotate: '-28deg',
      },
    ],
  },

  heroLeafTwo: {
    position: 'absolute',
    right: 9,
    top: 52,
    transform: [
      {
        rotate: '27deg',
      },
    ],
  },

  heroDotOne: {
    position: 'absolute',
    left: 30,
    top: 15,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BCEAC8',
  },

  heroDotTwo: {
    position: 'absolute',
    right: 31,
    top: 19,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9DDFB0',
  },

  heroDotThree: {
    position: 'absolute',
    right: 20,
    bottom: 17,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#B9E8C5',
  },

  welcomeText: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 5,
  },

  brandLarge: {
    fontSize: 37,
    lineHeight: 43,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -1.4,
  },

  brandLargeGreen: {
    color: COLORS.primary,
  },

  tagline: {
    marginTop: 7,
    textAlign: 'center',
    color: COLORS.secondaryText,
    fontSize: 12,
    lineHeight: 21,
    fontWeight: '500',
  },


  // ==========================================================
  // LOGIN CARD
  // ==========================================================

  loginCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 18,

    borderWidth: 1,
    borderColor: COLORS.softBorder,

    shadowColor: '#0F172A',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity:
      Platform.OS === 'ios' ? 0.07 : 0,
    shadowRadius: 18,

    elevation: Platform.OS === 'android' ? 4 : 0,
  },

  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 19,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: -0.2,
  },

  cardSubtitle: {
    marginTop: 4,
    fontSize: 12.5,
    color: COLORS.muted,
    fontWeight: '500',
  },

  secureMiniIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.lightGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },


  // ==========================================================
  // INPUT
  // ==========================================================

  inputLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    color: COLORS.muted,
    marginBottom: 8,
  },

  phoneInput: {
    minHeight: 58,
    borderWidth: 1.2,
    borderColor: '#CFE9D9',
    borderRadius: 16,
    backgroundColor: '#FBFEFC',

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 11,
  },

  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    paddingRight: 4,
  },

  selectedFlag: {
    fontSize: 22,
    marginRight: 6,
  },

  selectedCountryCode: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    marginRight: 3,
  },

  verticalDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#DDE7E1',
    marginHorizontal: 10,
  },

  inputIcon: {
    marginRight: 8,
  },

  inputInner: {
    flex: 1,
    height: 54,
    paddingLeft: 0,
    paddingRight: 4,

    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },


  // ==========================================================
  // HELPER
  // ==========================================================

  helperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    marginBottom: 15,
    paddingHorizontal: 2,
  },

  helperText: {
    flex: 1,
    marginLeft: 6,
    color: COLORS.muted,
    fontSize: 11.5,
    lineHeight: 17,
  },


  // ==========================================================
  // ACTION BUTTON
  // ==========================================================

  actionBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    height: 54,

    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',

    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity:
      Platform.OS === 'ios' ? 0.22 : 0,
    shadowRadius: 10,

    elevation:
      Platform.OS === 'android' ? 4 : 0,
  },

  actionBtnLoading: {
    opacity: 0.78,
  },

  actionBtnTxt: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 15.5,
  },

  arrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.white,

    alignItems: 'center',
    justifyContent: 'center',

    marginLeft: 10,
  },


  // ==========================================================
  // SECURITY
  // ==========================================================

  securityBox: {
    marginTop: 15,
    padding: 12,
    borderRadius: 15,

    backgroundColor: '#F1FBF5',

    flexDirection: 'row',
    alignItems: 'center',
  },

  securityIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,

    backgroundColor: COLORS.lightGreen,

    alignItems: 'center',
    justifyContent: 'center',
  },

  securityContent: {
    flex: 1,
    marginLeft: 10,
  },

  securityTitle: {
    color: COLORS.text,
    fontSize: 12.5,
    fontWeight: '800',
  },

  securityText: {
    color: COLORS.muted,
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 2,
  },


  // ==========================================================
  // BENEFITS
  // ==========================================================

  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
    paddingHorizontal: 7,
  },

  benefitItem: {
    flex: 1,
    alignItems: 'center',
  },

  benefitIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: COLORS.lightGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  benefitTitle: {
    color: COLORS.text,
    fontSize: 11.5,
    fontWeight: '800',
  },

  benefitSub: {
    color: COLORS.muted,
    fontSize: 10.5,
    marginTop: 1,
  },


  // ==========================================================
  // FOOTER
  // ==========================================================

  footerText: {
    textAlign: 'center',
    color: COLORS.lightText,
    fontSize: 9.5,
    lineHeight: 14,
    marginTop: 19,
    paddingHorizontal: 15,
  },


  // ==========================================================
  // MODAL
  // ==========================================================

  modalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(15, 23, 42, 0.42)',
    justifyContent: 'flex-end',
  },

  countryModal: {
    backgroundColor: COLORS.white,

    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,

    maxHeight: '88%',

    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom:
      Platform.OS === 'ios' ? 22 : 15,
  },

  modalHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D7DEE3',
    marginBottom: 16,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  modalTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
  },

  modalSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.muted,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },


  // ==========================================================
  // SEARCH
  // ==========================================================

  searchBox: {
    height: 50,

    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,

    backgroundColor: '#F8FAF9',

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 14,
    marginBottom: 9,
  },

  searchInput: {
    flex: 1,
    height: 48,
    marginLeft: 9,

    color: COLORS.text,
    fontSize: 14,
  },


  // ==========================================================
  // COUNTRY LIST
  // ==========================================================

  countryList: {
    paddingBottom: 10,
  },

  countryItem: {
    minHeight: 62,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 8,
    borderRadius: 15,
  },

  countryItemSelected: {
    backgroundColor: '#ECF9F1',
  },

  countryFlagBox: {
    width: 43,
    height: 43,
    borderRadius: 13,

    backgroundColor: '#F7F9F8',

    alignItems: 'center',
    justifyContent: 'center',
  },

  countryFlag: {
    fontSize: 24,
  },

  countryInfo: {
    flex: 1,
    marginLeft: 11,
  },

  countryName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },

  countryCode: {
    marginTop: 3,
    color: COLORS.muted,
    fontSize: 12,
  },

  selectedCheck: {
    width: 25,
    height: 25,
    borderRadius: 13,

    backgroundColor: COLORS.primary,

    alignItems: 'center',
    justifyContent: 'center',
  },

  countrySeparator: {
    height: 1,
    backgroundColor: '#F1F4F3',
    marginLeft: 62,
  },

  emptyCountry: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
  },

  emptyCountryIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,

    backgroundColor: COLORS.lightGreen,

    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyCountryTitle: {
    marginTop: 12,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },

  emptyCountryText: {
    marginTop: 4,
    color: COLORS.muted,
    fontSize: 12,
  },

});