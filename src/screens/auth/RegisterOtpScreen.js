
import React, {
  useEffect,
  useState,
  useContext,
} from 'react';

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

import Icon from 'react-native-vector-icons/Ionicons';

import {
  getAuth,
  signInWithCredential,
  PhoneAuthProvider,
} from '@react-native-firebase/auth';

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

import {
  getConfirmation,
  clearConfirmation,
} from './phoneSession';

import AuthHeader from '../../components/layout/AuthHeader';
import { AuthContext } from '../../context/AuthContext';

const GREEN = '#0B9D50';
const GREEN_LIGHT = '#ECF9F1';
const GREEN_SOFT = '#DCF6E6';
const DARK = '#0F172A';
const MUTED = '#64748B';
const BORDER = '#E2E8F0';
const WHITE = '#FFFFFF';

export default function RegisterOtpScreen({
  navigation,
  route,
}) {
  const {
    phone,
    mode = 'register',
  } = route.params || {};

  const {
    setRegistrationInProgress,
  } = useContext(AuthContext);

  const confirmation = getConfirmation();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    const backHandler =
      BackHandler.addEventListener(
        'hardwareBackPress',
        handleBack
      );

    return () => backHandler.remove();
  }, [code, seconds]);

  useEffect(() => {
    let t = null;

    if (seconds > 0) {
      t = setTimeout(
        () => setSeconds(seconds - 1),
        1000
      );
    }

    return () => clearTimeout(t);
  }, [seconds]);

  const handleBack = () => {
    if (code.trim() || seconds < 30) {
      Alert.alert(
        mode === 'login'
          ? 'Leave login?'
          : 'Leave registration?',
        'Your verification will be cancelled if you leave.',
        [
          {
            text: 'Continue',
            style: 'cancel',
          },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => navigation.popToTop(),
          },
        ]
      );

      return true;
    }

    return false;
  };

  if (!confirmation) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={GREEN_LIGHT}
        />

        <AuthHeader
          onBack={() => navigation.goBack()}
          showSkip={false}
        />

        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Icon
              name="alert-circle-outline"
              size={36}
              color="#DC2626"
            />
          </View>

          <Text style={styles.errorTitle}>
            Verification session expired
          </Text>

          <Text style={styles.errorText}>
            Invalid session. Please go back and request
            a new code.
          </Text>

          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={styles.errorButtonText}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleVerify = async () => {
    if (loading) return;

    const otp = code.trim();

    if (otp.length !== 6) {
      Alert.alert(
        'Invalid code',
        'Enter the 6-digit code.'
      );
      return;
    }

    const currentConfirmation = getConfirmation();

    if (!currentConfirmation) {
      Alert.alert(
        'Session expired',
        'Please go back and request a new OTP.'
      );
      return;
    }

    const verificationId =
      currentConfirmation?.verificationId;

    if (!verificationId) {
      console.log(
        'OTP CONFIRMATION OBJECT:',
        currentConfirmation
      );

      Alert.alert(
        'Verification failed',
        'OTP session is invalid. Please request a new code.'
      );

      return;
    }

    setLoading(true);

    try {
      const authInstance = getAuth();

      const credential =
        PhoneAuthProvider.credential(
          verificationId,
          otp
        );

      await signInWithCredential(
        authInstance,
        credential
      );

      clearConfirmation();

      const currentUser =
        authInstance.currentUser;

      if (!currentUser?.uid) {
        throw new Error(
          'Unable to get authenticated user.'
        );
      }

      /*
       * EXISTING USER LOGIN
       */
      if (mode === 'login') {
        const uid = currentUser.uid;
        const authInstance = getAuth();
        const db = getFirestore();
        const messagingInstance = getMessaging();

        const customerRef = doc(
          db,
          'customers',
          uid
        );

        /*
         * Save FCM token
         */
        try {
          await requestPermission(
            messagingInstance
          );

          const token = await getToken(
            messagingInstance
          );

          await setDoc(
            customerRef,
            {
              fcmToken: token,
              updatedAt: new Date().toISOString(),
            },
            {
              merge: true,
            }
          );
        } catch (e) {
          console.log(
            'FCM setup skipped:',
            e?.message
          );
        }

        /*
         * Check customer address
         */
        let hasAddress = false;

        try {
          const customerSnap =
            await getDoc(customerRef);

          if (customerSnap.exists()) {
            const customer = customerSnap.data();

            hasAddress = !!(
              customer?.address &&
              customer?.address?.lat != null &&
              customer?.address?.lon != null
            );
          }
        } catch (e) {
          console.log(
            'CUSTOMER PROFILE CHECK ERROR:',
            e?.message
          );
        }

        await setRegistrationInProgress(false);

        /*
         * Existing customer but no address
         */
        if (!hasAddress) {
          navigation.reset({
            index: 0,
            routes: [
              {
                name: 'LocationPickerScreen',
              },
            ],
          });

          return;
        }

        /*
         * Existing customer + address
         * → Dashboard
         */
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'CustomerHome',
            },
          ],
        });

        return;
      }

      if (mode === 'register') {
        await setRegistrationInProgress(true);

        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'RegisterAddress',
              params: {
                phone: phone || '',
              },
            },
          ],
        });

        return;
      }
    } catch (e) {
      console.log(
        'OTP verification error:',
        e
      );

      Alert.alert(
        'Verification failed',
        e?.message ||
          'The verification code is incorrect or expired.'
      );

      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (seconds > 0) return;

    try {
      navigation.pop();
    } catch (e) {
      Alert.alert(
        'Unable to resend',
        'Please try again.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={GREEN_LIGHT}
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
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.brandContainer}>
              <View style={styles.brandIcon}>
                <Icon
                  name="bag-handle"
                  size={27}
                  color={WHITE}
                />
              </View>

              <Text style={styles.logo}>
                Kadai
                <Text style={styles.logoAccent}>
                  App
                </Text>
              </Text>
            </View>

            <View style={styles.heroIconContainer}>
              <View style={styles.heroOuterCircle}>
                <View style={styles.heroInnerCircle}>
                  <Icon
                    name="shield-checkmark"
                    size={49}
                    color={GREEN}
                  />
                </View>
              </View>

              <View style={styles.verifiedBadge}>
                <Icon
                  name="checkmark"
                  size={15}
                  color={WHITE}
                />
              </View>
            </View>

            <Text style={styles.eyebrow}>
              SECURE VERIFICATION
            </Text>

            <Text style={styles.heading}>
              Verify your number
            </Text>

            <Text style={styles.sub}>
              We've sent a 6-digit verification code to
              your mobile number.
            </Text>

            <View style={styles.phoneCard}>
              <View style={styles.phoneIcon}>
                <Icon
                  name="phone-portrait-outline"
                  size={21}
                  color={GREEN}
                />
              </View>

              <View style={styles.phoneDetails}>
                <Text style={styles.phoneLabel}>
                  Verification sent to
                </Text>

                <Text style={styles.phoneNumber}>
                  {phone ? maskPhone(phone) : ''}
                </Text>
              </View>

              <Icon
                name="checkmark-circle"
                size={23}
                color={GREEN}
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>
                ENTER VERIFICATION CODE
              </Text>

              <View style={styles.otpCard}>
                <View style={styles.otpIcon}>
                  <Icon
                    name="keypad-outline"
                    size={23}
                    color={GREEN}
                  />
                </View>

                <TextInput
                  style={styles.otpInput}
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor="#A8B5AE"
                  editable={!loading}
                  autoFocus
                  accessibilityLabel="6-digit verification code"
                />

                {code.length > 0 && (
                  <View style={styles.codeCount}>
                    <Text style={styles.codeCountText}>
                      {code.length}/6
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.inputHint}>
                Enter the 6-digit code to continue
              </Text>
            </View>

            <View style={styles.securityNote}>
              <Icon
                name="lock-closed"
                size={17}
                color={GREEN}
              />

              <Text style={styles.securityText}>
                Your verification is secure and protected.
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.cta,
                loading && styles.ctaDisabled,
              ]}
              onPress={handleVerify}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityLabel="Verify and continue"
            >
              {loading ? (
                <>
                  <Text style={styles.ctaTxt}>
                    Verifying...
                  </Text>

                  <Icon
                    name="hourglass-outline"
                    size={20}
                    color={WHITE}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.ctaTxt}>
                    Verify & Continue
                  </Text>

                  <Icon
                    name="arrow-forward"
                    size={21}
                    color={WHITE}
                  />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.resendCard}>
              <View style={styles.resendIcon}>
                <Icon
                  name="mail-outline"
                  size={20}
                  color={GREEN}
                />
              </View>

              <View style={styles.resendContent}>
                <Text style={styles.small}>
                  Didn't receive the code?
                </Text>

                <TouchableOpacity
                  onPress={handleResend}
                  disabled={seconds > 0}
                  accessibilityLabel="Resend code"
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.resend,
                      seconds > 0 &&
                        styles.resendDisabled,
                    ]}
                  >
                    {seconds > 0
                      ? `Resend in 00:${String(
                          seconds
                        ).padStart(2, '0')}`
                      : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.footerTrust}>
              <Icon
                name="shield-checkmark-outline"
                size={15}
                color="#94A3B8"
              />

              <Text style={styles.footerTrustText}>
                Secure login powered by KadaiApp
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function maskPhone(p) {
  return p
    .replace(/./g, '•')
    .replace(
      /•{5}$/,
      (m) => p.slice(-5)
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GREEN_LIGHT,
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 22,
  },

  content: {
    flexGrow: 1,
    alignItems: 'center',
  },

  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  brandIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  logo: {
    fontSize: 27,
    fontWeight: '900',
    color: DARK,
    letterSpacing: -0.8,
  },

  logoAccent: {
    color: GREEN,
  },

  heroIconContainer: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  heroOuterCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#D7F3E2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroInnerCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C8EED7',
  },

  verifiedBadge: {
    position: 'absolute',
    right: 0,
    bottom: 3,
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: GREEN_LIGHT,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: GREEN,
    letterSpacing: 2,
    marginBottom: 9,
  },

  heading: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '800',
    color: DARK,
    textAlign: 'center',
    letterSpacing: -0.7,
    marginBottom: 10,
  },

  sub: {
    fontSize: 14,
    lineHeight: 22,
    color: MUTED,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 22,
  },

  phoneCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#DDEFE3',
    paddingHorizontal: 15,
    paddingVertical: 13,
    marginBottom: 25,
  },

  phoneIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: GREEN_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  phoneDetails: {
    flex: 1,
  },

  phoneLabel: {
    fontSize: 11,
    color: MUTED,
    marginBottom: 4,
    fontWeight: '500',
  },

  phoneNumber: {
    fontSize: 15,
    color: DARK,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  inputSection: {
    width: '100%',
    marginBottom: 20,
  },

  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 1.4,
    marginBottom: 11,
    textAlign: 'center',
  },

  otpCard: {
    width: '100%',
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#B8E7CA',
    paddingHorizontal: 14,
    shadowColor: '#0B9D50',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },

  otpIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: GREEN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  otpInput: {
    flex: 1,
    minWidth: 0,
    height: 65,
    paddingHorizontal: 2,
    paddingVertical: 0,
    textAlign: 'center',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: 5,
    color: DARK,
    includeFontPadding: false,
  },

  codeCount: {
    backgroundColor: GREEN_LIGHT,
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginLeft: 4,
  },

  codeCountText: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '800',
  },

  inputHint: {
    fontSize: 12,
    color: '#829187',
    textAlign: 'center',
    marginTop: 10,
  },

  securityNote: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E1F6E9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 18,
  },

  securityText: {
    fontSize: 11,
    color: '#367451',
    fontWeight: '600',
    marginLeft: 8,
    flexShrink: 1,
  },

  footer: {
    width: '100%',
    marginTop: 10,
  },

  cta: {
    width: '100%',
    minHeight: 58,
    backgroundColor: GREEN,
    borderRadius: 17,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: GREEN,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.19,
    shadowRadius: 10,
    elevation: 4,
  },

  ctaDisabled: {
    opacity: 0.65,
  },

  ctaTxt: {
    color: WHITE,
    fontWeight: '800',
    fontSize: 16,
    marginRight: 10,
  },

  resendCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: '#E1EEE5',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  resendIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: GREEN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  resendContent: {
    flex: 1,
  },

  small: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 4,
  },

  resend: {
    fontSize: 13,
    color: GREEN,
    fontWeight: '800',
  },

  resendDisabled: {
    color: '#829187',
  },

  footerTrust: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 17,
  },

  footerTrustText: {
    fontSize: 10,
    color: '#94A3B8',
    marginLeft: 6,
    fontWeight: '500',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },

  errorIcon: {
    width: 78,
    height: 78,
    borderRadius: 25,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  errorTitle: {
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '800',
    color: DARK,
    textAlign: 'center',
    marginBottom: 10,
  },

  errorText: {
    fontSize: 14,
    lineHeight: 22,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 24,
  },

  errorButton: {
    backgroundColor: GREEN,
    paddingHorizontal: 35,
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: WHITE,
  },
});
