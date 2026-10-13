import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, StatusBar, Alert, BackHandler, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import {
  getAuth,
  signInWithPhoneNumber,
} from '@react-native-firebase/auth';
import { setConfirmation } from './phoneSession';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, radius, spacing, type } from '../../theme/tokens';
import AuthHeader from '../../components/layout/AuthHeader';

export default function RegisterPhoneScreen({ navigation }) {
  const [phoneCode, setPhoneCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);    

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [phone]);

  const handleBackPress = () => {
    if (phone.trim()) {
      Alert.alert('Leave registration?', 'Your registration progress will be lost. Are you sure you want to leave?', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
      return true;
    }
    return false;
  };

  const validatePhone = (code, number) => {
    const digits = number.replace(/\D/g, '');
    if (!digits) return false;
    if (digits.length < 7 || digits.length > 15) return false;
    return true;
  };

  const handleSendOtp = async () => {
    if (loading) return; // Prevent double-tap
    
    const formatted = `${phoneCode}${phone.replace(/\D/g, '')}`;
    if (!validatePhone(phoneCode, phone)) { 
      Alert.alert('Invalid phone', 'Please enter a valid phone number.');
      return;
    }

    setLoading(true);
    try {
      const confirmation = await signInWithPhoneNumber(
        getAuth(),
        formatted,
      );
      setConfirmation(confirmation);
      navigation.navigate('RegisterOtp', { phone: formatted });
    } catch (e) {
      Alert.alert('Unable to send OTP', e?.message || 'Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} translucent={false} />
      <AuthHeader onBack={handleBackPress} showSkip={false} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={styles.logo}>Kadai<Text style={{ color: colors.brand }}>App</Text></Text>
            <Text style={styles.heading}>Create your account</Text>
            <Text style={styles.sub}>First, verify your mobile number. We'll send a one time code (OTP).</Text>

            <View style={styles.phoneBox}>
              <View style={styles.codeBox}><Text style={styles.codeTxt}>{phoneCode}</Text></View>
              <TextInput 
                style={styles.input} 
                placeholder="Mobile number" 
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                value={phone} 
                onChangeText={setPhone}
                editable={!loading}
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.cta, loading && { opacity: 0.6 }]} 
            onPress={handleSendOtp} 
            disabled={loading}
            accessibilityLabel="Send OTP"
          >
            <Text style={styles.ctaTxt}>{loading ? 'Sending...' : 'Send OTP'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { flexGrow: 1, justifyContent: 'space-between', paddingBottom: spacing.lg },
  content: { flex: 1, justifyContent: 'center' },
  logo: { fontSize: 32, fontWeight: '900', color: colors.ink, marginBottom: spacing.xs },
  heading: { ...type.heading, color: colors.ink, marginBottom: spacing.md, marginTop: spacing.lg },
  sub: { ...type.body, color: colors.muted, marginBottom: spacing.xxxl, lineHeight: 22 },
  phoneBox: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxxl },
  codeBox: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginRight: spacing.md },
  codeTxt: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  input: { flex: 1, height: 52, backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: 16, color: colors.ink },
  cta: { marginTop: spacing.xxl, marginBottom: spacing.md, backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: 16 }
});
