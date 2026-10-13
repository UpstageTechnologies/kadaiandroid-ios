import React, { useContext, useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  Alert,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../../context/AuthContext'; 
import { ThemeContext } from '../../context/ThemeContext'; // ✅ ThemeContext இம்போர்ட் செய்யப்பட்டது
import { db } from '../../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import AppHeader from '../../components/layout/AppHeader'; // ✅ பிரீமியம் ஹெடர் இம்போர்ட்
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete'; // ✅ கூகுள் பிளேசஸ் இம்போர்ட்
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, radius, shadow, spacing } from '../../theme/tokens';

export default function ProfileSettingsScreen({ navigation }) {
  const { logoutUser, user, customerData, loginUser } = useContext(AuthContext);
  
  // ✅ ThemeContext-ல் இருந்து உலகளாவிய தீம் மதிப்புகளை எடுத்தல் (Error வராமல் இருக்க Safe Fallback உடன்)
  const { 
    bgMain = '#f8fafc', 
    bgCard = '#ffffff', 
    textMain = '#1e293b', 
    textSub = '#64748b', 
    border = '#f1f5f9', 
    isDarkMode = false, 
    toggleTheme = () => {} 
  } = useContext(ThemeContext) || {};

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editAddressStr, setEditAddressStr] = useState('');
  const [editPincode, setEditPincode] = useState('');
  
  // Geospatial states for location updates
  const [editLat, setEditLat] = useState(null);
  const [editLon, setEditLon] = useState(null);

  const openEditEngine = () => {
    if (!customerData) return;
    setEditName(customerData.name || '');
    setEditMobile(customerData.mobile || '');
    setEditAddressStr(customerData.address?.googleFormattedAddress || '');
    setEditPincode(customerData.address?.pincode || '');
    setEditLat(customerData.address?.lat || null);
    setEditLon(customerData.address?.lon || null);
    setEditModalVisible(true);
  };

  const handleSaveProfileChanges = async () => {
    if (!editName.trim() || !editMobile.trim() || !editAddressStr.trim() || !editPincode.trim()) {
      Alert.alert("Validation Error", "All registration variables must be structurally defined.");
      return;
    }

    setUpdating(true);
    try {
      const userDocRef = doc(db, "customers", user.uid);
      
      const updatedDataPayload = {
        name: editName.trim(),
        mobile: editMobile.trim(),
        address: {
          ...customerData?.address, 
          googleFormattedAddress: editAddressStr.trim(),
          pincode: editPincode.trim(),
          lat: editLat ? Number(editLat) : (customerData?.address?.lat || null),
          lon: editLon ? Number(editLon) : (customerData?.address?.lon || null)
        }
      };

      await updateDoc(userDocRef, updatedDataPayload);

      if (loginUser) {
        const structuralRefresh = {
          ...customerData,
          ...updatedDataPayload
        };
        loginUser(user, structuralRefresh);
      }

      setEditModalVisible(false);
      Toast.show({
        type: 'success',
        text1: 'Profile Synchronized',
        text2: 'Changes written to Cloud DB instance.'
      });
    } catch (error) {
      console.error("Firestore Profile Mutation Error: ", error);
      Alert.alert("Sync Failure", "Could not commit variables to remote collection server.");
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out of KadaiApp?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Logout", 
          style: "destructive", 
          onPress: async () => {
            try {
              await logoutUser();
              navigation.reset({
                index: 0,
                routes: [{ name: 'CustomerHome' }],
              });
            } catch (error) {
              Alert.alert("Error", "Failed to log out. Try again.");
            }
          } 
        }
      ]
    );
  };

  const SettingItem = ({ title, subtitle, icon, onPress, rightElement }) => (
    <TouchableOpacity 
      style={[styles.settingRow, { borderColor: border }]} 
      onPress={onPress} 
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowLeft}>
        <View style={styles.itemIcon}><Icon name={icon} size={19} color={colors.brand} /></View>
        <View style={styles.textContainer}>
          {/* ✅ Title-ஐ டெக்ஸ்ட் அசைன்மென்ட் ஆக மாற்றாமல் டைனமிக் கலர் வழங்கல் */}
          <Text style={[styles.itemTitle, { color: textMain }]}>{title}</Text>
          {subtitle && <Text style={[styles.itemSubtitle, { color: textSub }]}>{subtitle}</Text>}
        </View>
      </View>
      {rightElement ? rightElement : <Icon name="chevron-right" size={20} color={colors.subtle} />}
    </TouchableOpacity>
  );
return (
    // 👈 edges-ல் இருந்து 'top'-ஐ நீக்கிவிட்டு 'bottom' மட்டும் வைக்கிறோம்
    <SafeAreaView edges={['bottom']} style={[styles.safeAreaViewContainer, { backgroundColor: isDarkMode ? '#131921' : '#ffffff' }]}>
      <AppHeader title="Profile & Settings" navigation={navigation} showBack={true} />

      {/* ✅ ஸ்க்ரோல் வியூ பின்னணி வண்ணம் */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { backgroundColor: bgMain }]}>
        
        {/* Profile Identity Summary Banner */}
        <View style={[styles.profileCard, { backgroundColor: bgCard }]}>
          <View style={styles.avatarBig}>
            {customerData?.name ? <Text style={styles.avatarBigTxt}>{customerData.name.charAt(0).toUpperCase()}</Text> : <Icon name="account" size={32} color="#fff" />}
          </View>
          <View style={styles.profileDetails}>
            <Text style={[styles.userName, { color: textMain }]}>{customerData?.name || 'Guest User'}</Text>
            <Text style={[styles.userEmail, { color: textSub }]}>{customerData?.email || 'Sign in to access profile'}</Text>
            <Text style={[styles.userPhone, { color: textMain }]}>{customerData?.mobile || 'No Phone Bound'}</Text>
            <View style={styles.verifiedBadge}>
              <View style={styles.verifiedRow}><Icon name="check-circle" size={14} color={colors.success} /><Text style={styles.verifiedText}>Verified customer</Text></View>
            </View>
          </View>
        </View>

        {/* Section: Live Account Updates */}
        <Text style={styles.sectionHeader}>Account</Text>
        <View style={[styles.cardGroup, { backgroundColor: bgCard }]}>
          <SettingItem 
            title="Update Personal Information" 
            subtitle="Modify system name, mobile contact & address lines" 
            icon="account-edit-outline"
            onPress={openEditEngine} 
          />
          <SettingItem 
            title="Purchase History & Orders" 
            subtitle="Track live timelines or view invoices" 
            icon="package-variant-closed"
            onPress={() => navigation.navigate('OrdersScreen')} 
          />
        </View>

        {/* Section: App System Configurations */}
        <Text style={styles.sectionHeader}>Preferences</Text>
        <View style={[styles.cardGroup, { backgroundColor: bgCard }]}>
          <SettingItem 
            title="Push Notifications" 
            subtitle="Receive promotional discount events & order updates" 
            icon="bell-outline"
            rightElement={
              <Switch 
                value={notificationsEnabled} 
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: "#cbd5e1", true: "#86efac" }}
                thumbColor={notificationsEnabled ? "#2d9c04" : "#f4f3f4"}
              />
            }
          />
          <SettingItem 
            title="Dark Display Theme" 
            subtitle="Reduce visual strain for late night shopping" 
            icon="theme-light-dark"
            rightElement={
              <Switch 
                value={isDarkMode} 
                onValueChange={toggleTheme} // ✅ toggleTheme கன்டெக்ஸ்ட் ஃபங்க்ஷன் இணைக்கப்பட்டது
                trackColor={{ false: "#cbd5e1", true: "#a5b4fc" }}
                thumbColor={isDarkMode ? "#4f46e5" : "#f4f3f4"}
              />
            }
          />
        </View>

        {/* Support & Safety Compliance */}
        <Text style={styles.sectionHeader}>Support</Text>
        <View style={[styles.cardGroup, { backgroundColor: bgCard }]}>
          <SettingItem title="Help Center & Live Chat" subtitle="24/7 client resolution platform" icon="message-text-outline" />
          <SettingItem title="Terms of Service" subtitle="Review customer safety guidelines" icon="shield-check-outline" />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="logout" size={19} color={colors.danger} /><Text style={styles.logoutButtonText}>Logout account</Text>
        </TouchableOpacity>

        <Text style={[styles.versionString, { color: textSub }]}>KadaiApp Native Engine • v1.0.4 Premium</Text>
      </ScrollView>

      {/* Profile Modification Workspace Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCardContainer, { backgroundColor: bgCard }]}>
            <Text style={[styles.modalHeaderTitle, { color: textMain }]}>Modify Account Details</Text>
            
            <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={{ paddingVertical: 10 }}>
              <Text style={[styles.inputLabel, { color: textMain }]}>Full Name</Text>
              <TextInput 
                style={[styles.modalInput, { backgroundColor: bgMain, color: textMain, borderColor: border }]} 
                value={editName} 
                onChangeText={setEditName} 
                placeholder="Enter Full Name"
                placeholderTextColor={textSub}
              />

              <Text style={[styles.inputLabel, { color: textMain }]}>Mobile Number</Text>
              <TextInput 
                style={[styles.modalInput, { backgroundColor: bgMain, color: textMain, borderColor: border }]} 
                value={editMobile} 
                onChangeText={setEditMobile} 
                keyboardType="phone-pad"
                placeholder="Ex: +919876543210"
                placeholderTextColor={textSub}
              />

              {/* 📍 புதிய கூகுள் லொகேஷன் டிராப்டவுன் சர்ச் பார் மோடலுக்குள் */}
              <Text style={[styles.inputLabel, { color: textMain }]}>Search new location address</Text>
              <View style={styles.modalAutocompleteWrapper}>
                <GooglePlacesAutocomplete
                  placeholder="Type to search location..."
                  fetchDetails={true}
                  minLength={2}
                  debounce={300}
                  enablePoweredByContainer={false}
                  nearbyPlacesAPI="GooglePlacesSearch"
                  onPress={(data, details = null) => {
                    setEditAddressStr(details?.formatted_address || data?.description || "");
                    if (details?.geometry?.location) {
                      setEditLat(details.geometry.location.lat);
                      setEditLon(details.geometry.location.lng);
                    }
                  }}
                  query={{
                    key: 'AIzaSyDh7LkmivSR8am3gPvq0psCR8IH499wj28',
                    language: 'en',
                    components: 'country:in', 
                  }}
                  styles={{
                    textInput: [styles.modalGoogleInput, { backgroundColor: bgMain, color: textMain, borderColor: border }],
                    listView: [styles.modalGoogleListView, { backgroundColor: bgCard, borderColor: border }],
                    row: { backgroundColor: bgCard },
                    description: { color: textMain }
                  }}
                />
              </View>

              {editAddressStr ? (
                <Text style={styles.modalLiveLocationText}>Selected: {editAddressStr}</Text>
              ) : null}

              <Text style={[styles.inputLabel, { color: textMain }]}>Postal Pin Code</Text>
              <TextInput 
                style={[styles.modalInput, { backgroundColor: bgMain, color: textMain, borderColor: border }]} 
                value={editPincode} 
                onChangeText={setEditPincode} 
                keyboardType="number-pad"
                placeholder="Postal PIN"
                placeholderTextColor={textSub}
              />
            </ScrollView>

            {/* Action Row */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn, { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', borderColor: border }]} 
                onPress={() => setEditModalVisible(false)}
                disabled={updating}
              >
                <Text style={[styles.cancelBtnTxt, { color: textMain }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalBtn, styles.saveBtn]} 
                onPress={handleSaveProfileChanges}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" size="small"/>
                ) : (
                  <Text style={styles.saveBtnTxt}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Toast />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  // 👈 நிலையான பேக்கிரவுண்டை நீக்கிவிட்டு flex மற்றும் முக்கியப் பின்னணியை மட்டும் தருகிறோம்
  safeAreaViewContainer: { flex: 1, backgroundColor: 'transparent' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 40},
  profileCard: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    borderRadius: radius.xl,
    padding: 20, 
    marginTop: 20, 
    marginBottom: 10,
    alignItems: 'center',
    ...shadow.card
  },
  avatarBig: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    backgroundColor: colors.brand,
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 16
  },
  avatarBigTxt: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  profileDetails: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  userEmail: { fontSize: 13, color: '#64748b', marginTop: 1 },
  userPhone: { fontSize: 13, color: '#475569', marginTop: 1, fontWeight: '500' },
  verifiedBadge: { 
    backgroundColor: '#f0fdf4', 
    alignSelf: 'flex-start', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 6, 
    marginTop: 6 
  },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { color: '#16a34a', fontSize: 11, fontWeight: '600' },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  cardGroup: { backgroundColor: '#fff', borderRadius: radius.lg, overflow: 'hidden', ...shadow.card },
  settingRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 15, 
    paddingHorizontal: 16, 
    borderBottomWidth: 1, 
    borderColor: '#f1f5f9' 
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  itemIcon: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  textContainer: { flex: 1, paddingRight: 10 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  itemSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  arrowIcon: { fontSize: 12, color: '#cbd5e1', fontWeight: 'bold' },
  logoutButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#fef2f2', 
    borderWidth: 1, 
    borderColor: '#fee2e2', 
    borderRadius: 12, 
    paddingVertical: 14, 
    alignItems: 'center', 
    marginTop: 25 
  },
  logoutButtonText: { color: '#ef4444', fontWeight: '700', fontSize: 14, marginLeft: 7 },
  versionString: { textAlign: 'center', color: '#94a3b8', fontSize: 11, marginTop: 25 },
  
  // Modal Style Definitions
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalCardContainer: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16, textAlign: 'center' },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 10, marginLeft: 2 },
  modalInput: { height: 48, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, fontSize: 14, color: '#0f172a' },
  
  // Custom Styles for Modal Google Autocomplete
  modalAutocompleteWrapper: { zIndex: 6000, marginBottom: 8 },
  modalGoogleInput: { height: 48, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14, backgroundColor: '#f8fafc', color: '#0f172a', fontSize: 14 },
  modalGoogleListView: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4, elevation: 5, maxHeight: 150 },
  modalGoogleRowText: { padding: 12, color: '#0f172a' },
  modalLiveLocationText: { fontSize: 12, color: '#16a34a', fontWeight: '600', marginBottom: 8, paddingHorizontal: 2, marginTop: 2 },

  modalActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, paddingBottom: Platform.OS === 'ios' ? 20 : 5 },
  modalBtn: { flex: 1, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },
  cancelBtn: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  cancelBtnTxt: { color: '#475569', fontWeight: '600', fontSize: 14 },
  saveBtn: { backgroundColor: colors.brand },
  saveBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 }
});
