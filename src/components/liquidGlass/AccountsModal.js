import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  TextInput,
  Switch,
  Share,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, doc, updateDoc, setDoc } from '@react-native-firebase/firestore';
import { TEXTURED_DARK, TEXTURED_LIGHT } from './theme';
import { triggerHaptic } from './safeHaptics';
import {
  fetchUserSavedAddresses,
  saveActiveLocation,
  deleteSavedAddress,
  DEFAULT_USER_LOCATION,
  normalizeAddressPayload,
} from '../../services/locationService';
import { DeliveryLocationFlowModal } from './AddressManagementModals';

// Curated High-Definition Avatar Presets for Quick Selection
const AVATAR_PRESETS = [
  {
    id: 'av1',
    label: 'Pro Male',
    labelTa: 'தொழில்முறை',
    uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'av2',
    label: 'Pro Female',
    labelTa: 'தொழில்முறை பெண்',
    uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'av3',
    label: 'Casual Guy',
    labelTa: 'நவீன இளைஞன்',
    uri: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'av4',
    label: 'Cheerful Girl',
    labelTa: 'மகிழ்ச்சியான பெண்',
    uri: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'av5',
    label: 'Urban Modern',
    labelTa: 'நகர்ப்புற இளைஞன்',
    uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'av6',
    label: 'Friendly Smile',
    labelTa: 'புன்னகை முகம்',
    uri: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'av7',
    label: '3D Bot Hero',
    labelTa: '3D ரோபோ ஹீரோ',
    uri: 'https://api.dicebear.com/7.x/bottts/png?seed=UpstageHero&size=200',
  },
  {
    id: 'av8',
    label: '3D Kadai Star',
    labelTa: '3D கடை ஸ்டார்',
    uri: 'https://api.dicebear.com/7.x/avataaars/png?seed=KadaiStar&size=200',
  },
];

export const AccountsModal = ({
  visible = false,
  onClose,
  user = null,
  customerData = null,
  orders = [],
  language = 'en',
  onToggleLanguage,
  isDarkMode = true,
  themePreference = 'system',
  onChangeThemePreference,
  onToggleTheme,
  onLogout,
  onTrackOrder,
  favorites = {},
  onToggleFavorite,
  products = [],
  cart = {},
  onAddToCart,
  onUpdateCartQty,
  userLocation = null,
  onUpdateLocation,
  onExploreProducts,
}) => {
  // Navigation Tabs: 'settings' | 'orders' | 'wishlist' | 'addresses' | 'payments'
  const [activeTab, setActiveTab] = useState('settings');
  const isTamil = language === 'ta';
  const theme = isDarkMode ? TEXTURED_DARK : TEXTURED_LIGHT;

  // Local Profile Override State (for instant feedback when editing profile)
  const [localProfile, setLocalProfile] = useState({
    name: customerData?.name || user?.displayName || 'Niruban',
    phone: user?.phoneNumber || customerData?.mobile || '9442461428',
    email: customerData?.email || user?.email || '',
    photoURL: customerData?.photoURL || user?.photoURL || '',
  });

  // Sync incoming props to local profile
  useEffect(() => {
    setLocalProfile({
      name: customerData?.name || user?.displayName || localProfile.name || 'Niruban',
      phone: user?.phoneNumber || customerData?.mobile || localProfile.phone || '9442461428',
      email: customerData?.email || user?.email || localProfile.email || '',
      photoURL: customerData?.photoURL || user?.photoURL || localProfile.photoURL || '',
    });
  }, [customerData, user]);

  // Load cached profile if any
  useEffect(() => {
    AsyncStorage.getItem('@kadai_cached_profile').then(raw => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.name) {
            setLocalProfile(prev => ({
              ...prev,
              name: customerData?.name || parsed.name,
              phone: customerData?.mobile || user?.phoneNumber || parsed.phone || prev.phone,
              email: customerData?.email || parsed.email || prev.email,
              photoURL: customerData?.photoURL || user?.photoURL || parsed.photoURL || prev.photoURL || '',
            }));
          }
        } catch (e) {}
      }
    }).catch(() => {});
  }, []);

  // ----------------------------------------------------
  // 1. EDIT PROFILE INFORMATION MODAL STATE
  // ----------------------------------------------------
  const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isPhotoModalVisible, setIsPhotoModalVisible] = useState(false);
  const [customPhotoInput, setCustomPhotoInput] = useState('');

  const handleOpenEditProfile = () => {
    triggerHaptic('light');
    setEditName(localProfile.name || '');
    setEditPhone(localProfile.phone || '');
    setEditEmail(localProfile.email || '');
    setEditPhotoURL(localProfile.photoURL || '');
    setCustomPhotoInput('');
    setIsEditProfileVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert(isTamil ? 'பெயர் தேவை' : 'Name Required', isTamil ? 'தயவுசெய்து உங்கள் பெயரை உள்ளிடவும்.' : 'Please enter your name.');
      return;
    }
    if (!editPhone.trim()) {
      Alert.alert(isTamil ? 'தொலைபேசி எண் தேவை' : 'Phone Required', isTamil ? 'தயவுசெய்து உங்கள் மொபைல் எண்ணை உள்ளிடவும்.' : 'Please enter your mobile number.');
      return;
    }

    setIsSavingProfile(true);
    triggerHaptic('medium');

    try {
      const updatedPayload = {
        name: editName.trim(),
        mobile: editPhone.trim(),
        email: editEmail.trim(),
        photoURL: editPhotoURL.trim(),
      };

      // 1. Update Firestore if user is authenticated
      if (user?.uid) {
        const db = getFirestore();
        const userDocRef = doc(db, 'customers', user.uid);
        await updateDoc(userDocRef, updatedPayload).catch(async () => {
          await setDoc(userDocRef, updatedPayload, { merge: true });
        });
      }

      // 2. Cache locally
      await AsyncStorage.setItem('@kadai_cached_profile', JSON.stringify(updatedPayload));

      // 3. Update local state
      setLocalProfile(prev => ({ ...prev, ...updatedPayload }));

      setIsSavingProfile(false);
      setIsEditProfileVisible(false);
      triggerHaptic('success');

      Alert.alert(
        isTamil ? 'வெற்றி' : 'Profile Updated',
        isTamil ? 'உங்கள் சுயவிவர விவரங்கள் வெற்றிகரமாக சேமிக்கப்பட்டன.' : 'Your profile information has been saved successfully.'
      );
    } catch (error) {
      console.log('Error updating profile:', error);
      setIsSavingProfile(false);
      Alert.alert(
        isTamil ? 'பிழை' : 'Error',
        isTamil ? 'சுயவிவரத்தைப் புதுப்பிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Failed to update profile. Please try again.'
      );
    }
  };

  // ----------------------------------------------------
  // 2. SAVED ADDRESSES SECTION STATE
  // ----------------------------------------------------
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [isAddressFlowModalVisible, setIsAddressFlowModalVisible] = useState(false);

  const loadSavedAddresses = async () => {
    setLoadingAddresses(true);
    try {
      const list = await fetchUserSavedAddresses(user?.uid);
      setSavedAddresses(list || []);
    } catch (e) {
      console.log('Error loading saved addresses:', e);
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    if (visible && (activeTab === 'addresses' || activeTab === 'settings')) {
      loadSavedAddresses();
    }
  }, [visible, activeTab, user?.uid]);

  const handleDeleteAddress = item => {
    triggerHaptic('medium');
    const label = item.tag || item.city || item.area || 'Address';
    Alert.alert(
      isTamil ? 'முகவரியை நீக்குவதா?' : 'Delete Address?',
      isTamil ? `"${label}" என்ற முகவரியை நீக்க விரும்புகிறீர்களா?` : `Are you sure you want to delete "${label}"?`,
      [
        { text: isTamil ? 'ரத்து' : 'Cancel', style: 'cancel' },
        {
          text: isTamil ? 'நீக்கு' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('medium');
              await deleteSavedAddress(user?.uid, item.id, item);
              setSavedAddresses(prev => prev.filter(a => a.id !== item.id));
              triggerHaptic('success');
            } catch (err) {
              console.log('Error deleting address:', err);
            }
          },
        },
      ]
    );
  };

  const handleSelectAddressAsActive = addr => {
    triggerHaptic('light');
    const normalized = normalizeAddressPayload(addr);
    if (onUpdateLocation) {
      onUpdateLocation(normalized);
    }
    saveActiveLocation(user?.uid, normalized);
    Alert.alert(
      isTamil ? 'டெலிவரி இடம் மாறியது' : 'Delivery Location Set',
      isTamil
        ? `இனி உங்கள் ஆர்டர்கள் "${addr.tag || 'முகவரி'}" (${addr.city || ''}) என்ற இடத்திற்கு டெலிவரி செய்யப்படும்.`
        : `Active delivery destination set to "${addr.tag || 'Address'}" (${addr.city || ''}).`
    );
  };

  // ----------------------------------------------------
  // 3. WISHLIST DATA COMPUTATION
  // ----------------------------------------------------
  const wishlistProducts = (products || []).filter(p => favorites && favorites[p.id]);

  // ----------------------------------------------------
  // 4. UPSTAGE KADAI INFORMATION MODALS & ACTIONS
  // ----------------------------------------------------
  const [isAboutUsVisible, setIsAboutUsVisible] = useState(false);
  const [isPrivacyVisible, setIsPrivacyVisible] = useState(false);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);

  // Notification Preferences State
  const [notifOrderUpdates, setNotifOrderUpdates] = useState(true);
  const [notifOffers, setNotifOffers] = useState(true);
  const [notifWhatsapp, setNotifWhatsapp] = useState(true);
  const [notifRestock, setNotifRestock] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@kadai_notification_prefs').then(raw => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed) {
            if (typeof parsed.orderUpdates === 'boolean') setNotifOrderUpdates(parsed.orderUpdates);
            if (typeof parsed.offers === 'boolean') setNotifOffers(parsed.offers);
            if (typeof parsed.whatsapp === 'boolean') setNotifWhatsapp(parsed.whatsapp);
            if (typeof parsed.restock === 'boolean') setNotifRestock(parsed.restock);
          }
        } catch (e) {}
      }
    }).catch(() => {});
  }, []);

  const handleSaveNotifPref = (key, value) => {
    triggerHaptic('light');
    let next = {
      orderUpdates: notifOrderUpdates,
      offers: notifOffers,
      whatsapp: notifWhatsapp,
      restock: notifRestock,
      [key]: value,
    };
    if (key === 'orderUpdates') setNotifOrderUpdates(value);
    if (key === 'offers') setNotifOffers(value);
    if (key === 'whatsapp') setNotifWhatsapp(value);
    if (key === 'restock') setNotifRestock(value);

    AsyncStorage.setItem('@kadai_notification_prefs', JSON.stringify(next)).catch(() => {});
  };

  // Share App Action
  const handleShareApp = async () => {
    triggerHaptic('medium');
    try {
      await Share.share({
        title: isTamil ? 'Upstage கடை - உள்ளூர் சந்தை' : 'Upstage Kadai - Hyperlocal Shopping',
        message: isTamil
          ? 'வணக்கம்! நான் Upstage Kadai மூலம் 15 நிமிடங்களில் அருகிலுள்ள உள்ளூர் கடைகளில் இருந்து புதிய காய்கறிகள் & மளிகைப் பொருட்களை வாங்குகிறேன். நீங்களும் பதிவிறக்கவும்: https://upstagekadai.app/download'
          : 'Hey! I am ordering fresh groceries & daily essentials from trusted neighborhood shops in 15 minutes using Upstage Kadai. Download now: https://upstagekadai.app/download',
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  // Logout Action
  const handleLogout = () => {
    triggerHaptic('medium');
    Alert.alert(
      isTamil ? 'வெளியேறு' : 'Logout',
      isTamil ? 'நீங்கள் நிச்சயமாக கணக்கிலிருந்து வெளியேற விரும்புகிறீர்களா?' : 'Are you sure you want to log out of Upstage Kadai?',
      [
        { text: isTamil ? 'ரத்து' : 'Cancel', style: 'cancel' },
        {
          text: isTamil ? 'வெளியேறு' : 'Logout',
          style: 'destructive',
          onPress: () => {
            if (onClose) onClose();
            if (onLogout) onLogout();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: isDarkMode ? '#080E0A' : '#F8FAFC' },
        ]}
      >
        {/* Grab handle */}
        <View style={styles.grabHandleBar}>
          <View style={[styles.grabHandle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
        </View>

        {/* Modal Header */}
        <View style={[styles.header, { borderBottomColor: theme.glassBorder }]}>
          <TouchableOpacity
            style={[
              styles.closeBtn,
              {
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                borderColor: theme.glassBorder,
              },
            ]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={theme.textWhite} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: theme.textWhite }]}>
            {isTamil ? 'கணக்கு & அமைப்புகள்' : 'Account & Settings'}
          </Text>

          <TouchableOpacity
            style={[
              styles.langPillHeader,
              {
                backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7',
                borderColor: theme.neonGreen,
              },
            ]}
            onPress={onToggleLanguage}
            activeOpacity={0.75}
          >
            <Ionicons name="language" size={13} color={theme.neonGreen} />
            <Text style={[styles.langPillHeaderText, { color: theme.neonGreen }]}>
              {isTamil ? 'தமிழ்' : 'ENG'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* REDESIGNED LIQUID GLASS MEMBER PROFILE CARD */}
          <View
            style={[
              styles.profileCard,
              {
                backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.2)',
              },
            ]}
          >
            {/* TOP ROW: AVATAR + IDENTITY + EDIT BUTTON */}
            <View style={styles.profileHeaderRow}>
              {/* Avatar with Glow Ring & Photo Support */}
              <View style={styles.avatarWrapper}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleOpenEditProfile}
                  style={[
                    styles.profileAvatarCircle,
                    {
                      backgroundColor: isDarkMode ? '#13281C' : '#E8F5EB',
                      borderColor: theme.neonGreen,
                    },
                  ]}
                >
                  {localProfile.photoURL ? (
                    <Image
                      source={{ uri: localProfile.photoURL }}
                      style={styles.profileAvatarImage}
                    />
                  ) : (
                    <Text style={[styles.profileAvatarInitials, { color: theme.neonGreen }]}>
                      {localProfile.name
                        ? localProfile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                        : 'UK'}
                    </Text>
                  )}
                </TouchableOpacity>
                <View
                  style={[
                    styles.verifiedOnlineDot,
                    { borderColor: isDarkMode ? '#0E1710' : '#FFFFFF' },
                  ]}
                />
              </View>

              {/* Name & Membership Badge */}
              <View style={styles.profileMainIdentity}>
                <View style={styles.profileNameRow}>
                  <Text style={[styles.profileName, { color: theme.textWhite }]} numberOfLines={1}>
                    {localProfile.name}
                  </Text>
                </View>

                {/* Upstage Gold Pill */}
                <View style={styles.memberStatusPill}>
                  <Ionicons name="star" size={10} color="#D97706" />
                  <Text style={styles.memberStatusText}>Upstage Gold Member</Text>
                </View>
              </View>

              {/* Sleek Edit Profile Action */}
              <TouchableOpacity
                style={[
                  styles.editProfileBtn,
                  {
                    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#DCFCE7',
                    borderColor: theme.neonGreen,
                  },
                ]}
                onPress={handleOpenEditProfile}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil" size={12} color="#10B981" />
                <Text style={[styles.editProfileBtnText, { color: '#10B981' }]}>
                  {isTamil ? 'திருத்து' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* CONTACT INFO CONTAINER (STACKED 2-ROW TO COMPLETELY PREVENT OVERFLOW) */}
            <View
              style={[
                styles.profileMetaContainer,
                {
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              {/* Phone Row */}
              <View style={styles.metaRowItem}>
                <View
                  style={[
                    styles.metaIconWrap,
                    { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' },
                  ]}
                >
                  <Ionicons name="call" size={11} color="#10B981" />
                </View>
                <Text style={[styles.metaRowLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {isTamil ? 'அலைபேசி' : 'Phone'}
                </Text>
                <Text
                  style={[styles.metaRowValue, { color: theme.textWhite }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {localProfile.phone || '+91 94424 61428'}
                </Text>
              </View>

              {/* Subtle Horizontal Divider */}
              <View style={[styles.metaHorizontalDivider, { backgroundColor: theme.glassBorder }]} />

              {/* Email Row */}
              <View style={styles.metaRowItem}>
                <View
                  style={[
                    styles.metaIconWrap,
                    { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#DBEAFE' },
                  ]}
                >
                  <Ionicons
                    name="mail"
                    size={11}
                    color={localProfile.email ? '#3B82F6' : theme.textMuted}
                  />
                </View>
                <Text style={[styles.metaRowLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {isTamil ? 'மின்னஞ்சல்' : 'Email'}
                </Text>
                <Text
                  style={[
                    styles.metaRowValue,
                    {
                      color: localProfile.email ? theme.textWhite : theme.textMuted,
                      flex: 1,
                      flexShrink: 1,
                    },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {localProfile.email || (isTamil ? 'மின்னஞ்சல் சேர்க்கப்படவில்லை' : 'No email added')}
                </Text>
              </View>
            </View>

            {/* ACTIVE DELIVERY DESTINATION PILL */}
            <View style={[styles.deliveryPillRow, { borderTopColor: theme.glassBorder }]}>
              <View style={styles.deliveryPillLeft}>
                <View
                  style={[
                    styles.locationIconWrap,
                    { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' },
                  ]}
                >
                  <Ionicons name="location" size={14} color="#10B981" />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text
                    style={[
                      styles.deliveryPillLabel,
                      { color: isDarkMode ? '#A7F3D0' : '#15803D' },
                    ]}
                  >
                    {isTamil ? 'செயலில் உள்ள டெலிவரி இடம்' : 'Active Delivery Destination'}
                  </Text>
                  <Text
                    style={[styles.deliveryPillAddress, { color: theme.textWhite }]}
                    numberOfLines={1}
                  >
                    {userLocation?.street ||
                      userLocation?.area ||
                      customerData?.address?.street ||
                      customerData?.address?.area ||
                      'Padanthal, Sattur'}
                  </Text>
                </View>
              </View>
              <View style={styles.hyperlocal15Badge}>
                <Ionicons name="flash" size={10} color="#10B981" />
                <Text style={styles.hyperlocal15Text}>15 MIN</Text>
              </View>
            </View>

            {/* QUICK MEMBER STATS RIBBON */}
            <View
              style={[
                styles.statsRibbon,
                {
                  backgroundColor: isDarkMode ? '#132018' : '#F1F9F4',
                  borderColor: isDarkMode
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(16, 185, 129, 0.25)',
                },
              ]}
            >
              <TouchableOpacity
                style={styles.statsRibbonCol}
                onPress={() => {
                  triggerHaptic('light');
                  setActiveTab('orders');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.statsRibbonVal, { color: theme.neonGreen }]}>
                  {orders.length}
                </Text>
                <Text
                  style={[
                    styles.statsRibbonLbl,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  {isTamil ? 'ஆர்டர்கள்' : 'Orders'}
                </Text>
              </TouchableOpacity>

              <View
                style={[
                  styles.statsRibbonDivider,
                  { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
                ]}
              />

              <TouchableOpacity
                style={styles.statsRibbonCol}
                onPress={() => {
                  triggerHaptic('light');
                  setActiveTab('wishlist');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.statsRibbonVal, { color: '#EF4444' }]}>
                  {wishlistProducts.length}
                </Text>
                <Text
                  style={[
                    styles.statsRibbonLbl,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  {isTamil ? 'விருப்பம்' : 'Wishlist'}
                </Text>
              </TouchableOpacity>

              <View
                style={[
                  styles.statsRibbonDivider,
                  { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
                ]}
              />

              <View style={styles.statsRibbonCol}>
                <Text style={[styles.statsRibbonVal, { color: '#F59E0B' }]}>₹120</Text>
                <Text
                  style={[
                    styles.statsRibbonLbl,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  {isTamil ? 'கேஷ்பேக்' : 'Cashback'}
                </Text>
              </View>
            </View>
          </View>

          {/* REDESIGNED HORIZONTAL SCROLLABLE TABS BAR */}
          <View style={styles.tabBarContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsScrollTrack}
            >
              {[
                {
                  id: 'settings',
                  icon: activeTab === 'settings' ? 'grid' : 'grid-outline',
                  label: isTamil ? 'அமைப்புகள்' : 'Dashboard',
                },
                {
                  id: 'wishlist',
                  icon: activeTab === 'wishlist' ? 'heart' : 'heart-outline',
                  label: isTamil ? 'விருப்பம்' : 'Wishlist',
                  badge: wishlistProducts.length,
                },
                {
                  id: 'addresses',
                  icon: activeTab === 'addresses' ? 'location' : 'location-outline',
                  label: isTamil ? 'முகவரிகள்' : 'Addresses',
                  badge: savedAddresses.length,
                },
                {
                  id: 'orders',
                  icon: activeTab === 'orders' ? 'receipt' : 'receipt-outline',
                  label: isTamil ? 'ஆர்டர்கள்' : 'Orders',
                  badge: orders.length,
                },
                {
                  id: 'payments',
                  icon: activeTab === 'payments' ? 'card' : 'card-outline',
                  label: isTamil ? 'பணம் & UPI' : 'Payments',
                },
              ].map(tab => {
                const active = activeTab === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[
                      styles.tabPill,
                      {
                        backgroundColor: active
                          ? theme.neonGreen
                          : isDarkMode
                          ? 'rgba(255, 255, 255, 0.05)'
                          : '#FFFFFF',
                        borderColor: active
                          ? '#34D399'
                          : isDarkMode
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.08)',
                      },
                      active && styles.tabPillActive,
                    ]}
                    onPress={() => {
                      triggerHaptic('light');
                      setActiveTab(tab.id);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={tab.icon}
                      size={15}
                      color={active ? '#050906' : isDarkMode ? '#94A3B8' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.tabPillText,
                        {
                          color: active ? '#050906' : theme.textWhite,
                          fontWeight: active ? '800' : '600',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {tab.label}
                    </Text>
                    {typeof tab.badge === 'number' && tab.badge > 0 ? (
                      <View
                        style={[
                          styles.tabPillBadge,
                          {
                            backgroundColor: active
                              ? '#050906'
                              : isDarkMode
                              ? 'rgba(16, 185, 129, 0.2)'
                              : '#DCFCE7',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabPillBadgeText,
                            {
                              color: active ? theme.neonGreen : isDarkMode ? '#6EE7B7' : '#15803D',
                            },
                          ]}
                        >
                          {tab.badge}
                        </Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ==================================================== */}
          {/* TAB 1: SETTINGS OVERVIEW                             */}
          {/* ==================================================== */}
          {activeTab === 'settings' && (
            <View style={styles.settingsSection}>
              {/* Quick Jump Row: Wishlist & Saved Addresses */}
              <View style={styles.quickAccessRow}>
                <TouchableOpacity
                  style={[
                    styles.quickAccessCard,
                    {
                      backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                      borderColor: theme.glassBorder,
                    },
                  ]}
                  onPress={() => {
                    triggerHaptic('light');
                    setActiveTab('wishlist');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.quickAccessIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <Ionicons name="heart" size={18} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.quickAccessTitle, { color: theme.textWhite }]}>
                      {isTamil ? 'விருப்பப்பட்டியல்' : 'My Wishlist'}
                    </Text>
                    <Text style={[styles.quickAccessSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      {wishlistProducts.length} {isTamil ? 'பொருட்கள்' : 'saved items'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickAccessCard,
                    {
                      backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                      borderColor: theme.glassBorder,
                    },
                  ]}
                  onPress={() => {
                    triggerHaptic('light');
                    setActiveTab('addresses');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.quickAccessIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Ionicons name="location" size={18} color="#10B981" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.quickAccessTitle, { color: theme.textWhite }]}>
                      {isTamil ? 'முகவரிகள்' : 'Saved Addresses'}
                    </Text>
                    <Text style={[styles.quickAccessSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      {savedAddresses.length} {isTamil ? 'முகவரிகள்' : 'locations'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Language Switch */}
              <TouchableOpacity
                style={[
                  styles.settingRow,
                  {
                    backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                    borderColor: theme.glassBorder,
                  },
                ]}
                onPress={onToggleLanguage}
                activeOpacity={0.75}
              >
                <View style={styles.settingRowLeft}>
                  <Ionicons name="language" size={20} color={theme.neonGreen} />
                  <Text style={[styles.settingRowText, { color: theme.textWhite }]}>
                    {isTamil ? 'பயன்பாட்டு மொழி (Language)' : 'App Language'}
                  </Text>
                </View>
                <View style={styles.languageBadge}>
                  <Text style={styles.languageBadgeText}>
                    {isTamil ? 'தமிழ் (Tamil)' : 'English (US)'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </View>
              </TouchableOpacity>

              {/* Theme Mode Selector Card (System | Light | Dark) */}
              <View
                style={[
                  styles.themeModeCard,
                  {
                    backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <View style={styles.themeHeaderRow}>
                  <View style={styles.settingRowLeft}>
                    <Ionicons
                      name={
                        themePreference === 'system'
                          ? 'hardware-chip-outline'
                          : isDarkMode
                          ? 'moon'
                          : 'sunny'
                      }
                      size={20}
                      color={theme.neonGreen}
                    />
                    <View>
                      <Text style={[styles.settingRowText, { color: theme.textWhite }]}>
                        {isTamil ? 'திரை வடிவம் (Theme Mode)' : 'Theme Mode'}
                      </Text>
                      <Text style={[styles.themeCaptionText, { color: isDarkMode ? '#A7F3D0' : '#64748B' }]}>
                        {themePreference === 'system'
                          ? (isTamil ? `சாதன அமைப்பு (${isDarkMode ? 'இருள்' : 'வெளிச்சம்'})` : `Follows System (${isDarkMode ? 'Dark' : 'Light'})`)
                          : themePreference === 'light'
                          ? (isTamil ? 'எப்போதும் வெளிச்சம்' : 'Always Light Mode')
                          : (isTamil ? 'எப்போதும் இருள்' : 'Always Dark Mode')}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 3-Segment Buttons: System | Light | Dark */}
                <View
                  style={[
                    styles.themeSegmentTrack,
                    {
                      backgroundColor: isDarkMode ? '#132018' : '#F1F5F9',
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                >
                  {[
                    { key: 'system', icon: 'hardware-chip-outline', label: isTamil ? 'கணினி' : 'System' },
                    { key: 'light', icon: 'sunny-outline', label: isTamil ? 'வெளிச்சம்' : 'Light' },
                    { key: 'dark', icon: 'moon-outline', label: isTamil ? 'இருள்' : 'Dark' },
                  ].map(item => {
                    const isSelected = themePreference === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[
                          styles.themeSegmentBtn,
                          isSelected && [
                            styles.themeSegmentBtnActive,
                            { backgroundColor: theme.neonGreen },
                          ],
                        ]}
                        onPress={() => {
                          triggerHaptic('light');
                          if (onChangeThemePreference) {
                            onChangeThemePreference(item.key);
                          } else if (onToggleTheme) {
                            onToggleTheme();
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={item.icon}
                          size={15}
                          color={isSelected ? '#050906' : theme.textWhite}
                        />
                        <Text
                          style={[
                            styles.themeSegmentBtnText,
                            {
                              color: isSelected ? '#050906' : theme.textWhite,
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* UPSTAGE KADAI INFORMATION SECTION */}
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="sparkles" size={14} color={theme.neonGreen} />
                <Text style={[styles.sectionHeadingText, { color: isDarkMode ? '#A7F3D0' : '#15803D' }]}>
                  {isTamil ? 'Upstage கடை தகவல்கள்' : 'Upstage Kadai Information'}
                </Text>
              </View>

              <View
                style={[
                  styles.infoCardGroup,
                  {
                    backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                {/* 1. About Us */}
                <TouchableOpacity
                  style={[styles.infoRow, { borderBottomColor: theme.glassBorder }]}
                  onPress={() => {
                    triggerHaptic('light');
                    setIsAboutUsVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.infoRowLeft}>
                    <View style={[styles.infoIconWrap, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' }]}>
                      <Ionicons name="information-circle-outline" size={18} color="#10B981" />
                    </View>
                    <View style={styles.infoTextContainer}>
                      <Text style={[styles.infoRowTitle, { color: theme.textWhite }]}>
                        {isTamil ? 'எங்களை பற்றி (About Us)' : 'About Us'}
                      </Text>
                      <Text style={[styles.infoRowSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        {isTamil ? '15 நிமிட உள்ளூர் டெலிவரி மற்றும் எங்கள் நோக்கம்' : '15-min hyperlocal delivery & mission'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>

                {/* 2. Account Privacy */}
                <TouchableOpacity
                  style={[styles.infoRow, { borderBottomColor: theme.glassBorder }]}
                  onPress={() => {
                    triggerHaptic('light');
                    setIsPrivacyVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.infoRowLeft}>
                    <View style={[styles.infoIconWrap, { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#DBEAFE' }]}>
                      <Ionicons name="shield-checkmark-outline" size={18} color="#3B82F6" />
                    </View>
                    <View style={styles.infoTextContainer}>
                      <Text style={[styles.infoRowTitle, { color: theme.textWhite }]}>
                        {isTamil ? 'கணக்கு தனியுரிமை (Account Privacy)' : 'Account Privacy'}
                      </Text>
                      <Text style={[styles.infoRowSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        {isTamil ? 'தரவு பாதுகாப்பு & இருப்பிட அனுமதிகள்' : 'Data protection, GPS & privacy terms'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>

                {/* 3. Notification Preferences */}
                <TouchableOpacity
                  style={[styles.infoRow, { borderBottomColor: theme.glassBorder }]}
                  onPress={() => {
                    triggerHaptic('light');
                    setIsNotificationsVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.infoRowLeft}>
                    <View style={[styles.infoIconWrap, { backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7' }]}>
                      <Ionicons name="notifications-outline" size={18} color="#F59E0B" />
                    </View>
                    <View style={styles.infoTextContainer}>
                      <Text style={[styles.infoRowTitle, { color: theme.textWhite }]}>
                        {isTamil ? 'அறிவிப்பு விருப்பங்கள் (Notification Preferences)' : 'Notification Preferences'}
                      </Text>
                      <Text style={[styles.infoRowSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        {isTamil ? 'ஆர்டர் நிலைகள், சலுகைகள் & வாட்ஸ்அப் விழிப்பூட்டல்கள்' : 'Order status, offers & WhatsApp alerts'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>

                {/* 4. Share App */}
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={handleShareApp}
                  activeOpacity={0.7}
                >
                  <View style={styles.infoRowLeft}>
                    <View style={[styles.infoIconWrap, { backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.15)' : '#F3E8FF' }]}>
                      <Ionicons name="share-social-outline" size={18} color="#A855F7" />
                    </View>
                    <View style={styles.infoTextContainer}>
                      <Text style={[styles.infoRowTitle, { color: theme.textWhite }]}>
                        {isTamil ? 'செயலியைப் பகிரவும் (Share App)' : 'Share App'}
                      </Text>
                      <Text style={[styles.infoRowSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        {isTamil ? 'நண்பர்களுடன் உள்ளூர் ஷாப்பிங்கைப் பகிரவும்' : 'Invite friends & neighbors to shop local'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Support */}
              <TouchableOpacity
                style={[
                  styles.settingRow,
                  {
                    backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                    borderColor: theme.glassBorder,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  Alert.alert(
                    isTamil ? 'வாடிக்கையாளர் உதவி' : 'Customer Support',
                    isTamil
                      ? 'Upstage Kadai 24/7 வாடிக்கையாளர் உதவிக்கு support@upstagekadai.app என்ற முகவரிக்கு தொடர்பு கொள்ளவும்.'
                      : 'For 24/7 support or order queries, reach out to support@upstagekadai.app.'
                  );
                }}
                activeOpacity={0.75}
              >
                <View style={styles.settingRowLeft}>
                  <Ionicons name="headset-outline" size={20} color={theme.neonGreen} />
                  <Text style={[styles.settingRowText, { color: theme.textWhite }]}>
                    {isTamil ? '24/7 வாடிக்கையாளர் உதவி' : '24/7 Local Help & Support'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>

              {/* Upstage POS Merchant Partnership Promo */}
              <View
                style={[
                  styles.merchantPromoCard,
                  {
                    backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.10)' : '#DCFCE7',
                    borderColor: theme.neonGreen,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="storefront" size={18} color="#10B981" />
                  <Text style={[styles.merchantPromoTitle, { color: theme.neonGreen }]}>
                    Upstage POS Merchant Network
                  </Text>
                </View>
                <Text style={[styles.merchantPromoSub, { color: isDarkMode ? '#A7F3D0' : '#166534' }]}>
                  {isTamil
                    ? 'உங்கள் கடையை Upstage POS மூலம் இணைத்து 3 கி.மீ வாடிக்கையாளர்களுக்கு விற்கவும்.'
                    : 'Run a retail shop? Register with Upstage POS to start receiving hyperlocal orders.'}
                </Text>
              </View>

              {/* Logout Button */}
              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                <Text style={styles.logoutBtnText}>
                  {isTamil ? 'வெளியேறு (Logout)' : 'Log Out'}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.versionText, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
                Upstage Kadai • v1.2.0 Ultra Hyperlocal Edition
              </Text>
            </View>
          )}

          {/* ==================================================== */}
          {/* TAB 2: WISHLIST SECTION                              */}
          {/* ==================================================== */}
          {activeTab === 'wishlist' && (
            <View style={styles.wishlistSection}>
              <View style={styles.tabSectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="heart" size={18} color="#EF4444" />
                  <Text style={[styles.tabSectionTitle, { color: theme.textWhite }]}>
                    {isTamil ? 'எனது விருப்பப்பட்டியல்' : 'My Saved Wishlist'}
                  </Text>
                </View>
                <View style={[styles.wishlistCountBadge, { backgroundColor: isDarkMode ? '#132018' : '#DCFCE7' }]}>
                  <Text style={[styles.wishlistCountBadgeText, { color: theme.neonGreen }]}>
                    {wishlistProducts.length} {isTamil ? 'பொருட்கள்' : 'items'}
                  </Text>
                </View>
              </View>

              {wishlistProducts.length === 0 ? (
                <View style={styles.emptyWishlistContainer}>
                  <View style={[styles.emptyWishlistIconWrap, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#FEE2E2' }]}>
                    <Ionicons name="heart-dislike-outline" size={36} color="#EF4444" />
                  </View>
                  <Text style={[styles.emptyWishlistTitle, { color: theme.textWhite }]}>
                    {isTamil ? 'விருப்பப்பட்டியல் காலியாக உள்ளது' : 'Your Wishlist is Empty'}
                  </Text>
                  <Text style={[styles.emptyWishlistSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    {isTamil
                      ? 'பொருட்களின் மீதுள்ள ❤️ இதயக் குறியீட்டைத் தட்டி உங்களுக்குப் பிடித்தவற்றை இங்கே சேமிக்கலாம்.'
                      : 'Tap the heart icon on any product to save it here for fast re-ordering.'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.exploreBtn, { backgroundColor: theme.neonGreen }]}
                    onPress={() => {
                      triggerHaptic('light');
                      if (onExploreProducts) onExploreProducts();
                      onClose();
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="bag-handle" size={16} color="#050906" />
                    <Text style={styles.exploreBtnText}>
                      {isTamil ? 'பொருட்களைப் பார்க்க' : 'Explore Store'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.wishlistGrid}>
                  {wishlistProducts.map(item => {
                    const inCart = cart && cart[item.id] ? (cart[item.id].qty || 1) : 0;
                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.wishlistCard,
                          {
                            backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                            borderColor: theme.glassBorder,
                          },
                        ]}
                      >
                        <View style={[styles.wishlistImgWrap, { backgroundColor: isDarkMode ? '#132018' : '#F8FAFC' }]}>
                          <Image
                            source={{ uri: item.img || 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80' }}
                            style={styles.wishlistImg}
                            resizeMode="cover"
                          />
                          <TouchableOpacity
                            style={styles.wishlistRemoveHeartBtn}
                            onPress={() => {
                              triggerHaptic('light');
                              if (onToggleFavorite) onToggleFavorite(item.id);
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="heart" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.wishlistContent}>
                          <Text style={[styles.wishlistProductName, { color: theme.textWhite }]} numberOfLines={1}>
                            {isTamil && item.nameTa ? item.nameTa : item.name}
                          </Text>
                          <Text style={[styles.wishlistUnit, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                            {item.unit || item.weight || '250 g'} • {item.shopName || 'Store'}
                          </Text>

                          <View style={styles.wishlistPriceRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                              <Text style={[styles.wishlistPrice, { color: theme.neonGreen }]}>
                                ₹{item.price}
                              </Text>
                              {item.mrp > item.price && (
                                <Text style={styles.wishlistMrp}>₹{item.mrp}</Text>
                              )}
                            </View>

                            {inCart === 0 ? (
                              <TouchableOpacity
                                style={[styles.wishlistAddBtn, { backgroundColor: theme.neonGreen }]}
                                onPress={() => {
                                  triggerHaptic('light');
                                  if (onAddToCart) onAddToCart(item);
                                }}
                                activeOpacity={0.8}
                              >
                                <Ionicons name="add" size={14} color="#050906" />
                                <Text style={styles.wishlistAddBtnText}>
                                  {isTamil ? 'சேர்' : 'ADD'}
                                </Text>
                              </TouchableOpacity>
                            ) : (
                              <View style={[styles.wishlistStepper, { backgroundColor: theme.neonGreen }]}>
                                <TouchableOpacity
                                  style={styles.wishlistStepperBtn}
                                  onPress={() => {
                                    triggerHaptic('light');
                                    if (onUpdateCartQty) onUpdateCartQty(item.id, 'remove');
                                  }}
                                >
                                  <Text style={styles.wishlistStepperText}>−</Text>
                                </TouchableOpacity>
                                <Text style={styles.wishlistStepperQty}>{inCart}</Text>
                                <TouchableOpacity
                                  style={styles.wishlistStepperBtn}
                                  onPress={() => {
                                    triggerHaptic('light');
                                    if (onUpdateCartQty) onUpdateCartQty(item.id, 'add');
                                  }}
                                >
                                  <Text style={styles.wishlistStepperText}>+</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ==================================================== */}
          {/* TAB 3: SAVED ADDRESSES SECTION                       */}
          {/* ==================================================== */}
          {activeTab === 'addresses' && (
            <View style={styles.addressesSection}>
              <View style={styles.tabSectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="location" size={18} color="#10B981" />
                  <Text style={[styles.tabSectionTitle, { color: theme.textWhite }]}>
                    {isTamil ? 'சேமிக்கப்பட்ட முகவரிகள்' : 'Saved Delivery Addresses'}
                  </Text>
                </View>

                {/* Add Address Mini Button */}
                <TouchableOpacity
                  style={[styles.addNewAddressTopBtn, { backgroundColor: theme.neonGreen }]}
                  onPress={() => {
                    triggerHaptic('light');
                    setIsAddressFlowModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={14} color="#050906" />
                  <Text style={styles.addNewAddressTopBtnText}>
                    {isTamil ? 'புதிய முகவரி' : 'Add New'}
                  </Text>
                </TouchableOpacity>
              </View>

              {loadingAddresses ? (
                <View style={styles.loaderCenter}>
                  <ActivityIndicator size="small" color={theme.neonGreen} />
                  <Text style={[styles.loadingText, { color: theme.neonGreen }]}>
                    {isTamil ? 'முகவரிகள் ஏற்றப்படுகின்றன...' : 'Loading saved addresses...'}
                  </Text>
                </View>
              ) : savedAddresses.length === 0 ? (
                <View style={styles.emptyAddressesContainer}>
                  <Ionicons name="location-outline" size={42} color="#94A3B8" />
                  <Text style={[styles.emptyWishlistTitle, { color: theme.textWhite }]}>
                    {isTamil ? 'சேமிக்கப்பட்ட முகவரிகள் இல்லை' : 'No Saved Addresses Yet'}
                  </Text>
                  <Text style={[styles.emptyWishlistSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    {isTamil
                      ? 'உங்கள் வீடு, அலுவலகம் அல்லது பிற முகவரிகளைச் சேர்த்து விரைவாக ஆர்டர் செய்யுங்கள்.'
                      : 'Add your home, office, or other locations for seamless checkout.'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.exploreBtn, { backgroundColor: theme.neonGreen }]}
                    onPress={() => {
                      triggerHaptic('light');
                      setIsAddressFlowModalVisible(true);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add-circle" size={16} color="#050906" />
                    <Text style={styles.exploreBtnText}>
                      {isTamil ? 'புதிய முகவரி சேர்க்க' : 'Add Delivery Address'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {savedAddresses.map((item, idx) => {
                    const isActive =
                      (userLocation?.id && userLocation?.id === item.id) ||
                      (userLocation?.formattedAddress && userLocation?.formattedAddress === item.formattedAddress);

                    const tagIcon =
                      item.tag === 'Home'
                        ? 'home'
                        : item.tag === 'Work'
                        ? 'briefcase'
                        : item.tag === 'Hotel'
                        ? 'business'
                        : 'location';

                    return (
                      <View
                        key={item.id || idx}
                        style={[
                          styles.addressCard,
                          {
                            backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                            borderColor: isActive ? theme.neonGreen : theme.glassBorder,
                            borderWidth: isActive ? 1.8 : 1,
                          },
                        ]}
                      >
                        <View style={styles.addressCardHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={[styles.addressTagIconWrap, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' }]}>
                              <Ionicons name={tagIcon} size={14} color="#10B981" />
                            </View>
                            <Text style={[styles.addressTagText, { color: theme.textWhite }]}>
                              {item.tag || 'Home'}
                            </Text>
                            {isActive && (
                              <View style={[styles.activeAddressBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                                <Text style={styles.activeAddressBadgeText}>
                                  {isTamil ? 'செயலில் உள்ளது' : 'ACTIVE'}
                                </Text>
                              </View>
                            )}
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <TouchableOpacity
                              onPress={() => handleSelectAddressAsActive(item)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={[
                                styles.iosCheckCircle,
                                {
                                  borderColor: isActive
                                    ? '#10B981'
                                    : isDarkMode
                                      ? 'rgba(148, 163, 184, 0.45)'
                                      : '#CBD5E1',
                                  backgroundColor: isActive
                                    ? '#10B981'
                                    : isDarkMode
                                      ? 'rgba(255, 255, 255, 0.03)'
                                      : '#FFFFFF',
                                },
                              ]}
                            >
                              {isActive && <View style={styles.iosRadioInnerDot} />}
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteAddress(item)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <Text style={[styles.addressStreetText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                          {item.completeAddress || item.street || item.formattedAddress}
                        </Text>
                        <Text style={[styles.addressSubText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                          {[item.area, item.city, item.district, item.pincode].filter(Boolean).join(', ')}
                        </Text>

                        {item.receiverPhone ? (
                          <Text style={[styles.addressContactText, { color: isDarkMode ? '#6EE7B7' : '#059669' }]}>
                            👤 {item.receiverName || 'Customer'} • 📞 {item.receiverPhone}
                          </Text>
                        ) : null}

                        {!isActive ? (
                          <TouchableOpacity
                            style={[
                              styles.deliverHereBtn,
                              {
                                backgroundColor: isDarkMode ? '#132018' : '#F1F5F9',
                                borderColor: theme.neonGreen,
                              },
                            ]}
                            onPress={() => handleSelectAddressAsActive(item)}
                            activeOpacity={0.8}
                          >
                            <View
                              style={[
                                styles.iosCheckCircleSm,
                                { borderColor: theme.neonGreen },
                              ]}
                            />
                            <Text style={[styles.deliverHereBtnText, { color: theme.neonGreen }]}>
                              {isTamil ? 'இந்த முகவரிக்கு டெலிவரி செய்' : 'Deliver to this address'}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ==================================================== */}
          {/* TAB 4: ORDERS SECTION                                */}
          {/* ==================================================== */}
          {activeTab === 'orders' && (
            <View style={styles.ordersSection}>
              {orders.length === 0 ? (
                <View style={styles.emptyOrders}>
                  <Ionicons name="receipt-outline" size={48} color="#94A3B8" />
                  <Text style={[styles.emptyOrdersText, { color: theme.textWhite }]}>
                    {isTamil ? 'ஆர்டர்கள் எதுவும் இல்லை' : 'No past orders yet'}
                  </Text>
                  <Text style={styles.emptyOrdersSub}>
                    {isTamil
                      ? 'உங்கள் அருகிலுள்ள கடைகளில் ஆர்டர் செய்யுங்கள்'
                      : 'Place an order from nearby shops to track it here'}
                  </Text>
                </View>
              ) : (
                orders.map((order, i) => (
                  <TouchableOpacity
                    key={order.id || i}
                    style={[
                      styles.orderCard,
                      {
                        backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                        borderColor: theme.glassBorder,
                      },
                    ]}
                    onPress={() => onTrackOrder && onTrackOrder(order.orderId || order.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.orderTopRow}>
                      <Text style={[styles.orderIdText, { color: theme.neonGreen }]}>
                        #{order.orderId || order.id}
                      </Text>
                      <View style={styles.orderStatusBadge}>
                        <Text style={styles.orderStatusText}>
                          {order.status || 'Active'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.orderShopName, { color: theme.textWhite }]}>
                      {order.orderedShops?.[0]?.shopName || order.shopName || (isTamil ? 'உள்ளூர் கடை' : 'Neighborhood Store')}
                    </Text>
                    <View style={styles.orderBottomRow}>
                      <Text style={styles.orderItemsCount}>
                        {Array.isArray(order.items) ? order.items.length : 1} {isTamil ? 'பொருட்கள்' : 'items'}
                      </Text>
                      <Text style={[styles.orderPrice, { color: theme.neonGreen }]}>
                        ₹{Number(order.totalAmount || order.total || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* ==================================================== */}
          {/* TAB 5: PAYMENTS SECTION                              */}
          {/* ==================================================== */}
          {activeTab === 'payments' && (
            <View style={styles.settingsSection}>
              <View
                style={[
                  styles.paymentOptionCard,
                  {
                    backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="flash" size={20} color="#22C55E" />
                  <View>
                    <Text style={[styles.paymentMethodTitle, { color: theme.textWhite }]}>
                      Instant UPI (GPay / PhonePe / Paytm)
                    </Text>
                    <Text style={styles.paymentMethodSub}>Verified & Supported</Text>
                  </View>
                </View>
                <View style={[styles.iosCheckCircle, { backgroundColor: '#10B981', borderColor: '#10B981' }]}>
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                </View>
              </View>

              <View
                style={[
                  styles.paymentOptionCard,
                  {
                    backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="cash-outline" size={20} color="#F59E0B" />
                  <View>
                    <Text style={[styles.paymentMethodTitle, { color: theme.textWhite }]}>
                      Cash on Delivery (COD)
                    </Text>
                    <Text style={styles.paymentMethodSub}>Pay cash to local delivery partner</Text>
                  </View>
                </View>
                <View style={[styles.iosCheckCircle, { backgroundColor: '#10B981', borderColor: '#10B981' }]}>
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                </View>
              </View>
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>

        {/* ==================================================== */}
        {/* EDIT PROFILE MODAL (Liquid Glass)                    */}
        {/* ==================================================== */}
        <Modal
          visible={isEditProfileVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsEditProfileVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.sheetModalContainer, { backgroundColor: isDarkMode ? '#080E0A' : '#F8FAFC' }]}
          >
            <View style={styles.grabHandleBar}>
              <View style={[styles.grabHandle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
            </View>

            <View style={[styles.header, { borderBottomColor: theme.glassBorder }]}>
              <TouchableOpacity
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                    borderColor: theme.glassBorder,
                  },
                ]}
                onPress={() => setIsEditProfileVisible(false)}
              >
                <Ionicons name="close" size={20} color={theme.textWhite} />
              </TouchableOpacity>

              <Text style={[styles.headerTitle, { color: theme.textWhite }]}>
                {isTamil ? 'சுயவிவரத்தைத் திருத்து' : 'Edit Profile Information'}
              </Text>

              <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={styles.editProfileAvatarWrap}>
                <TouchableOpacity
                  style={styles.editAvatarTouchArea}
                  onPress={() => {
                    triggerHaptic('light');
                    setIsPhotoModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.editProfileAvatarCircle,
                      {
                        backgroundColor: isDarkMode ? '#13281C' : '#E8F5EB',
                        borderColor: theme.neonGreen,
                      },
                    ]}
                  >
                    {editPhotoURL ? (
                      <Image source={{ uri: editPhotoURL }} style={styles.editProfileAvatarImg} />
                    ) : (
                      <Text style={[styles.editProfileAvatarInitials, { color: theme.neonGreen }]}>
                        {editName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'UK'}
                      </Text>
                    )}
                  </View>

                  {/* Camera overlay badge */}
                  <View style={styles.editAvatarCameraBadge}>
                    <Ionicons name="camera" size={13} color="#050906" />
                  </View>
                </TouchableOpacity>

                {/* Photo Action Buttons */}
                <View style={styles.photoActionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.changePhotoBtn,
                      {
                        backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7',
                        borderColor: theme.neonGreen,
                      },
                    ]}
                    onPress={() => {
                      triggerHaptic('light');
                      setIsPhotoModalVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="image-outline" size={13} color={theme.neonGreen} />
                    <Text style={[styles.changePhotoBtnText, { color: theme.neonGreen }]}>
                      {editPhotoURL
                        ? (isTamil ? 'புகைப்படம் மாற்று' : 'Change Photo')
                        : (isTamil ? 'புகைப்படம் சேர்' : 'Add Photo')}
                    </Text>
                  </TouchableOpacity>

                  {editPhotoURL ? (
                    <TouchableOpacity
                      style={[
                        styles.removePhotoBtn,
                        {
                          backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#FEE2E2',
                          borderColor: '#EF4444',
                        },
                      ]}
                      onPress={() => {
                        triggerHaptic('light');
                        setEditPhotoURL('');
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={13} color="#EF4444" />
                      <Text style={styles.removePhotoBtnText}>
                        {isTamil ? 'நீக்கு' : 'Remove'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text style={[styles.editProfileNotice, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {isTamil
                    ? 'புகைப்படத்தை மாற்ற படத்தைத் தட்டவும்'
                    : 'Tap the avatar circle or button to pick a photo'}
                </Text>
              </View>

              {/* Input 1: Full Name */}
              <Text style={[styles.inputLabel, { color: isDarkMode ? '#E2E8F0' : '#1E293B' }]}>
                {isTamil ? 'முழுப் பெயர்*' : 'Full Name*'}
              </Text>
              <View style={[styles.inputBox, { backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF', borderColor: theme.glassBorder }]}>
                <Ionicons name="person-outline" size={18} color="#10B981" />
                <TextInput
                  style={[styles.textInputField, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}
                  placeholder={isTamil ? 'உங்கள் பெயர்...' : 'Enter your full name...'}
                  placeholderTextColor="#94A3B8"
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>

              {/* Input 2: Mobile Number */}
              <Text style={[styles.inputLabel, { color: isDarkMode ? '#E2E8F0' : '#1E293B', marginTop: 16 }]}>
                {isTamil ? 'தொலைபேசி எண்*' : 'Phone Number*'}
              </Text>
              <View style={[styles.inputBox, { backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF', borderColor: theme.glassBorder }]}>
                <Ionicons name="call-outline" size={18} color="#10B981" />
                <TextInput
                  style={[styles.textInputField, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}
                  placeholder={isTamil ? '10 இலக்க எண்...' : 'Enter 10-digit mobile number...'}
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  value={editPhone}
                  onChangeText={setEditPhone}
                />
              </View>

              {/* Input 3: Email */}
              <Text style={[styles.inputLabel, { color: isDarkMode ? '#E2E8F0' : '#1E293B', marginTop: 16 }]}>
                {isTamil ? 'மின்னஞ்சல் முகவரி (விருப்பமானது)' : 'Email Address (Optional)'}
              </Text>
              <View style={[styles.inputBox, { backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF', borderColor: theme.glassBorder }]}>
                <Ionicons name="mail-outline" size={18} color="#10B981" />
                <TextInput
                  style={[styles.textInputField, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}
                  placeholder={isTamil ? 'மின்னஞ்சல் முகவரி...' : 'Enter email address...'}
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={editEmail}
                  onChangeText={setEditEmail}
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[
                  styles.saveProfileBtn,
                  { backgroundColor: '#10B981' },
                  isSavingProfile && { opacity: 0.7 },
                ]}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
                activeOpacity={0.85}
              >
                {isSavingProfile ? (
                  <ActivityIndicator color="#050906" size="small" />
                ) : (
                  <Text style={styles.saveProfileBtnText}>
                    {isTamil ? 'மாற்றங்களைச் சேமிக்க ➔' : 'Save Changes ➔'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        {/* ==================================================== */}
        {/* PROFILE PHOTO PICKER MODAL (Liquid Glass)            */}
        {/* ==================================================== */}
        <Modal
          visible={isPhotoModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsPhotoModalVisible(false)}
        >
          <View style={[styles.sheetModalContainer, { backgroundColor: isDarkMode ? '#080E0A' : '#F8FAFC' }]}>
            <View style={styles.grabHandleBar}>
              <View style={[styles.grabHandle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
            </View>

            <View style={[styles.header, { borderBottomColor: theme.glassBorder }]}>
              <TouchableOpacity
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                    borderColor: theme.glassBorder,
                  },
                ]}
                onPress={() => setIsPhotoModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={theme.textWhite} />
              </TouchableOpacity>

              <Text style={[styles.headerTitle, { color: theme.textWhite }]}>
                {isTamil ? 'சுயவிவரப் படம்' : 'Choose Profile Photo'}
              </Text>

              <TouchableOpacity
                style={[styles.modalHeaderDoneBtn, { backgroundColor: '#10B981' }]}
                onPress={() => {
                  triggerHaptic('light');
                  setIsPhotoModalVisible(false);
                }}
              >
                <Text style={styles.modalHeaderDoneBtnText}>{isTamil ? 'சரி' : 'Done'}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              {/* CURRENT PHOTO PREVIEW */}
              <View style={styles.photoPickerPreviewWrap}>
                <View
                  style={[
                    styles.photoPickerPreviewCircle,
                    {
                      borderColor: theme.neonGreen,
                      backgroundColor: isDarkMode ? '#13281C' : '#E8F5EB',
                    },
                  ]}
                >
                  {editPhotoURL ? (
                    <Image source={{ uri: editPhotoURL }} style={styles.photoPickerPreviewImg} />
                  ) : (
                    <Text style={[styles.photoPickerPreviewInitials, { color: theme.neonGreen }]}>
                      {editName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'UK'}
                    </Text>
                  )}
                </View>
                <Text style={[styles.photoPickerPreviewText, { color: theme.textWhite }]}>
                  {editPhotoURL
                    ? (isTamil ? 'தேர்ந்தெடுக்கப்பட்ட படம்' : 'Selected Avatar')
                    : (isTamil ? 'எழுத்து சின்னம் (படம் இல்லை)' : 'Default Initials (No Photo)')}
                </Text>
                {editPhotoURL ? (
                  <TouchableOpacity
                    style={[styles.removeSelectedPhotoBtn, { borderColor: '#EF4444' }]}
                    onPress={() => {
                      triggerHaptic('light');
                      setEditPhotoURL('');
                    }}
                  >
                    <Ionicons name="trash-outline" size={13} color="#EF4444" />
                    <Text style={styles.removeSelectedPhotoText}>
                      {isTamil ? 'படத்தை நீக்கு' : 'Remove Photo'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* SECTION: 3D & MEMOJI PRESETS */}
              <View style={styles.photoSectionHeader}>
                <Ionicons name="sparkles" size={16} color="#10B981" />
                <Text style={[styles.photoSectionTitle, { color: theme.textWhite }]}>
                  {isTamil ? 'அவதார் தொகுப்பிலிருந்து தேர்வு செய்' : 'Choose from Curated Avatars'}
                </Text>
              </View>

              <View style={styles.avatarGrid}>
                {AVATAR_PRESETS.map(preset => {
                  const isSelected = editPhotoURL === preset.uri;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.avatarGridItem,
                        {
                          backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                          borderColor: isSelected ? theme.neonGreen : theme.glassBorder,
                        },
                        isSelected && styles.avatarGridItemSelected,
                      ]}
                      onPress={() => {
                        triggerHaptic('light');
                        setEditPhotoURL(preset.uri);
                      }}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: preset.uri }} style={styles.avatarGridImg} />
                      <Text
                        style={[
                          styles.avatarGridLabel,
                          { color: isSelected ? theme.neonGreen : (isDarkMode ? '#94A3B8' : '#64748B') },
                        ]}
                        numberOfLines={1}
                      >
                        {isTamil ? preset.labelTa : preset.label}
                      </Text>
                      <View
                        style={[
                          styles.avatarSelectedBadge,
                          {
                            backgroundColor: isSelected
                              ? '#10B981'
                              : isDarkMode
                                ? 'rgba(15, 23, 42, 0.7)'
                                : '#FFFFFF',
                            borderColor: isSelected
                              ? '#10B981'
                              : isDarkMode
                                ? 'rgba(148, 163, 184, 0.45)'
                                : '#CBD5E1',
                          },
                        ]}
                      >
                        {isSelected && <Ionicons name="checkmark" size={10} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* SECTION: CUSTOM IMAGE URL INPUT */}
              <View style={[styles.photoSectionHeader, { marginTop: 24 }]}>
                <Ionicons name="link" size={16} color="#3B82F6" />
                <Text style={[styles.photoSectionTitle, { color: theme.textWhite }]}>
                  {isTamil ? 'அல்லது இணையப் பட முகவரி (URL)' : 'Or Custom Image Link (URL)'}
                </Text>
              </View>

              <View
                style={[
                  styles.customUrlInputRow,
                  {
                    backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF',
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <TextInput
                  style={[styles.customUrlField, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}
                  placeholder={isTamil ? 'https://images.com/my-photo.jpg' : 'https://... image link'}
                  placeholderTextColor="#94A3B8"
                  value={customPhotoInput}
                  onChangeText={setCustomPhotoInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[
                    styles.applyUrlBtn,
                    {
                      backgroundColor: customPhotoInput.trim() ? '#10B981' : (isDarkMode ? '#1E293B' : '#E2E8F0'),
                    },
                  ]}
                  disabled={!customPhotoInput.trim()}
                  onPress={() => {
                    if (customPhotoInput.trim().startsWith('http')) {
                      triggerHaptic('success');
                      setEditPhotoURL(customPhotoInput.trim());
                      setCustomPhotoInput('');
                      Alert.alert(
                        isTamil ? 'படம் சேர்க்கப்பட்டது' : 'Photo Applied',
                        isTamil ? 'உங்கள் தனிப்பயன் படம் சேர்க்கப்பட்டது.' : 'Your custom photo URL was applied.'
                      );
                    } else {
                      Alert.alert(
                        isTamil ? 'தவறான முகவரி' : 'Invalid URL',
                        isTamil ? 'தயவுசெய்து சரியான பட இணைய முகவரியை (http/https) உள்ளிடவும்.' : 'Please enter a valid HTTP/HTTPS image URL.'
                      );
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.applyUrlBtnText,
                      { color: customPhotoInput.trim() ? '#050906' : '#94A3B8' },
                    ]}
                  >
                    {isTamil ? 'பயன்படுத்து' : 'Apply'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* ==================================================== */}
        {/* ABOUT US MODAL (Liquid Glass)                        */}
        {/* ==================================================== */}
        <Modal
          visible={isAboutUsVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsAboutUsVisible(false)}
        >
          <View style={[styles.sheetModalContainer, { backgroundColor: isDarkMode ? '#080E0A' : '#F8FAFC' }]}>
            <View style={styles.grabHandleBar}>
              <View style={[styles.grabHandle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
            </View>

            <View style={[styles.header, { borderBottomColor: theme.glassBorder }]}>
              <TouchableOpacity
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                    borderColor: theme.glassBorder,
                  },
                ]}
                onPress={() => setIsAboutUsVisible(false)}
              >
                <Ionicons name="close" size={20} color={theme.textWhite} />
              </TouchableOpacity>

              <Text style={[styles.headerTitle, { color: theme.textWhite }]}>
                {isTamil ? 'எங்களை பற்றி' : 'About Upstage Kadai'}
              </Text>

              <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={styles.infoModalHeroCard}>
                <View style={styles.infoModalLogoCircle}>
                  <Ionicons name="storefront" size={28} color="#10B981" />
                </View>
                <Text style={[styles.infoModalBrandName, { color: theme.textWhite }]}>
                  Upstage Kadai • உள்ளூர் சந்தை
                </Text>
                <View style={styles.versionBadgePill}>
                  <Text style={styles.versionBadgePillText}>v1.2.0 • Ultra Hyperlocal Edition</Text>
                </View>
              </View>

              <View style={[styles.infoSectionCard, { backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF', borderColor: theme.glassBorder }]}>
                <Text style={[styles.infoCardHeading, { color: theme.neonGreen }]}>
                  {isTamil ? 'எங்கள் நோக்கம் (Our Mission)' : 'Our Mission'}
                </Text>
                <Text style={[styles.infoCardParagraph, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                  {isTamil
                    ? 'Upstage Kadai என்பது தமிழ்நாட்டின் மிக விரைவான உள்ளூர் ஷாப்பிங் தளம். உங்கள் அருகில் உள்ள நுகர்வோர் கடைகள், காய்கறி அங்காடிகள் மற்றும் பாரம்பரிய வியாபாரிகளை 1 முதல் 3 கி.மீ சுற்றளவில் உள்ள வாடிக்கையாளர்களுடன் 15 நிமிடங்களில் இணைக்கிறது.'
                    : 'Upstage Kadai is Tamil Nadu’s lightning-fast hyperlocal commerce platform. We directly connect neighborhood kirana stores, fruit & vegetable mandis, and local retailers with nearby customers within 1 to 3 km in under 15 minutes.'}
                </Text>
              </View>

              <View style={{ gap: 10, marginVertical: 14 }}>
                {[
                  {
                    icon: 'flash-outline',
                    color: '#10B981',
                    title: isTamil ? '15 நிமிட மின்னல் டெலிவரி' : '15-Minute Local Delivery',
                    desc: isTamil ? 'உங்கள் பகுதியின் கடைகளிலிருந்து உடனடியாக டெலிவரி.' : 'Dispatched instantly from verified neighborhood sellers.',
                  },
                  {
                    icon: 'storefront-outline',
                    color: '#3B82F6',
                    title: isTamil ? '100% உண்மையான உள்ளூர் கடைகள்' : '100% Neighborhood Merchants',
                    desc: isTamil ? 'Upstage POS மூலம் இணைக்கப்பட்ட நம்பிக்கையான உள்ளூர் வியாபாரிகள்.' : 'Powered by genuine Upstage POS store networks.',
                  },
                  {
                    icon: 'shield-checkmark-outline',
                    color: '#F59E0B',
                    title: isTamil ? 'நேர்மையான விலைகள் & சர்ஜ் கட்டணமில்லை' : 'Fair Pricing, Zero Surge Fees',
                    desc: isTamil ? 'மறைமுக கட்டணங்கள் இன்றி நியாயமான உள்ளூர் விலை.' : 'Transparent neighborhood prices directly from stores.',
                  },
                ].map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.featurePillarCard,
                      { backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF', borderColor: theme.glassBorder },
                    ]}
                  >
                    <View style={[styles.featurePillarIconWrap, { backgroundColor: `${item.color}20` }]}>
                      <Ionicons name={item.icon} size={20} color={item.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.featurePillarTitle, { color: theme.textWhite }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.featurePillarDesc, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        {item.desc}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.madeWithLoveRow}>
                <Text style={{ fontSize: 13, color: isDarkMode ? '#94A3B8' : '#64748B' }}>
                  Made with ❤️ in Tamil Nadu, India
                </Text>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* ==================================================== */}
        {/* ACCOUNT PRIVACY MODAL (Liquid Glass)                 */}
        {/* ==================================================== */}
        <Modal
          visible={isPrivacyVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsPrivacyVisible(false)}
        >
          <View style={[styles.sheetModalContainer, { backgroundColor: isDarkMode ? '#080E0A' : '#F8FAFC' }]}>
            <View style={styles.grabHandleBar}>
              <View style={[styles.grabHandle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
            </View>

            <View style={[styles.header, { borderBottomColor: theme.glassBorder }]}>
              <TouchableOpacity
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                    borderColor: theme.glassBorder,
                  },
                ]}
                onPress={() => setIsPrivacyVisible(false)}
              >
                <Ionicons name="close" size={20} color={theme.textWhite} />
              </TouchableOpacity>

              <Text style={[styles.headerTitle, { color: theme.textWhite }]}>
                {isTamil ? 'கணக்கு தனியுரிமை' : 'Account Privacy'}
              </Text>

              <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={styles.privacyHeroWrap}>
                <View style={[styles.privacyHeroIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <Ionicons name="shield-checkmark" size={32} color="#3B82F6" />
                </View>
                <Text style={[styles.privacyHeroTitle, { color: theme.textWhite }]}>
                  {isTamil ? 'உங்கள் தரவு பாதுகாப்பு & தனியுரிமை' : 'Your Privacy & Data Protection'}
                </Text>
                <Text style={[styles.privacyHeroSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {isTamil
                    ? 'Upstage Kadai உங்கள் தனிப்பட்ட தகவல்களை பாதுகாப்பாக கையாள்கிறது.'
                    : 'We adhere to the highest standards of data security and user consent.'}
                </Text>
              </View>

              <View style={{ gap: 12 }}>
                {[
                  {
                    icon: 'lock-closed-outline',
                    title: isTamil ? 'வங்கி அளவிலான குறியாக்கம்' : 'End-to-End Encryption',
                    desc: isTamil
                      ? 'உங்கள் மொபைல் சரிபார்ப்பு மற்றும் ஆர்டர் விவரங்கள் முழுமையாக குறியாக்கம் செய்யப்பட்டுள்ளன.'
                      : 'All customer profile details, authentication tokens, and order requests are encrypted in transit and at rest.',
                  },
                  {
                    icon: 'navigate-outline',
                    title: isTamil ? 'துல்லியமான இருப்பிட தனியுரிமை' : 'Strict Location Privacy',
                    desc: isTamil
                      ? 'உங்கள் GPS இருப்பிடம் 3 கி.மீ சுற்றளவில் உள்ள கடைகளைக் கணக்கிட மட்டுமே பயன்படுத்தப்படுகிறது. இது எக்காரணம் கொண்டும் மூன்றாம் நபர்களுக்கு விற்கப்படாது.'
                      : 'Your location coordinates are strictly utilized to compute distance to neighborhood merchants (1-3 km). Never shared with ad brokers.',
                  },
                  {
                    icon: 'card-outline',
                    title: isTamil ? 'பூஜ்ஜிய வங்கி அட்டை சேமிப்பு' : 'Zero Financial Data Retention',
                    desc: isTamil
                      ? 'நாங்கள் உங்கள் வங்கி அட்டை அல்லது UPI கடவுச்சொற்களை சேமிப்பதில்லை. அனைத்து பரிவர்த்தனைகளும் RBI அங்கீகரிக்கப்பட்ட பாதுகாப்பான முறையில் நடைபெறுகின்றன.'
                      : 'Credit/debit card numbers are never stored on our servers. Transactions execute directly via RBI-certified payment gateways.',
                  },
                  {
                    icon: 'trash-outline',
                    title: isTamil ? 'தரவு நீக்குதல் உரிமை' : 'Full Data Rights & Account Erasure',
                    desc: isTamil
                      ? 'நீங்கள் விரும்பினால் எப்போது வேண்டுமானாலும் உங்கள் சேமிக்கப்பட்ட முகவரிகள் மற்றும் கணக்குத் தகவல்களை நீக்கலாம்.'
                      : 'You retain complete control to delete your saved delivery addresses and account history at any time.',
                  },
                ].map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.privacyItemCard,
                      { backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF', borderColor: theme.glassBorder },
                    ]}
                  >
                    <View style={styles.privacyItemTopRow}>
                      <Ionicons name={item.icon} size={18} color="#10B981" />
                      <Text style={[styles.privacyItemTitle, { color: theme.textWhite }]}>
                        {item.title}
                      </Text>
                    </View>
                    <Text style={[styles.privacyItemDesc, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      {item.desc}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* ==================================================== */}
        {/* NOTIFICATION PREFERENCES MODAL (Liquid Glass)        */}
        {/* ==================================================== */}
        <Modal
          visible={isNotificationsVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsNotificationsVisible(false)}
        >
          <View style={[styles.sheetModalContainer, { backgroundColor: isDarkMode ? '#080E0A' : '#F8FAFC' }]}>
            <View style={styles.grabHandleBar}>
              <View style={[styles.grabHandle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
            </View>

            <View style={[styles.header, { borderBottomColor: theme.glassBorder }]}>
              <TouchableOpacity
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                    borderColor: theme.glassBorder,
                  },
                ]}
                onPress={() => setIsNotificationsVisible(false)}
              >
                <Ionicons name="close" size={20} color={theme.textWhite} />
              </TouchableOpacity>

              <Text style={[styles.headerTitle, { color: theme.textWhite }]}>
                {isTamil ? 'அறிவிப்பு விருப்பங்கள்' : 'Notification Preferences'}
              </Text>

              <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={[styles.notifCardGroup, { backgroundColor: isDarkMode ? '#0E1710' : '#FFFFFF', borderColor: theme.glassBorder }]}>
                {/* 1. Order Updates */}
                <View style={[styles.notifToggleRow, { borderBottomColor: theme.glassBorder }]}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.notifToggleTitle, { color: theme.textWhite }]}>
                      {isTamil ? 'ஆர்டர் நிலவர விழிப்பூட்டல்கள்' : 'Order Status Updates'}
                    </Text>
                    <Text style={[styles.notifToggleSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      {isTamil
                        ? 'ஆர்டர் உறுதிப்படுத்தல், பேக்கிங் மற்றும் டெலிவரி நகர்வு குறித்த நேரலை அறிவிப்புகள்.'
                        : 'Real-time push alerts when order is placed, packed, out for delivery & arrived.'}
                    </Text>
                  </View>
                  <Switch
                    value={notifOrderUpdates}
                    onValueChange={v => handleSaveNotifPref('orderUpdates', v)}
                    trackColor={{ false: '#64748B', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 2. Offers & Flash Deals */}
                <View style={[styles.notifToggleRow, { borderBottomColor: theme.glassBorder }]}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.notifToggleTitle, { color: theme.textWhite }]}>
                      {isTamil ? 'உள்ளூர் கடை தள்ளுபடி சலுகைகள்' : 'Neighborhood Store Flash Deals'}
                    </Text>
                    <Text style={[styles.notifToggleSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      {isTamil
                        ? 'அருகிலுள்ள கடைகளின் பிரத்யேக தள்ளுபடிகள் மற்றும் தினசரி சேமிப்பு சலுகைகள்.'
                        : 'Instant alerts on price drops and daily discounts from your neighborhood merchants.'}
                    </Text>
                  </View>
                  <Switch
                    value={notifOffers}
                    onValueChange={v => handleSaveNotifPref('offers', v)}
                    trackColor={{ false: '#64748B', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 3. WhatsApp Alerts */}
                <View style={[styles.notifToggleRow, { borderBottomColor: theme.glassBorder }]}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.notifToggleTitle, { color: theme.textWhite }]}>
                      {isTamil ? 'வாட்ஸ்அப் டெலிவரி ரசீது' : 'WhatsApp Delivery Receipts'}
                    </Text>
                    <Text style={[styles.notifToggleSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      {isTamil
                        ? 'வாட்ஸ்அப்பில் மின்னணு ரசீது மற்றும் ரைடர் கண்காணிப்பு இணைப்பு.'
                        : 'Receive digital invoice copy and live rider tracking link directly on WhatsApp.'}
                    </Text>
                  </View>
                  <Switch
                    value={notifWhatsapp}
                    onValueChange={v => handleSaveNotifPref('whatsapp', v)}
                    trackColor={{ false: '#64748B', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 4. Restock Alerts */}
                <View style={styles.notifToggleRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.notifToggleTitle, { color: theme.textWhite }]}>
                      {isTamil ? 'மீண்டும் கையிருப்பில் விழிப்பூட்டல்' : 'Back-in-Stock Notifications'}
                    </Text>
                    <Text style={[styles.notifToggleSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      {isTamil
                        ? 'முன்பு விற்றுப்போன உங்களுக்குப் பிடித்த பொருட்கள் மீண்டும் வரும்போது அறிவிப்பு.'
                        : 'Be the first to know when favorite out-of-stock items return to store shelves.'}
                    </Text>
                  </View>
                  <Switch
                    value={notifRestock}
                    onValueChange={v => handleSaveNotifPref('restock', v)}
                    trackColor={{ false: '#64748B', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveProfileBtn, { backgroundColor: '#10B981', marginTop: 24 }]}
                onPress={() => {
                  triggerHaptic('light');
                  setIsNotificationsVisible(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.saveProfileBtnText}>
                  {isTamil ? 'சேமிக்கப்பட்டது ✓' : 'Done ✓'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* ==================================================== */}
        {/* DELIVERY LOCATION / ADDRESS MANAGEMENT MODAL         */}
        {/* ==================================================== */}
        <DeliveryLocationFlowModal
          visible={isAddressFlowModalVisible}
          onClose={() => setIsAddressFlowModalVisible(false)}
          activeLocation={userLocation || DEFAULT_USER_LOCATION}
          onSelectLocation={savedLoc => {
            if (onUpdateLocation) onUpdateLocation(savedLoc);
            setSavedAddresses(prev => [savedLoc, ...prev.filter(a => a.id !== savedLoc.id)]);
            setIsAddressFlowModalVisible(false);
          }}
          userId={user?.uid}
          language={language}
          isDarkMode={isDarkMode}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  grabHandleBar: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  langPillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  langPillHeaderText: {
    fontSize: 11,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
  },
  /* Redesigned Liquid Glass Member Profile Card */
  profileCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  profileAvatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileAvatarInitials: {
    fontSize: 18,
    fontWeight: '900',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  verifiedOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#10B981',
    borderWidth: 2,
  },
  profileMainIdentity: {
    flex: 1,
    marginLeft: 12,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  memberStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    marginTop: 4,
    gap: 4,
  },
  memberStatusText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  editProfileBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  /* Meta Contact Stack (Prevents email overflow) */
  profileMetaContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
    gap: 8,
  },
  metaRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  metaIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRowLabel: {
    fontSize: 11,
    fontWeight: '700',
    width: 62,
  },
  metaRowValue: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
  },
  metaHorizontalDivider: {
    height: 1,
    width: '100%',
    opacity: 0.7,
  },
  // Legacy chip classes preserved for compatibility
  metaChipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexShrink: 1,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
  },
  metaDot: {
    width: 1,
    height: 16,
    marginHorizontal: 8,
  },
  /* Delivery Pill Row */
  deliveryPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
  },
  deliveryPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  locationIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryPillLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  deliveryPillAddress: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 1,
  },
  hyperlocal15Badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  hyperlocal15Text: {
    color: '#10B981',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  /* Loyalty Stats Ribbon */
  statsRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    marginTop: 12,
  },
  statsRibbonCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRibbonVal: {
    fontSize: 15,
    fontWeight: '900',
  },
  statsRibbonLbl: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },
  statsRibbonDivider: {
    width: 1,
    height: 22,
  },
  /* Redesigned Tab Bar (Scrollable Floating Glass Pills) */
  tabBarContainer: {
    marginBottom: 16,
    marginHorizontal: -16,
  },
  tabsScrollTrack: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1.2,
    gap: 6,
  },
  tabPillActive: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  tabPillText: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  tabPillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 1,
  },
  tabPillBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  /* Quick Access Row */
  quickAccessRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  quickAccessCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  quickAccessIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAccessTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  quickAccessSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  /* Settings section */
  settingsSection: {
    gap: 10,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingRowText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  languageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  languageBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  /* Theme Mode Card */
  themeModeCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  themeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  themeCaptionText: {
    fontSize: 11,
    marginTop: 1,
  },
  themeSegmentTrack: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  themeSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 8,
  },
  themeSegmentBtnActive: {},
  themeSegmentBtnText: {
    fontSize: 12,
  },
  /* Upstage Information Group */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  sectionHeadingText: {
    fontSize: 12.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCardGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 13,
    borderBottomWidth: 1,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoRowTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoRowSub: {
    fontSize: 11,
    marginTop: 1,
  },
  /* Merchant Promo */
  merchantPromoCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  merchantPromoTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  merchantPromoSub: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  /* Logout */
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginTop: 6,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '800',
  },
  versionText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  /* Tab Section Titles */
  tabSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tabSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  wishlistCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  wishlistCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  /* Wishlist Section */
  wishlistSection: {},
  emptyWishlistContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyWishlistIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyWishlistTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyWishlistSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 280,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  exploreBtnText: {
    color: '#050906',
    fontSize: 13,
    fontWeight: '800',
  },
  wishlistGrid: {
    gap: 10,
  },
  wishlistCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 12,
  },
  wishlistImgWrap: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  wishlistImg: {
    width: '100%',
    height: '100%',
  },
  wishlistRemoveHeartBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishlistContent: {
    flex: 1,
    justifyContent: 'center',
  },
  wishlistProductName: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  wishlistUnit: {
    fontSize: 11,
    marginBottom: 6,
  },
  wishlistPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wishlistPrice: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  wishlistMrp: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  wishlistAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  wishlistAddBtnText: {
    color: '#050906',
    fontSize: 12,
    fontWeight: '900',
  },
  wishlistStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 2,
  },
  wishlistStepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  wishlistStepperText: {
    color: '#050906',
    fontSize: 15,
    fontWeight: '900',
  },
  wishlistStepperQty: {
    color: '#050906',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 4,
  },
  /* Addresses Section */
  addressesSection: {},
  addNewAddressTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  addNewAddressTopBtnText: {
    color: '#050906',
    fontSize: 11.5,
    fontWeight: '800',
  },
  emptyAddressesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  addressCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  addressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  addressTagIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressTagText: {
    fontSize: 13,
    fontWeight: '800',
  },
  activeAddressBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  activeAddressBadgeText: {
    color: '#10B981',
    fontSize: 9.5,
    fontWeight: '800',
  },
  addressStreetText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  addressSubText: {
    fontSize: 11.5,
    marginBottom: 4,
  },
  addressContactText: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  deliverHereBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  deliverHereBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  iosCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosCheckCircleSm: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosRadioInnerDot: {
    width: 8.5,
    height: 8.5,
    borderRadius: 4.25,
    backgroundColor: '#FFFFFF',
  },
  /* Orders Section */
  ordersSection: {
    gap: 10,
  },
  emptyOrders: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyOrdersText: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyOrdersSub: {
    fontSize: 12,
    color: '#94A3B8',
  },
  orderCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  orderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderIdText: {
    fontSize: 13,
    fontWeight: '800',
  },
  orderStatusBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  orderStatusText: {
    color: '#22C55E',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  orderShopName: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  orderBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  orderItemsCount: {
    fontSize: 11.5,
    color: '#94A3B8',
  },
  orderPrice: {
    fontSize: 14,
    fontWeight: '800',
  },
  /* Payment Cards */
  paymentOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  paymentMethodTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  paymentMethodSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  /* Modal Overlay Sheets */
  sheetModalContainer: {
    flex: 1,
  },
  editProfileAvatarWrap: {
    alignItems: 'center',
    marginVertical: 14,
  },
  editAvatarTouchArea: {
    position: 'relative',
    alignSelf: 'center',
  },
  editProfileAvatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  editProfileAvatarImg: {
    width: '100%',
    height: '100%',
  },
  editProfileAvatarInitials: {
    fontSize: 26,
    fontWeight: '900',
  },
  editAvatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0E1710',
    elevation: 4,
  },
  photoActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1.2,
  },
  changePhotoBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  removePhotoBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  editProfileNotice: {
    fontSize: 11.5,
    marginTop: 10,
    textAlign: 'center',
  },
  /* Profile Photo Picker Modal Styles */
  photoPickerPreviewWrap: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  photoPickerPreviewCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPickerPreviewImg: {
    width: '100%',
    height: '100%',
  },
  photoPickerPreviewInitials: {
    fontSize: 28,
    fontWeight: '900',
  },
  photoPickerPreviewText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  removeSelectedPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  removeSelectedPhotoText: {
    color: '#EF4444',
    fontSize: 11.5,
    fontWeight: '700',
  },
  photoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  photoSectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  avatarGridItem: {
    width: '23%',
    aspectRatio: 0.85,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    position: 'relative',
  },
  avatarGridItemSelected: {
    borderColor: '#10B981',
  },
  avatarGridImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarGridLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  avatarSelectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    borderWidth: 1.5,
    borderColor: '#10B981',
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customUrlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  customUrlField: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 6,
  },
  applyUrlBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyUrlBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  modalHeaderDoneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  modalHeaderDoneBtnText: {
    color: '#050906',
    fontSize: 12.5,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 10,
    height: 48,
  },
  textInputField: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
  },
  saveProfileBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    height: 48,
    marginTop: 26,
  },
  saveProfileBtnText: {
    color: '#050906',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  /* Info Modal Styles */
  infoModalHeroCard: {
    alignItems: 'center',
    marginVertical: 12,
  },
  infoModalLogoCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  infoModalBrandName: {
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
  },
  versionBadgePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  versionBadgePillText: {
    color: '#10B981',
    fontSize: 10.5,
    fontWeight: '800',
  },
  infoSectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  infoCardHeading: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  infoCardParagraph: {
    fontSize: 12,
    lineHeight: 18,
  },
  featurePillarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  featurePillarIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featurePillarTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  featurePillarDesc: {
    fontSize: 11,
    marginTop: 1,
    lineHeight: 15,
  },
  madeWithLoveRow: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  /* Privacy Modal Hero */
  privacyHeroWrap: {
    alignItems: 'center',
    marginVertical: 12,
  },
  privacyHeroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  privacyHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  privacyHeroSub: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
  },
  privacyItemCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  privacyItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  privacyItemTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  privacyItemDesc: {
    fontSize: 11.5,
    lineHeight: 17,
  },
  /* Notification Preferences Card */
  notifCardGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  notifToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
  },
  notifToggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  notifToggleSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  loaderCenter: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
