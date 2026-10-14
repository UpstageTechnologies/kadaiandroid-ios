import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Platform,
  Dimensions,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Svg, { Circle, Path, G, Rect } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  calculateDistance,
  getSellerCoordinates,
  reverseGeocodeLocation,
  detectUserLocation,
  fetchUserSavedAddresses,
  saveActiveLocation,
  deleteSavedAddress,
  DEFAULT_USER_LOCATION,
  CITY_COORDINATES,
  CITY_POPULAR_AREAS,
  BASE_LOCATION_HIERARCHY,
  resolveAreaCoordinates,
  fetchAvailableStoreLocations,
  forwardGeocodeAddress,
  normalizeAddressPayload,
  getCoordinatesForAreaOrCity,
} from '../../services/locationService';
import { triggerHaptic } from './safeHaptics';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Safe dynamic import for MapView
let MapView = null;
let Marker = null;
try {
  const Maps = require('react-native-maps');
  MapView = Maps.default || Maps.MapView;
  Marker = Maps.Marker;
} catch (e) {
  console.log('react-native-maps dynamic load note:', e?.message);
}

export const TOP_CITIES_LIST = [
  { id: 'sattur', name: 'Sattur', state: 'Tamil Nadu' },
  { id: 'virudhunagar', name: 'Virudhunagar', state: 'Tamil Nadu' },
  { id: 'sivakasi', name: 'Sivakasi', state: 'Tamil Nadu' },
  { id: 'aruppukkottai', name: 'Aruppukkottai', state: 'Tamil Nadu' },
  { id: 'rajapalayam', name: 'Rajapalayam', state: 'Tamil Nadu' },
  { id: 'srivilliputhur', name: 'Srivilliputhur', state: 'Tamil Nadu' },
  { id: 'kovilpatti', name: 'Kovilpatti', state: 'Tamil Nadu' },
  { id: 'madurai', name: 'Madurai', state: 'Tamil Nadu' },
  { id: 'chennai', name: 'Chennai', state: 'Tamil Nadu' },
  { id: 'coimbatore', name: 'Coimbatore', state: 'Tamil Nadu' },
  { id: 'trichy', name: 'Tiruchirappalli', state: 'Tamil Nadu' },
  { id: 'bengaluru', name: 'Bengaluru', state: 'Karnataka' },
  { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra' },
  { id: 'delhi', name: 'New Delhi', state: 'Delhi' },
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana' },
  { id: 'kolkata', name: 'Kolkata', state: 'West Bengal' },
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat' },
];

export const ALL_INDIAN_CITIES_LIST = [
  'Abohar', 'Adoni', 'Agartala', 'Agra', 'Ahmedabad', 'Ahmednagar', 'Aizawl', 'Ajmer',
  'Alappuzha', 'Aligarh', 'Allahabad (Prayagraj)', 'Alwar', 'Ambala', 'Amravati', 'Amritsar',
  'Anand', 'Anantapur', 'Arrah', 'Asansol', 'Aurangabad', 'Avadi', 'Bareilly',
  'Bathinda', 'Belgaum (Belagavi)', 'Bellary', 'Bengaluru', 'Bhagalpur', 'Bharatpur',
  'Bhavnagar', 'Bhilai', 'Bhilwara', 'Bhiwandi', 'Bhopal', 'Bhubaneswar', 'Bikaner',
  'Bilaspur', 'Bokaro', 'Chandigarh', 'Chandrapur', 'Chennai', 'Chittoor', 'Coimbatore',
  'Cuttack', 'Darbhanga', 'Davanagere', 'Dehradun', 'Delhi', 'Deoghar', 'Dewas', 'Dhanbad',
  'Dhule', 'Dindigul', 'Durgapur', 'Eluru', 'Erode', 'Faridabad', 'Firozabad', 'Gandhinagar',
  'Gaya', 'Ghaziabad', 'Gorakhpur', 'Gulbarga (Kalaburagi)', 'Guntur', 'Gurgaon (Gurugram)',
  'Guwahati', 'Gwalior', 'Hapur', 'Haridwar', 'Himatnagar', 'Hosur', 'Hubli-Dharwad',
  'Hyderabad', 'Ichalkaranji', 'Imphal', 'Indore', 'Jabalpur', 'Jaipur', 'Jalandhar',
  'Jalgaon', 'Jalna', 'Jammu', 'Jamnagar', 'Jamshedpur', 'Jhansi', 'Jodhpur', 'Junagadh',
  'Kadapa', 'Kakinada', 'Kalyan-Dombivli', 'Kanchipuram', 'Kannur', 'Kanpur', 'Karnal',
  'Karur', 'Khammam', 'Kharagpur', 'Kochi', 'Kolhapur', 'Kolkata', 'Kollam', 'Korba',
  'Kota', 'Kottayam', 'Kozhikode', 'Kurnool', 'Latur', 'Lucknow', 'Ludhiana', 'Madurai',
  'Malegaon', 'Mangalore', 'Mathura', 'Meerut', 'Mira-Bhayandar', 'Moradabad', 'Morbi',
  'Mumbai', 'Muzaffarnagar', 'Muzaffarpur', 'Mysore', 'Nadiad', 'Nagercoil', 'Nagpur',
  'Nanded', 'Nandyal', 'Nashik', 'Navi Mumbai', 'Nellore', 'New Delhi', 'Nizamabad',
  'Noida', 'Orai', 'Palakkad', 'Pali', 'Panipat', 'Panvel', 'Parbhani', 'Patiala',
  'Patna', 'Pimpri-Chinchwad', 'Pondicherry (Puducherry)', 'Pune', 'Puri', 'Raipur',
  'Rajahmundry', 'Rajkot', 'Ranchi', 'Ratlam', 'Rewa', 'Rohtak', 'Rourkela', 'Sagar',
  'Saharanpur', 'Salem', 'Sambalpur', 'Sangli', 'Satara', 'Sattur', 'Shahjahanpur',
  'Shimla', 'Shivamogga (Shimoga)', 'Sikar', 'Siliguri', 'Solapur', 'Sonipat', 'Srinagar',
  'Surat', 'Thane', 'Thanjavur', 'Thiruvananthapuram', 'Thrissur', 'Tiruchirappalli',
  'Tirunelveli', 'Tirupati', 'Tiruppur', 'Tumkur', 'Udaipur', 'Ujjain', 'Ulhasnagar',
  'Vadodara', 'Varanasi', 'Vasai-Virar', 'Vellore', 'Vijayawada', 'Virudhunagar',
  'Visakhapatnam', 'Warangal', 'Yamunanagar'
];

export const COMMON_CITY_AREAS_MAP = {
  Sattur: ['Padanthal', 'Main Bazaar', 'Railway Feeder Road', 'Bus Stand Area', 'Kovilpatti Road', 'Venkatachalapuram', 'Court Road', 'SDR Nagar', 'Gandhi Nagar'],
  Virudhunagar: ['Kamarajar Salai', 'Collectorate Complex', 'Railway Station Road', 'Mullai Nagar', 'Aruppukottai Road', 'Rosalpatti', 'Pandian Nagar'],
  Chennai: ['T. Nagar', 'Anna Nagar', 'Velachery', 'Adyar', 'Mylapore', 'Tambaram', 'Guindy', 'Besant Nagar', 'Nungambakkam', 'Thiruvanmiyur', 'Porur', 'Kilpauk'],
  Madurai: ['Simmakkal', 'Goripalayam', 'KK Nagar', 'Mattuthavani', 'Anna Nagar', 'Tallakulam', 'SS Colony', 'Vilangudi', 'Thirunagar', 'Pasumalai'],
  Coimbatore: ['RS Puram', 'Gandhipuram', 'Peelamedu', 'Saibaba Colony', 'Saravanampatti', 'Singanallur', 'Ramanathapuram', 'Ukkadam', 'Town Hall'],
  Bengaluru: ['Indiranagar', 'Koramangala', 'HSR Layout', 'Whitefield', 'Jayanagar', 'JP Nagar', 'Electronic City', 'BTM Layout', 'Malleshwaram', 'Marathahalli'],
  Mumbai: ['Andheri West', 'Bandra West', 'Juhu', 'Powai', 'Malad West', 'Borivali', 'Dadar', 'Colaba', 'Goregaon East', 'Lower Parel'],
  'New Delhi': ['Connaught Place', 'South Extension', 'Hauz Khas', 'Greater Kailash', 'Lajpat Nagar', 'Vasant Kunj', 'Dwarka', 'Saket', 'Karol Bagh'],
};

/**
 * UNIFIED DELIVERY LOCATION & ADDRESS FLOW MODAL
 * Supports 3 seamless steps without native Modal collisions:
 * 1. 'select'     -> Select Delivery Location (GPS, Search, Real Firebase Saved Addresses)
 * 2. 'add_details' -> Add Complete Address + Street, City, District, State, Pincode + Receiver + Tag
 * 3. 'map'         -> Interactive Map Pin Confirmation
 */
export function DeliveryLocationFlowModal({
  visible,
  onClose,
  initialStep = 'select',
  activeLocation,
  onSelectLocation,
  userId,
  language = 'en',
  isDarkMode = true,
  overlayMode = false,
}) {
  const insets = useSafeAreaInsets();
  const isTamil = language === 'ta';

  // Step state: 'select' | 'add_details' | 'map'
  const [currentStep, setCurrentStep] = useState(initialStep || 'select');

  // Currently resolved location for editing or pin dropping
  const [editingLocation, setEditingLocation] = useState(
    activeLocation || DEFAULT_USER_LOCATION
  );

  // Sync initial step & location when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentStep(initialStep || 'select');
      setEditingLocation(activeLocation || DEFAULT_USER_LOCATION);
    }
  }, [visible, initialStep, activeLocation]);

  // ------------------------------------------
  // STEP 1 STATE: SELECT LOCATION
  // ------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  // Load real saved addresses from Firebase
  useEffect(() => {
    if (!visible) return;
    let isMounted = true;
    setLoadingSaved(true);

    fetchUserSavedAddresses(userId)
      .then(list => {
        if (isMounted) {
          setSavedAddresses(list || []);
          setLoadingSaved(false);
        }
      })
      .catch(err => {
        console.log('Error loading saved addresses from Firebase:', err);
        if (isMounted) setLoadingSaved(false);
      });

    return () => {
      isMounted = false;
    };
  }, [visible, userId]);

  // Handle GPS detection
  const handleUseCurrentLocation = async () => {
    triggerHaptic('medium');
    setIsDetectingGps(true);
    try {
      const detected = await detectUserLocation();
      setIsDetectingGps(false);
      if (detected) {
        const resolved = normalizeAddressPayload(detected);
        await saveActiveLocation(userId, resolved);
        if (onSelectLocation) onSelectLocation(resolved);
        onClose();
      }
    } catch (e) {
      setIsDetectingGps(false);
      Alert.alert(
        isTamil ? 'பிழை' : 'Location Error',
        isTamil
          ? 'இருப்பிடத்தைக் கண்டறிய முடியவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.'
          : 'Could not detect GPS location. Please try again or select from saved addresses.'
      );
    }
  };

  // ------------------------------------------
  // STEP 2 STATE: ADD ADDRESS DETAILS (Matching Image 1, 2, 3)
  // ------------------------------------------
  const [completeAddress, setCompleteAddress] = useState('');
  const [streetName, setStreetName] = useState('');
  const [cityName, setCityName] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincodeVal, setPincodeVal] = useState('');
  const [receiverName, setReceiverName] = useState('Customer');
  const [receiverPhone, setReceiverPhone] = useState('9442461428');
  const [selectedTag, setSelectedTag] = useState('Home'); // 'Home' | 'Work' | 'Hotel' | 'Others'
  const [customTag, setCustomTag] = useState('');
  const [contactType, setContactType] = useState('myself'); // 'myself' | 'someone'
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [hasPin, setHasPin] = useState(false);
  const [pinCoords, setPinCoords] = useState(null); // { lat: number, lon: number } | null
  const previousPinStateRef = useRef({ hasPin: false, pinCoords: null, googleMapsLink: '' });
  const [currentMapPinCoords, setCurrentMapPinCoords] = useState(null);
  const [isCitySheetOpen, setIsCitySheetOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [isAreaSheetOpen, setIsAreaSheetOpen] = useState(false);
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [isOrderingForSomeoneAlertVisible, setIsOrderingForSomeoneAlertVisible] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [deletingAddressId, setDeletingAddressId] = useState(null);
  const receiverNameInputRef = useRef(null);

  // Single Unified Location Hierarchy Sheet
  // Step sequence: 'country' -> 'state' -> 'district' -> 'city'
  const [isLocationHierarchySheetOpen, setIsLocationHierarchySheetOpen] = useState(false);
  const [hierarchyStep, setHierarchyStep] = useState('city'); // 'country' | 'state' | 'district' | 'city'
  const [hierarchySearchQuery, setHierarchySearchQuery] = useState('');
  const [locationHierarchy, setLocationHierarchy] = useState(BASE_LOCATION_HIERARCHY);

  const [selectedCountryKey, setSelectedCountryKey] = useState('india');
  const [selectedStateKey, setSelectedStateKey] = useState('tamil_nadu');
  const [selectedDistrictKey, setSelectedDistrictKey] = useState('virudhunagar');
  const [selectedCityKey, setSelectedCityKey] = useState('sattur');

  // Available countries & Upstage POS store locations loaded from Firebase
  const [availableCountries, setAvailableCountries] = useState([
    { id: 'all', name: 'All Countries', flag: '🌐', storeCount: 0 },
    { id: 'india', name: 'India', flag: '🇮🇳', storeCount: 0 },
  ]);
  const [selectedCountry, setSelectedCountry] = useState('india');
  const [firebaseStoreCities, setFirebaseStoreCities] = useState([]);
  const [firebaseStoreAreas, setFirebaseStoreAreas] = useState({});
  const [loadingStoreLocations, setLoadingStoreLocations] = useState(false);

  // Load available store locations & countries from Firebase (Upstage POS stores)
  useEffect(() => {
    if (!visible) return;
    let isMounted = true;
    setLoadingStoreLocations(true);

    fetchAvailableStoreLocations()
      .then(res => {
        if (!isMounted || !res) return;
        if (res.hierarchy) {
          setLocationHierarchy(res.hierarchy);
        }
        if (Array.isArray(res.countries) && res.countries.length > 0) {
          const totalStores = res.countries.reduce((acc, c) => acc + (c.storeCount || 0), 0);
          const allOption = {
            id: 'all',
            name: isTamil ? 'அனைத்து நாடுகள்' : 'All Countries',
            flag: '🌐',
            storeCount: totalStores,
          };
          setAvailableCountries([allOption, ...res.countries]);
          if (res.countries.some(c => c.id === 'india')) {
            setSelectedCountry('india');
          } else {
            setSelectedCountry(res.countries[0].id);
          }
        }
        if (Array.isArray(res.storeCities)) {
          setFirebaseStoreCities(res.storeCities);
        }
        if (res.storeAreasByCity) {
          setFirebaseStoreAreas(res.storeAreasByCity);
        }
        setLoadingStoreLocations(false);
      })
      .catch(err => {
        console.log('Error fetching store locations from Firebase:', err);
        if (isMounted) setLoadingStoreLocations(false);
      });

    return () => {
      isMounted = false;
    };
  }, [visible, isTamil]);

  // Reset edit state when modal is closed
  useEffect(() => {
    if (!visible) {
      setEditingAddressId(null);
      setDeletingAddressId(null);
    }
  }, [visible]);

  // Populate form fields whenever editingLocation changes
  useEffect(() => {
    if (editingLocation) {
      if (editingLocation.completeAddress) {
        setCompleteAddress(editingLocation.completeAddress);
      } else if (editingLocation.street && !completeAddress) {
        setCompleteAddress(editingLocation.street);
      }
      setStreetName(editingLocation.street || editingLocation.area || '');
      setCityName(editingLocation.city || 'Sattur');
      setDistrictName(editingLocation.district || 'Virudhunagar');
      setStateName(editingLocation.state || 'Tamil Nadu');
      setPincodeVal(editingLocation.pincode || '626203');
      if (editingLocation.receiverName) setReceiverName(editingLocation.receiverName);
      if (editingLocation.receiverPhone) setReceiverPhone(editingLocation.receiverPhone);
      if (editingLocation.tag) {
        setSelectedTag(editingLocation.tag);
        if (!['Home', 'Work', 'Hotel', 'Others'].includes(editingLocation.tag)) {
          setCustomTag(editingLocation.tag);
        }
      }
      if (editingLocation.hasPin === true || (Number.isFinite(Number(editingLocation.lat)) && Number.isFinite(Number(editingLocation.lon)) && Number(editingLocation.lat) !== 0 && (editingLocation.googleMapsLink || editingLocation.hasPin))) {
        const latNum = Number(editingLocation.lat);
        const lonNum = Number(editingLocation.lon);
        const link = editingLocation.googleMapsLink && String(editingLocation.googleMapsLink).trim()
          ? String(editingLocation.googleMapsLink).trim()
          : `https://www.google.com/maps?q=${latNum},${lonNum}`;
        setHasPin(true);
        setPinCoords({ lat: latNum, lon: lonNum });
        setGoogleMapsLink(link);
      } else if (editingLocation.hasPin === false) {
        setHasPin(false);
        setPinCoords(null);
        setGoogleMapsLink('');
      } else if (editingLocation.googleMapsLink) {
        setGoogleMapsLink(editingLocation.googleMapsLink);
      }
      if (editingLocation.country) {
        const cKey = editingLocation.country.toLowerCase().replace(/[^a-z0-9]/g, '_');
        setSelectedCountryKey(cKey);
      }
      if (editingLocation.state) {
        const sKey = editingLocation.state.toLowerCase().replace(/[^a-z0-9]/g, '_');
        setSelectedStateKey(sKey);
      }
      if (editingLocation.district) {
        const dKey = editingLocation.district.toLowerCase().replace(/[^a-z0-9]/g, '_');
        setSelectedDistrictKey(dKey);
      }
      if (editingLocation.city) {
        const cKey = editingLocation.city.toLowerCase().replace(/[^a-z0-9]/g, '_');
        setSelectedCityKey(cKey);
      }
    }
  }, [editingLocation]);

  const tagOptions = [
    { id: 'Home', label: isTamil ? 'வீடு' : 'Home', icon: 'home-outline' },
    { id: 'Work', label: isTamil ? 'அலுவலகம்' : 'Work', icon: 'briefcase-outline' },
    { id: 'Hotel', label: isTamil ? 'ஹோட்டல்' : 'Hotel', icon: 'business-outline' },
    { id: 'Others', label: isTamil ? 'மற்றவை' : 'Others', icon: 'location-outline' },
  ];

  // Open Unified Location Hierarchy Sheet
  const handleOpenCityHierarchy = (startLevel = 'city') => {
    triggerHaptic('light');
    setHierarchySearchQuery('');
    setHierarchyStep(startLevel);
    setIsLocationHierarchySheetOpen(true);
  };


  // Navigates up one step in hierarchy or closes if at top
  const handleHierarchyBack = () => {
    triggerHaptic('light');
    setHierarchySearchQuery('');
    if (hierarchyStep === 'city') {
      setHierarchyStep('district');
    } else if (hierarchyStep === 'district') {
      setHierarchyStep('state');
    } else if (hierarchyStep === 'state') {
      setHierarchyStep('country');
    } else {
      setIsLocationHierarchySheetOpen(false);
    }
  };

  // Hierarchy Step 1: Select Country -> Advance to State
  const handleSelectCountryInHierarchy = (country) => {
    triggerHaptic('light');
    const cKey = country.id || country.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    setSelectedCountryKey(cKey);
    setHierarchySearchQuery('');
    const countryObj = locationHierarchy[cKey] || country;
    const states = Object.values(countryObj?.states || {});
    if (states.length > 0) {
      const nextState = states.find(s => s.id === selectedStateKey) || states[0];
      setSelectedStateKey(nextState.id);
      setStateName(nextState.name);
    }
    setHierarchyStep('state');
  };

  // Hierarchy Step 2: Select State -> Advance to District
  const handleSelectStateInHierarchy = (state) => {
    triggerHaptic('light');
    const sKey = state.id || state.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    setSelectedStateKey(sKey);
    setStateName(state.name);
    setHierarchySearchQuery('');
    const districts = Object.values(state?.districts || {});
    if (districts.length > 0) {
      const nextDistrict = districts.find(d => d.id === selectedDistrictKey) || districts[0];
      setSelectedDistrictKey(nextDistrict.id);
      setDistrictName(nextDistrict.name);
    }
    setHierarchyStep('district');
  };

  // Hierarchy Step 3: Select District -> Advance to City
  const handleSelectDistrictInHierarchy = (district) => {
    triggerHaptic('light');
    const dKey = district.id || district.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    setSelectedDistrictKey(dKey);
    setDistrictName(district.name);
    setHierarchySearchQuery('');
    const cities = Object.values(district?.cities || {});
    if (cities.length > 0) {
      const nextCity = cities.find(c => c.id === selectedCityKey) || cities[0];
      setSelectedCityKey(nextCity.id);
      setCityName(nextCity.name);
      if (nextCity.pincode) setPincodeVal(nextCity.pincode);
    }
    setHierarchyStep('city');
  };

  // Hierarchy Step 4: Select City -> Set location, coordinates & close sheet
  const handleSelectCityInHierarchy = (city) => {
    triggerHaptic('light');
    const cKey = city.id || city.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    setSelectedCityKey(cKey);
    setCityName(city.name);
    if (city.district) setDistrictName(city.district);
    if (city.state) setStateName(city.state);
    if (city.pincode) setPincodeVal(city.pincode);

    const lat = Number(city.lat) || (CITY_COORDINATES[city.name.toLowerCase()]?.lat ?? DEFAULT_USER_LOCATION.lat);
    const lon = Number(city.lon) || (CITY_COORDINATES[city.name.toLowerCase()]?.lon ?? DEFAULT_USER_LOCATION.lon);

    setEditingLocation(prev => ({
      ...prev,
      city: city.name,
      district: city.district || districtName,
      state: city.state || stateName,
      lat,
      lon,
      pincode: city.pincode || prev.pincode,
      formattedAddress: [city.name, city.district || districtName, city.state || stateName].filter(Boolean).join(', '),
    }));

    setIsLocationHierarchySheetOpen(false);
    setHierarchySearchQuery('');
  };

  // Hierarchy Step 5: Select Street -> Set location, coordinates & close sheet
  const handleSelectStreetInHierarchy = (streetNameVal, coords = null) => {
    triggerHaptic('light');
    const trimmedStreet = (streetNameVal || '').trim();
    if (!trimmedStreet) return;

    setStreetName(trimmedStreet);
    setIsLocationHierarchySheetOpen(false);
    setHierarchySearchQuery('');

    const cityKey = (cityName || 'sattur').trim().toLowerCase();
    let lat = coords?.lat;
    let lon = coords?.lon;
    let pincode = coords?.pincode || pincodeVal;

    if (!lat || !lon) {
      const resolved = resolveAreaCoordinates(cityName, trimmedStreet);
      if (resolved && Number.isFinite(Number(resolved.lat)) && Number.isFinite(Number(resolved.lon))) {
        lat = resolved.lat;
        lon = resolved.lon;
        if (resolved.pincode) pincode = resolved.pincode;
      } else if (CITY_COORDINATES[cityKey]) {
        lat = CITY_COORDINATES[cityKey].lat;
        lon = CITY_COORDINATES[cityKey].lon;
      } else {
        lat = DEFAULT_USER_LOCATION.lat;
        lon = DEFAULT_USER_LOCATION.lon;
      }
    }

    if (pincode) setPincodeVal(pincode);

    setEditingLocation(prev => ({
      ...prev,
      street: trimmedStreet,
      area: trimmedStreet,
      city: cityName,
      district: districtName,
      state: stateName,
      lat: Number(lat),
      lon: Number(lon),
      pincode: pincode || prev.pincode,
      formattedAddress: [trimmedStreet, cityName, districtName, stateName].filter(Boolean).join(', '),
    }));
  };

  // Option: Use Entire City (e.g. City Center)
  const handleSelectWholeCity = () => {
    triggerHaptic('light');
    setStreetName('');
    setIsLocationHierarchySheetOpen(false);
    setHierarchySearchQuery('');

    const cityKey = (cityName || 'sattur').trim().toLowerCase();
    const lat = CITY_COORDINATES[cityKey]?.lat ?? editingLocation?.lat ?? DEFAULT_USER_LOCATION.lat;
    const lon = CITY_COORDINATES[cityKey]?.lon ?? editingLocation?.lon ?? DEFAULT_USER_LOCATION.lon;

    setEditingLocation(prev => ({
      ...prev,
      street: '',
      area: '',
      city: cityName,
      district: districtName,
      state: stateName,
      lat,
      lon,
      pincode: pincodeVal || prev.pincode,
      formattedAddress: [cityName, districtName, stateName].filter(Boolean).join(', '),
    }));
  };

  // Action: Open interactive map pin from hierarchy sheet
  const handleOpenInteractiveMapFromHierarchy = () => {
    triggerHaptic('light');
    setIsLocationHierarchySheetOpen(false);
    setCurrentStep('map');
  };

  // Helper: select city and instantly resolve coordinates accurately
  const handleSelectCity = (chosenCity, chosenState = null, chosenDistrict = null, chosenCoords = null) => {
    triggerHaptic('light');
    const trimmedCity = (chosenCity || '').trim();
    if (!trimmedCity) return;

    setCityName(trimmedCity);
    // Clear streetName on city switch so user picks/enters area in the new city
    setStreetName('');
    setIsCitySheetOpen(false);
    setCitySearchQuery('');

    const cityKey = trimmedCity.toLowerCase();

    // 1. Explicit coordinates provided (e.g. from Upstage POS store item)
    if (chosenCoords && Number.isFinite(Number(chosenCoords.lat)) && Number.isFinite(Number(chosenCoords.lon))) {
      const lat = Number(chosenCoords.lat);
      const lon = Number(chosenCoords.lon);
      const state = chosenState || chosenCoords.state || stateName || 'Tamil Nadu';
      const district = chosenDistrict || chosenCoords.district || districtName || '';
      setStateName(state);
      if (district) setDistrictName(district);
      if (chosenCoords.pincode) setPincodeVal(chosenCoords.pincode);

      setEditingLocation(prev => ({
        ...prev,
        city: trimmedCity,
        street: '',
        area: '',
        state,
        district,
        lat,
        lon,
        pincode: chosenCoords.pincode || prev.pincode,
        formattedAddress: [trimmedCity, district, state].filter(Boolean).join(', '),
      }));
      return;
    }

    // 2. Check in Firebase Upstage POS Store Cities
    const storeMatch = firebaseStoreCities.find(
      c => c.id === cityKey || c.name.toLowerCase() === cityKey
    );
    if (storeMatch && Number.isFinite(Number(storeMatch.lat)) && Number.isFinite(Number(storeMatch.lon))) {
      const state = chosenState || storeMatch.state || 'Tamil Nadu';
      const district = chosenDistrict || storeMatch.district || '';
      setStateName(state);
      if (district) setDistrictName(district);

      setEditingLocation(prev => ({
        ...prev,
        city: trimmedCity,
        street: '',
        area: '',
        state,
        district,
        lat: Number(storeMatch.lat),
        lon: Number(storeMatch.lon),
        formattedAddress: [trimmedCity, district, state].filter(Boolean).join(', '),
      }));
      return;
    }

    // 3. Check in CITY_COORDINATES dictionary
    if (CITY_COORDINATES[cityKey]) {
      const coords = CITY_COORDINATES[cityKey];
      const state = chosenState || coords.state || stateName || 'Tamil Nadu';
      const district = chosenDistrict || coords.district || districtName || '';
      setStateName(state);
      if (district) setDistrictName(district);

      setEditingLocation(prev => ({
        ...prev,
        city: trimmedCity,
        street: '',
        area: '',
        state,
        district,
        lat: coords.lat,
        lon: coords.lon,
        formattedAddress: [trimmedCity, district, state].filter(Boolean).join(', '),
      }));
      return;
    }

    // 4. Fallback: forward geocode city
    if (chosenState) setStateName(chosenState);
    if (chosenDistrict) setDistrictName(chosenDistrict);

    forwardGeocodeAddress(`${trimmedCity}, ${chosenState || 'India'}`).then(res => {
      if (res && res.lat && res.lon) {
        setEditingLocation(prev => ({
          ...prev,
          city: trimmedCity,
          street: '',
          area: '',
          lat: res.lat,
          lon: res.lon,
          formattedAddress: [trimmedCity, chosenState || prev.state].filter(Boolean).join(', '),
        }));
      }
    });
  };

  // Helper: select area and resolve coordinates with high accuracy
  const handleSelectArea = (chosenArea, chosenCoords = null) => {
    triggerHaptic('light');
    const trimmedArea = (chosenArea || '').trim();
    if (!trimmedArea) return;

    setStreetName(trimmedArea);
    setIsAreaSheetOpen(false);
    setAreaSearchQuery('');

    const cityKey = (cityName || '').trim().toLowerCase();

    // 1. Explicit coordinates provided (from store area or popular area card)
    if (chosenCoords && Number.isFinite(Number(chosenCoords.lat)) && Number.isFinite(Number(chosenCoords.lon))) {
      const lat = Number(chosenCoords.lat);
      const lon = Number(chosenCoords.lon);
      if (chosenCoords.pincode) setPincodeVal(chosenCoords.pincode);

      setEditingLocation(prev => ({
        ...prev,
        street: trimmedArea,
        area: trimmedArea,
        lat,
        lon,
        pincode: chosenCoords.pincode || prev.pincode,
        formattedAddress: [trimmedArea, cityName, districtName, stateName].filter(Boolean).join(', '),
      }));
      return;
    }

    // 2. Check resolveAreaCoordinates(cityName, trimmedArea)
    const resolved = resolveAreaCoordinates(cityName, trimmedArea);
    if (resolved && Number.isFinite(Number(resolved.lat)) && Number.isFinite(Number(resolved.lon))) {
      if (resolved.pincode) setPincodeVal(resolved.pincode);

      setEditingLocation(prev => ({
        ...prev,
        street: trimmedArea,
        area: trimmedArea,
        lat: resolved.lat,
        lon: resolved.lon,
        pincode: resolved.pincode || prev.pincode,
        formattedAddress: [trimmedArea, cityName, districtName, stateName].filter(Boolean).join(', '),
      }));
      return;
    }

    // 3. Check in firebaseStoreAreas
    if (firebaseStoreAreas[cityKey]) {
      const storeAreaMatch = firebaseStoreAreas[cityKey].find(
        a => a.name.toLowerCase() === trimmedArea.toLowerCase() ||
             a.name.toLowerCase().includes(trimmedArea.toLowerCase())
      );
      if (storeAreaMatch && Number.isFinite(Number(storeAreaMatch.lat)) && Number.isFinite(Number(storeAreaMatch.lon))) {
        setEditingLocation(prev => ({
          ...prev,
          street: trimmedArea,
          area: trimmedArea,
          lat: storeAreaMatch.lat,
          lon: storeAreaMatch.lon,
          formattedAddress: [trimmedArea, cityName, districtName, stateName].filter(Boolean).join(', '),
        }));
        return;
      }
    }

    // 4. Fallback: forward geocode full location
    const fullLoc = `${trimmedArea}, ${cityName || ''}, ${districtName || ''}, ${stateName || 'Tamil Nadu'}, India`;
    forwardGeocodeAddress(fullLoc).then(res => {
      if (res && res.lat && res.lon) {
        if (res.pincode && !pincodeVal) setPincodeVal(res.pincode);
        setEditingLocation(prev => ({
          ...prev,
          street: trimmedArea,
          area: trimmedArea,
          lat: res.lat,
          lon: res.lon,
          pincode: res.pincode || prev.pincode,
          formattedAddress: [trimmedArea, cityName, districtName, stateName].filter(Boolean).join(', '),
        }));
      } else if (CITY_COORDINATES[cityKey]) {
        setEditingLocation(prev => ({
          ...prev,
          street: trimmedArea,
          area: trimmedArea,
          lat: CITY_COORDINATES[cityKey].lat,
          lon: CITY_COORDINATES[cityKey].lon,
          formattedAddress: [trimmedArea, cityName, districtName, stateName].filter(Boolean).join(', '),
        }));
      }
    });
  };

  // Switch to Add Address Step with clean fields
  const handleAddNewAddress = () => {
    triggerHaptic('light');
    setEditingAddressId(null);
    setCompleteAddress('');
    setStreetName(activeLocation?.street || activeLocation?.area || '');
    setCityName(activeLocation?.city || 'Sattur');
    setDistrictName(activeLocation?.district || 'Virudhunagar');
    setStateName(activeLocation?.state || 'Tamil Nadu');
    setPincodeVal(activeLocation?.pincode || '626203');
    setSelectedTag('Home');
    setCustomTag('');
    setContactType('myself');
    setReceiverName('Customer');
    setReceiverPhone('9442461428');
    setGoogleMapsLink('');
    setHasPin(false);
    setPinCoords(null);
    previousPinStateRef.current = { hasPin: false, pinCoords: null, googleMapsLink: '' };
    setEditingLocation({
      street: activeLocation?.street || activeLocation?.area || '',
      city: activeLocation?.city || 'Sattur',
      district: activeLocation?.district || 'Virudhunagar',
      state: activeLocation?.state || 'Tamil Nadu',
      pincode: activeLocation?.pincode || '626203',
      lat: null,
      lon: null,
      hasPin: false,
      googleMapsLink: '',
    });
    setCurrentStep('add_details');
  };

  // Switch to Edit Address Step with pre-filled fields
  const handleEditSavedAddress = item => {
    triggerHaptic('light');
    setEditingAddressId(item.id);

    const cAddr =
      item.completeAddress ||
      item.flatNo ||
      item.houseNo ||
      item.doorNo ||
      item.street ||
      '';
    setCompleteAddress(cAddr);
    setStreetName(item.street || item.area || '');
    setCityName(item.city || 'Sattur');
    setDistrictName(item.district || 'Virudhunagar');
    setStateName(item.state || 'Tamil Nadu');
    setPincodeVal(item.pincode || '626203');

    const tag = item.tag || item.locationType || 'Home';
    if (['Home', 'Work', 'Hotel', 'Others'].includes(tag)) {
      setSelectedTag(tag);
      setCustomTag('');
    } else {
      setSelectedTag('Others');
      setCustomTag(tag);
    }

    const cType =
      item.contactType ||
      (item.receiverName && item.receiverName !== 'Customer' ? 'someone' : 'myself');
    setContactType(cType);
    setReceiverName(item.receiverName || 'Customer');
    setReceiverPhone(item.receiverPhone || '9442461428');

    const itemHasCoords =
      Number.isFinite(Number(item.lat)) &&
      Number.isFinite(Number(item.lon)) &&
      Number(item.lat) !== 0 &&
      Number(item.lon) !== 0;
    const itemHasLink = Boolean(item.googleMapsLink && String(item.googleMapsLink).trim());
    const itemHadPin = Boolean(
      item.hasPin ||
      (itemHasCoords && itemHasLink) ||
      (itemHasCoords && (item.locationSource === 'map' || item.locationSource === 'gps'))
    );

    if (itemHadPin && itemHasCoords) {
      const latNum = Number(item.lat);
      const lonNum = Number(item.lon);
      const link = itemHasLink
        ? String(item.googleMapsLink).trim()
        : `https://www.google.com/maps?q=${latNum},${lonNum}`;
      setHasPin(true);
      setPinCoords({ lat: latNum, lon: lonNum });
      setGoogleMapsLink(link);
      previousPinStateRef.current = { hasPin: true, pinCoords: { lat: latNum, lon: lonNum }, googleMapsLink: link };
      setEditingLocation({
        ...item,
        lat: latNum,
        lon: lonNum,
        hasPin: true,
        googleMapsLink: link,
      });
    } else {
      setHasPin(false);
      setPinCoords(null);
      setGoogleMapsLink('');
      previousPinStateRef.current = { hasPin: false, pinCoords: null, googleMapsLink: '' };
      setEditingLocation({
        ...item,
        lat: null,
        lon: null,
        hasPin: false,
        googleMapsLink: '',
      });
    }

    setCurrentStep('add_details');
  };

  // Delete saved address confirmation & execution
  const handlePromptDeleteAddress = item => {
    triggerHaptic('medium');
    const label = item.tag || item.city || item.area || 'Address';

    Alert.alert(
      isTamil ? 'முகவரியை நீக்குவதா?' : 'Delete Address?',
      isTamil
        ? `"${label}" (${item.city || item.area || 'முகவரி'}) என்ற இந்த சேமிக்கப்பட்ட முகவரியை நீக்க விரும்புகிறீர்களா?`
        : `Are you sure you want to delete "${label}" (${item.city || item.area || 'Address'})?`,
      [
        {
          text: isTamil ? 'ரத்து' : 'Cancel',
          style: 'cancel',
        },
        {
          text: isTamil ? 'நீக்கு' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingAddressId(item.id);
              triggerHaptic('medium');
              const success = await deleteSavedAddress(userId, item.id, item);

              if (success) {
                const remaining = savedAddresses.filter(a => a.id !== item.id);
                setSavedAddresses(remaining);

                const isCurrentActive =
                  activeLocation?.id === item.id ||
                  (activeLocation?.formattedAddress &&
                    activeLocation?.formattedAddress === item.formattedAddress);

                if (isCurrentActive) {
                  const fallback = remaining.length > 0 ? remaining[0] : DEFAULT_USER_LOCATION;
                  if (onSelectLocation) onSelectLocation(fallback);
                }

                triggerHaptic('success');
              } else {
                Alert.alert(
                  isTamil ? 'பிழை' : 'Error',
                  isTamil ? 'முகவரியை நீக்க முடியவில்லை.' : 'Failed to delete address.'
                );
              }
            } catch (err) {
              console.log('Error deleting address:', err);
              Alert.alert(
                isTamil ? 'பிழை' : 'Error',
                isTamil
                  ? 'முகவரியை நீக்குவதில் சிக்கல் ஏற்பட்டது.'
                  : 'Something went wrong while deleting address.'
              );
            } finally {
              setDeletingAddressId(null);
            }
          },
        },
      ]
    );
  };

  // Execute address persistence & active location switch
  const executeSaveAddressAndSwitch = async (overrideContactType = null) => {
    setSavingAddress(true);
    triggerHaptic('medium');

    try {
      const finalContactType = overrideContactType || contactType;

      let saveLat = null;
      let saveLon = null;
      let saveLink = '';
      let saveHasPin = false;

      // Only save latitude, longitude, and googleMapsLink if a valid pin was confirmed
      if (
        hasPin &&
        pinCoords &&
        Number.isFinite(Number(pinCoords.lat)) &&
        Number.isFinite(Number(pinCoords.lon)) &&
        Number(pinCoords.lat) !== 0 &&
        Number(pinCoords.lon) !== 0
      ) {
        saveLat = Number(pinCoords.lat);
        saveLon = Number(pinCoords.lon);
        saveLink = (googleMapsLink || '').trim() || `https://www.google.com/maps?q=${saveLat},${saveLon}`;
        saveHasPin = true;
      }

      const effectiveStreet = streetName.trim() || completeAddress.trim().split(',')[0] || cityName.trim();
      const cityKey = (cityName || '').trim().toLowerCase();

      const parts = [
        completeAddress.trim(),
        effectiveStreet !== completeAddress.trim() ? effectiveStreet : null,
        cityName.trim(),
        districtName.trim(),
        stateName.trim(),
        pincodeVal.trim(),
      ].filter(Boolean);

      const resolvedTag = (customTag.trim() || selectedTag || 'Home').trim();
      const finalId = editingAddressId || `addr_${Date.now()}`;

      const addressPayload = {
        id: finalId,
        tag: resolvedTag,
        locationType: resolvedTag,
        label: `${resolvedTag} (${cityName.trim() || 'Saved'})`,
        completeAddress: completeAddress.trim(),
        street: effectiveStreet,
        area: effectiveStreet,
        city: cityName.trim(),
        district: districtName.trim() || (CITY_COORDINATES[cityKey]?.district || ''),
        state: stateName.trim() || (CITY_COORDINATES[cityKey]?.state || 'Tamil Nadu'),
        pincode: pincodeVal.trim(),
        country: selectedCountryName || 'India',
        googleMapsLink: saveLink,
        hasPin: saveHasPin,
        contactType: finalContactType,
        lat: saveLat,
        lon: saveLon,
        latitude: saveLat,
        longitude: saveLon,
        locationSource: saveHasPin ? 'map' : 'manual',
        receiverName: finalContactType === 'someone' ? receiverName.trim() : (receiverName.trim() || 'Customer'),
        receiverPhone: finalContactType === 'someone' ? receiverPhone.replace(/\D/g, '').slice(-10) : (receiverPhone.replace(/\D/g, '').slice(-10) || '9442461428'),
        formattedAddress: parts.join(', '),
        fullAddress: parts.join(', '),
        isActive: true,
      };

      const normalizedPayload = normalizeAddressPayload(addressPayload);
      await saveActiveLocation(userId, normalizedPayload);

      // Update in-memory saved addresses list
      setSavedAddresses(prev => {
        const withoutCurrent = prev.filter(item => item.id !== finalId);
        return [normalizedPayload, ...withoutCurrent];
      });

      setSavingAddress(false);
      setEditingAddressId(null);
      setIsOrderingForSomeoneAlertVisible(false);

      if (onSelectLocation) onSelectLocation(normalizedPayload);
      onClose();
    } catch (e) {
      setSavingAddress(false);
      console.log('Error saving address details:', e);
      Alert.alert('Error', 'Unable to save address. Please try again.');
    }
  };

  // Step 2 Proceed: Validate and trigger "Ordering for someone else?" alert
  const handleSaveAddressProceed = async () => {
    if (!cityName.trim()) {
      Alert.alert(isTamil ? 'நகரம் தேவை' : 'City Required', 'Please select a city.');
      handleOpenCityHierarchy('city');
      return;
    }
    if (!completeAddress.trim()) {
      Alert.alert(
        isTamil ? 'முழு முகவரி தேவை' : 'Complete Address Required',
        isTamil
          ? 'தயவுசெய்து உங்கள் வீடு / அடுக்குமாடி எண் மற்றும் கட்டிட பெயரை உள்ளிடவும்.'
          : 'Please enter your complete address (Flat/House/Apartment/Floor no).'
      );
      return;
    }

    // If user already specified "Someone else" and filled receiver's contact, save directly
    if (contactType === 'someone') {
      if (!receiverName.trim()) {
        Alert.alert(isTamil ? 'பெயர் தேவை' : 'Receiver Name Required', 'Please enter receiver name.');
        return;
      }
      if (!receiverPhone.trim() || receiverPhone.replace(/\D/g, '').length < 10) {
        Alert.alert(
          isTamil ? 'செல்லுபடியாகும் எண் தேவை' : 'Valid Phone Required',
          'Please enter a valid 10-digit mobile number.'
        );
        return;
      }
      await executeSaveAddressAndSwitch('someone');
      return;
    }

    // If editing existing address, update directly without triggering alert pop-up
    if (editingAddressId) {
      await executeSaveAddressAndSwitch(contactType);
      return;
    }

    // Trigger "Ordering for someone else?" alert sheet (Matching Blinkit screenshot media_1791887488521_c06d24f3.png)
    triggerHaptic('medium');
    setIsOrderingForSomeoneAlertVisible(true);
  };

  const handleConfirmSomeoneElse = () => {
    triggerHaptic('light');
    setIsOrderingForSomeoneAlertVisible(false);
    setContactType('someone');
    if (receiverName === 'Customer') setReceiverName('');
    if (receiverPhone === '9442461428') setReceiverPhone('');
    setTimeout(() => {
      receiverNameInputRef.current?.focus();
    }, 200);
  };

  const handleConfirmForMyself = async () => {
    triggerHaptic('medium');
    await executeSaveAddressAndSwitch('myself');
  };

  // ------------------------------------------
  // STEP 3 STATE: MAP PIN DROP
  // ------------------------------------------
  const [mapRegion, setMapRegion] = useState({
    latitude: DEFAULT_USER_LOCATION.lat,
    longitude: DEFAULT_USER_LOCATION.lon,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });
  const [resolvingPin, setResolvingPin] = useState(false);
  const reverseTimerRef = useRef(null);

  // Open map to set or change pin
  const handleOpenMapToSetPin = () => {
    triggerHaptic('light');
    // Save current pin state to restore on cancel
    previousPinStateRef.current = {
      hasPin,
      pinCoords: pinCoords ? { ...pinCoords } : null,
      googleMapsLink,
    };

    let targetLat = null;
    let targetLon = null;

    if (hasPin && pinCoords && Number.isFinite(Number(pinCoords.lat)) && Number.isFinite(Number(pinCoords.lon))) {
      targetLat = Number(pinCoords.lat);
      targetLon = Number(pinCoords.lon);
    } else {
      const resolved = getCoordinatesForAreaOrCity(cityName, districtName, stateName, streetName);
      targetLat = resolved.lat;
      targetLon = resolved.lon;
    }

    const region = {
      latitude: targetLat,
      longitude: targetLon,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };

    setMapRegion(region);
    setCurrentMapPinCoords({ latitude: targetLat, longitude: targetLon });
    setEditingLocation(prev => ({
      ...prev,
      lat: targetLat,
      lon: targetLon,
    }));
    setCurrentStep('map');
  };

  // Clear pin & URL
  const handleClearPin = () => {
    triggerHaptic('medium');
    setHasPin(false);
    setPinCoords(null);
    setGoogleMapsLink('');
    setEditingLocation(prev => ({
      ...prev,
      lat: null,
      lon: null,
      hasPin: false,
      googleMapsLink: '',
    }));
  };

  const handleRegionChangeComplete = region => {
    setMapRegion(region);
    setCurrentMapPinCoords({ latitude: region.latitude, longitude: region.longitude });
    if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);

    setResolvingPin(true);
    reverseTimerRef.current = setTimeout(async () => {
      try {
        const rev = await reverseGeocodeLocation(region.latitude, region.longitude);
        if (rev) {
          setEditingLocation(prev => ({
            ...prev,
            ...rev,
            lat: region.latitude,
            lon: region.longitude,
          }));
        }
      } catch (e) {
      } finally {
        setResolvingPin(false);
      }
    }, 450);
  };

  const handleConfirmMapLocation = () => {
    triggerHaptic('medium');
    const targetLat = currentMapPinCoords?.latitude ?? mapRegion.latitude;
    const targetLon = currentMapPinCoords?.longitude ?? mapRegion.longitude;

    if (!Number.isFinite(targetLat) || !Number.isFinite(targetLon)) {
      Alert.alert('Location Error', 'Unable to resolve map coordinates.');
      return;
    }

    const generatedLink = `https://www.google.com/maps?q=${targetLat},${targetLon}`;
    setHasPin(true);
    setPinCoords({ lat: Number(targetLat), lon: Number(targetLon) });
    setGoogleMapsLink(generatedLink);
    setEditingLocation(prev => ({
      ...prev,
      lat: Number(targetLat),
      lon: Number(targetLon),
      hasPin: true,
      googleMapsLink: generatedLink,
    }));

    setCurrentStep('add_details');
  };

  const handleCancelMapPin = () => {
    triggerHaptic('light');
    const prev = previousPinStateRef.current;
    setHasPin(prev.hasPin);
    setPinCoords(prev.pinCoords);
    setGoogleMapsLink(prev.googleMapsLink);
    setEditingLocation(ePrev => ({
      ...ePrev,
      lat: prev.pinCoords ? prev.pinCoords.lat : null,
      lon: prev.pinCoords ? prev.pinCoords.lon : null,
      hasPin: prev.hasPin,
      googleMapsLink: prev.googleMapsLink,
    }));

    setCurrentStep('add_details');
  };

  // Safe distance calculation relative to current active GPS
  const currentGpsLat = activeLocation?.lat || DEFAULT_USER_LOCATION.lat;
  const currentGpsLon = activeLocation?.lon || DEFAULT_USER_LOCATION.lon;

  const getTagVisual = tag => {
    const t = (tag || '').toLowerCase();
    if (t.includes('hotel')) return { name: 'business', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)' };
    if (t.includes('work') || t.includes('office')) return { name: 'briefcase', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
    if (t.includes('other')) return { name: 'location', color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.15)' };
    return { name: 'home', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
  };

  // Filter saved addresses by search
  const filteredAddresses = (savedAddresses || []).filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.label || '').toLowerCase().includes(q) ||
      (item.tag || '').toLowerCase().includes(q) ||
      (item.street || '').toLowerCase().includes(q) ||
      (item.city || '').toLowerCase().includes(q) ||
      (item.formattedAddress || '').toLowerCase().includes(q)
    );
  });

  // CONTENT RENDER PER STEP
  const renderFlowContent = () => {
    // ==========================================
    // STEP 1: SELECT DELIVERY LOCATION
    // ==========================================
    if (currentStep === 'select') {
      return (
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="location" size={18} color="#10B981" />
              </View>
              <Text style={[styles.sheetTitleText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                {isTamil ? 'டெலிவரி முகவரியைத் தேர்வுசெய்க' : 'Select Delivery Location'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View
            style={[
              styles.liquidSearchBar,
              {
                backgroundColor: isDarkMode ? '#132018' : '#F1F5F9',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <Ionicons name="search" size={17} color="#94A3B8" />
            <TextInput
              style={[styles.liquidSearchInput, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}
              placeholder={isTamil ? 'முகவரியைத் தேடுங்கள்...' : 'Search delivery location...'}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsCol}>
            {/* 1. Use Current Location Card */}
            <TouchableOpacity
              style={[
                styles.glassActionCard,
                {
                  backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
                  borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.2)',
                },
              ]}
              onPress={handleUseCurrentLocation}
              disabled={isDetectingGps}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                {isDetectingGps ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Ionicons name="navigate-circle" size={24} color="#EF4444" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                  {isTamil ? 'தற்போதைய இருப்பிடத்தைப் பயன்படுத்து' : 'Use current location'}
                </Text>
                <Text style={[styles.actionSub, { color: '#10B981' }]}>
                  {isDetectingGps
                    ? (isTamil ? 'GPS மூலம் கண்டறியப்படுகிறது...' : 'Detecting GPS...')
                    : (isTamil ? 'துல்லியமான GPS மூலம்' : 'Using GPS location')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>

            {/* 2. Add New Address Card */}
            <TouchableOpacity
              style={[
                styles.glassActionCard,
                {
                  backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                },
              ]}
              onPress={handleAddNewAddress}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
                <Ionicons name="add-circle" size={24} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                  {isTamil ? 'புதிய முகவரியைச் சேர்' : 'Add new address'}
                </Text>
                <Text style={[styles.actionSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {isTamil ? 'வீடு, அலுவலகம், ஹோட்டல்' : 'House, Flat, Street, City, Pincode'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Section: Saved Addresses from Firebase */}
          <View style={styles.sectionTitleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="file-tray-full-outline" size={14} color="#10B981" />
              <Text style={[styles.sectionTitleLabel, { color: isDarkMode ? '#A7F3D0' : '#15803D' }]}>
                {isTamil ? 'சேமிக்கப்பட்ட முகவரிகள்' : 'SAVED ADDRESSES'}
              </Text>
            </View>
            {loadingSaved && <ActivityIndicator size="small" color="#10B981" />}
          </View>

          <ScrollView style={styles.savedScrollArea} showsVerticalScrollIndicator={false}>
            {filteredAddresses.map(item => {
              const iconMeta = getTagVisual(item.tag || item.locationType);
              const dist =
                item.lat && item.lon
                  ? calculateDistance(currentGpsLat, currentGpsLon, item.lat, item.lon)
                  : null;

              const isSelected =
                activeLocation?.id === item.id ||
                (activeLocation?.formattedAddress &&
                  activeLocation?.formattedAddress === item.formattedAddress);

              return (
                <TouchableOpacity
                  key={item.id || item.tag}
                  style={[
                    styles.savedAddressCard,
                    {
                      backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
                      borderColor: isSelected
                        ? '#10B981'
                        : isDarkMode
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.06)',
                    },
                    isSelected && { borderWidth: 1.5 },
                  ]}
                  onPress={async () => {
                    triggerHaptic('light');
                    const resolved = normalizeAddressPayload(item);
                    await saveActiveLocation(userId, resolved);
                    if (onSelectLocation) onSelectLocation(resolved);
                    onClose();
                  }}
                  activeOpacity={0.85}
                >
                  {/* Top Row: Icon, Info, Dist, Selection checkmark */}
                  <View style={styles.savedCardTopRow}>
                    <View style={[styles.tagIconWrap, { backgroundColor: iconMeta.bg }]}>
                      <Ionicons name={iconMeta.name} size={18} color={iconMeta.color} />
                    </View>

                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={[styles.savedCardTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                          {item.tag || 'Saved Address'} ({item.city || item.area || 'Address'})
                        </Text>
                        {dist !== null && (
                          <View style={styles.distPill}>
                            <Text style={styles.distPillText}>{dist} km</Text>
                          </View>
                        )}
                      </View>

                      <Text
                        style={[styles.savedCardAddress, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}
                        numberOfLines={2}
                      >
                        {item.formattedAddress ||
                          item.fullAddress ||
                          [item.completeAddress, item.street, item.city, item.state, item.pincode].filter(Boolean).join(', ')}
                      </Text>

                      {item.receiverName && (
                        <Text style={{ fontSize: 11, color: isDarkMode ? '#6EE7B7' : '#059669', marginTop: 3 }}>
                          👤 {item.receiverName} • {item.receiverPhone || ''}
                        </Text>
                      )}
                    </View>

                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    )}
                  </View>

                  {/* Bottom Footer Row: Active Status Badge + Edit & Delete Action Chips */}
                  <View
                    style={[
                      styles.savedCardFooterRow,
                      { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
                    ]}
                  >
                    {isSelected ? (
                      <View style={styles.activeBadgePill}>
                        <Ionicons name="location" size={11} color="#10B981" />
                        <Text style={styles.activeBadgeText}>
                          {isTamil ? 'செயலில் உள்ளது' : 'Active location'}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flex: 1 }} />
                    )}

                    <View style={styles.savedCardActionBtns}>
                      {/* Edit Address Button */}
                      <TouchableOpacity
                        style={[
                          styles.cardActionChip,
                          {
                            backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#DCFCE7',
                            borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.2)',
                          },
                        ]}
                        onPress={() => handleEditSavedAddress(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="create-outline" size={13} color="#10B981" />
                        <Text style={[styles.cardActionChipText, { color: isDarkMode ? '#A7F3D0' : '#15803D' }]}>
                          {isTamil ? 'திருத்து' : 'Edit'}
                        </Text>
                      </TouchableOpacity>

                      {/* Delete Address Button */}
                      <TouchableOpacity
                        style={[
                          styles.cardActionChip,
                          {
                            backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#FEE2E2',
                            borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.2)',
                          },
                        ]}
                        onPress={() => handlePromptDeleteAddress(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        activeOpacity={0.7}
                        disabled={deletingAddressId === item.id}
                      >
                        {deletingAddressId === item.id ? (
                          <ActivityIndicator size="small" color="#EF4444" style={{ transform: [{ scale: 0.65 }] }} />
                        ) : (
                          <>
                            <Ionicons name="trash-outline" size={13} color="#EF4444" />
                            <Text style={[styles.cardActionChipText, { color: isDarkMode ? '#FCA5A5' : '#B91C1C' }]}>
                              {isTamil ? 'நீக்கு' : 'Delete'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {filteredAddresses.length === 0 && !loadingSaved && (
              <View style={styles.emptySavedContainer}>
                <Ionicons name="location-outline" size={36} color="#94A3B8" />
                <Text style={[styles.emptySavedTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                  {isTamil ? 'சேமிக்கப்பட்ட முகவரிகள் எதுவும் இல்லை' : 'No saved addresses yet'}
                </Text>
                <Text style={[styles.emptySavedSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {isTamil
                    ? 'விரைவான ஆர்டருக்கு மேலே உள்ள "+ புதிய முகவரியைச் சேர்" என்பதை அழுத்தவும்.'
                    : 'Tap "+ Add new address" above to save your home, work or hotel address.'}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      );
    }

    // ==========================================
    // STEP 2: ADD / EDIT ADDRESS DETAILS (Matching Image 1, 2, 3)
    // ==========================================
    if (currentStep === 'add_details') {
      // ----------------------------------------------------
      // UNIFIED LOCATION HIERARCHY (Country -> State -> District -> City -> Street)
      // ----------------------------------------------------
      const currentCountry = locationHierarchy[selectedCountryKey] || locationHierarchy['india'] || Object.values(locationHierarchy)[0];
      const selectedCountryName = currentCountry?.name || 'India';

      const currentState = currentCountry?.states?.[selectedStateKey] ||
        (currentCountry?.states ? Object.values(currentCountry.states)[0] : null);
      const selectedStateName = currentState?.name || stateName || 'Tamil Nadu';

      const currentDistrict = currentState?.districts?.[selectedDistrictKey] ||
        (currentState?.districts ? Object.values(currentState.districts)[0] : null);
      const selectedDistrictName = currentDistrict?.name || districtName || 'Virudhunagar';

      const currentCity = currentDistrict?.cities?.[selectedCityKey] ||
        (currentDistrict?.cities ? Object.values(currentDistrict.cities)[0] : null);

      // Filtered lists for the active step:
      const filteredCountries = Object.values(locationHierarchy || {}).filter(c =>
        !hierarchySearchQuery.trim() ||
        c.name.toLowerCase().includes(hierarchySearchQuery.toLowerCase())
      );

      const filteredStates = Object.values(currentCountry?.states || {}).filter(s =>
        !hierarchySearchQuery.trim() ||
        s.name.toLowerCase().includes(hierarchySearchQuery.toLowerCase())
      );

      const filteredDistricts = Object.values(currentState?.districts || {}).filter(d =>
        !hierarchySearchQuery.trim() ||
        d.name.toLowerCase().includes(hierarchySearchQuery.toLowerCase())
      );

      const filteredCities = Object.values(currentDistrict?.cities || {}).filter(c =>
        !hierarchySearchQuery.trim() ||
        c.name.toLowerCase().includes(hierarchySearchQuery.toLowerCase())
      );


      return (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetContainer}
        >
          {/* Header */}
          <View style={styles.sheetHeaderRow}>
            <TouchableOpacity
              onPress={() => {
                setEditingAddressId(null);
                setCurrentStep('select');
              }}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={22} color={isDarkMode ? '#FFFFFF' : '#0F172A'} />
            </TouchableOpacity>

            <Text style={[styles.sheetTitleText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
              {editingAddressId
                ? (isTamil ? 'முகவரி விவரங்களைத் திருத்த' : 'Edit address details')
                : (isTamil ? 'முகவரி விவரங்களைச் சேர்க்க' : 'Add address details')}
            </Text>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 28 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* SECTION 1: Address details */}
            <Text style={[styles.inputSectionHeading, { color: isDarkMode ? '#E2E8F0' : '#1E293B' }]}>
              {isTamil ? 'முகவரி விவரங்கள்' : 'Address details'}
            </Text>

            <View
              style={[
                styles.liquidCardContainer,
                {
                  backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
                  borderColor: isDarkMode ? 'rgba(34, 197, 94, 0.18)' : 'rgba(0,0,0,0.08)',
                },
              ]}
            >
              {/* Row 1: Select a city (Opens Location Hierarchy) */}
              <TouchableOpacity
                style={[
                  styles.selectorRow,
                  {
                    borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  },
                ]}
                onPress={() => {
                  handleOpenCityHierarchy('city');
                }}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.selectorIconWrap,
                    { backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7' },
                  ]}
                >
                  <Ionicons name="business" size={19} color="#F59E0B" />
                </View>

                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text
                    style={[
                      styles.selectorValueText,
                      {
                        color: cityName
                          ? (isDarkMode ? '#FFFFFF' : '#0F172A')
                          : (isDarkMode ? '#94A3B8' : '#64748B'),
                        fontWeight: cityName ? '700' : '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {cityName ? `${cityName}${districtName ? `, ${districtName}` : ''}` : (isTamil ? 'நகரத்தைத் தேர்வுசெய்க' : 'Select Country > State > City')}
                  </Text>
                  <Text style={{ fontSize: 10.5, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 1 }}>
                    {selectedCountryName} ➔ {selectedStateName}
                  </Text>
                </View>

                <Text style={styles.selectorActionText}>
                  {cityName ? (isTamil ? 'மாற்று' : 'Change') : (isTamil ? 'தேர்வு' : 'Select')}
                </Text>
              </TouchableOpacity>

              {/* Row 3: Enter complete address* */}
              <View style={styles.fieldBox}>
                <TextInput
                  style={[
                    styles.cleanInput,
                    {
                      color: isDarkMode ? '#FFFFFF' : '#0F172A',
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                  placeholder={isTamil ? 'முழு முகவரியை உள்ளிடவும்*' : 'Enter complete address*'}
                  placeholderTextColor="#94A3B8"
                  value={completeAddress}
                  onChangeText={setCompleteAddress}
                />
                <Text style={[styles.fieldHelperText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {isTamil
                    ? 'எடுத்துக்காட்டு: A-504, சாந்தி ஹைட்ஸ், மெயின் ரோடு, புதிய பேருந்து நிலையம் அருகில்'
                    : 'Example: A-504, Shanti Heights, Link Road, Near Inorbit Mall, Malad West'}
                </Text>
              </View>

              {/* Row 4: Google Maps link (Optional) */}
              <View
                style={[
                  styles.mapLinkRow,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                    borderColor: hasPin
                      ? (isDarkMode ? 'rgba(16, 185, 129, 0.45)' : 'rgba(16, 185, 129, 0.35)')
                      : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                    paddingRight: 6,
                  },
                ]}
              >
                <Ionicons
                  name={hasPin ? 'location' : 'map-outline'}
                  size={18}
                  color={hasPin ? '#10B981' : '#3B82F6'}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={[
                    styles.cleanInputInline,
                    {
                      color: hasPin
                        ? (isDarkMode ? '#34D399' : '#059669')
                        : (isDarkMode ? '#94A3B8' : '#64748B'),
                      fontSize: 12.5,
                      fontWeight: hasPin ? '600' : '400',
                    },
                  ]}
                  placeholder={
                    isTamil
                      ? 'கூகுள் மேப் இணைப்பு (விருப்பமானது - வரைபடம்)'
                      : 'Google Maps link (optional - tap Set Pin)'
                  }
                  placeholderTextColor="#94A3B8"
                  value={hasPin ? googleMapsLink : ''}
                  editable={false}
                />

                {hasPin ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      onPress={handleOpenMapToSetPin}
                      style={[
                        styles.pinMapMiniBtn,
                        { backgroundColor: isDarkMode ? 'rgba(16,185,129,0.18)' : '#DCFCE7' },
                      ]}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="create-outline" size={13} color="#10B981" />
                      <Text style={[styles.pinMapMiniBtnText, { color: '#10B981' }]}>
                        {isTamil ? 'மாற்று' : 'Change'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleClearPin}
                      style={[
                        styles.pinMapMiniBtn,
                        {
                          backgroundColor: isDarkMode ? 'rgba(239,68,68,0.15)' : '#FEE2E2',
                          borderColor: isDarkMode ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.25)',
                          borderWidth: 0.8,
                        },
                      ]}
                      activeOpacity={0.75}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                      <Ionicons name="trash-outline" size={13} color="#EF4444" />
                      <Text style={[styles.pinMapMiniBtnText, { color: '#EF4444' }]}>
                        {isTamil ? 'நீக்கு' : 'Clear'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleOpenMapToSetPin}
                    style={styles.pinMapMiniBtn}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="locate" size={14} color="#10B981" />
                    <Text style={styles.pinMapMiniBtnText}>
                      {isTamil ? 'வரைபடம்' : 'Set Pin'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* SECTION 2: Contact details */}
            <Text style={[styles.inputSectionHeading, { color: isDarkMode ? '#E2E8F0' : '#1E293B', marginTop: 18 }]}>
              {isTamil ? 'தொடர்பு விவரங்கள்' : 'Contact details'}
            </Text>

            <View
              style={[
                styles.liquidCardContainer,
                {
                  backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
                  borderColor: isDarkMode ? 'rgba(34, 197, 94, 0.18)' : 'rgba(0,0,0,0.08)',
                },
              ]}
            >
              {/* Radio: Myself vs Someone else */}
              <View style={styles.radioGroupRow}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => {
                    triggerHaptic('light');
                    setContactType('myself');
                    setReceiverName('Customer');
                    setReceiverPhone('9442461428');
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      contactType === 'myself' && { borderColor: '#10B981' },
                    ]}
                  >
                    {contactType === 'myself' && <View style={styles.radioInnerDot} />}
                  </View>
                  <Text style={[styles.radioLabel, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                    {isTamil ? 'எனக்கு' : 'Myself'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => {
                    triggerHaptic('light');
                    setContactType('someone');
                    setReceiverName('');
                    setReceiverPhone('');
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      contactType === 'someone' && { borderColor: '#10B981' },
                    ]}
                  >
                    {contactType === 'someone' && <View style={styles.radioInnerDot} />}
                  </View>
                  <Text style={[styles.radioLabel, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                    {isTamil ? 'மற்றவருக்கு' : 'Someone else'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Receiver's name* */}
              <View style={styles.contactFieldBox}>
                <TextInput
                  ref={receiverNameInputRef}
                  style={[
                    styles.cleanInput,
                    {
                      color: isDarkMode ? '#FFFFFF' : '#0F172A',
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                  placeholder={isTamil ? 'பெறுநரின் பெயர்*' : "Receiver's name*"}
                  placeholderTextColor="#94A3B8"
                  value={receiverName}
                  onChangeText={setReceiverName}
                />
              </View>

              {/* Receiver's phone number* */}
              <View style={styles.contactFieldBox}>
                <View
                  style={[
                    styles.phoneInputRow,
                    {
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                >
                  <Text style={[styles.countryCodeText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                    +91
                  </Text>
                  <TextInput
                    style={[styles.phoneInputText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}
                    placeholder={isTamil ? 'மொபைல் எண்*' : "Receiver's phone number*"}
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={receiverPhone}
                    onChangeText={setReceiverPhone}
                  />
                  <Ionicons name="call-outline" size={18} color="#94A3B8" style={{ marginLeft: 6 }} />
                </View>
              </View>

              {/* Save as address (optional) */}
              <View style={styles.contactFieldBox}>
                <TextInput
                  style={[
                    styles.cleanInput,
                    {
                      color: isDarkMode ? '#FFFFFF' : '#0F172A',
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                  placeholder={isTamil ? 'முகவரி வகை (விருப்பமானது)' : 'Save as address (optional)'}
                  placeholderTextColor="#94A3B8"
                  value={customTag}
                  onChangeText={t => {
                    setCustomTag(t);
                    setSelectedTag(t || 'Home');
                  }}
                />

                {/* Tag Quick Chips */}
                <View style={styles.tagChipsRow}>
                  {tagOptions.map(opt => {
                    const isSelected = selectedTag === opt.id && !customTag;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.tagChipItem,
                          {
                            backgroundColor: isSelected
                              ? (isDarkMode ? '#0E3624' : '#DCFCE7')
                              : (isDarkMode ? '#132018' : '#F1F5F9'),
                            borderColor: isSelected
                              ? '#10B981'
                              : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                          },
                        ]}
                        onPress={() => {
                          triggerHaptic('light');
                          setCustomTag('');
                          setSelectedTag(opt.id);
                        }}
                      >
                        <Ionicons
                          name={opt.icon}
                          size={13}
                          color={isSelected ? '#10B981' : (isDarkMode ? '#94A3B8' : '#64748B')}
                        />
                        <Text
                          style={[
                            styles.tagChipText,
                            {
                              color: isSelected ? '#10B981' : (isDarkMode ? '#E2E8F0' : '#1E293B'),
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Sticky Bottom Next Button */}
            <TouchableOpacity
              style={[
                styles.primaryNextBtn,
                { backgroundColor: '#10B981' },
                savingAddress && { opacity: 0.7 },
              ]}
              onPress={handleSaveAddressProceed}
              disabled={savingAddress}
              activeOpacity={0.85}
            >
              {savingAddress ? (
                <ActivityIndicator color="#050906" size="small" />
              ) : (
                <Text style={styles.primaryNextBtnText}>
                  {editingAddressId
                    ? (isTamil ? 'முகவரியைப் புதுப்பி ➔' : 'Update address ➔')
                    : (isTamil ? 'அடுத்து (சேமிக்க) ➔' : 'Next ➔')}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>

          {/* UNIFIED PROGRESSIVE LOCATION HIERARCHY SHEET (Liquid Glass) */}
          {/* Step Sequence: Country -> State -> District -> City -> Street */}
          {isLocationHierarchySheetOpen && (
            <View
              style={[
                styles.nestedSheetOverlay,
                { backgroundColor: isDarkMode ? '#080E0A' : '#F8FAFC' },
              ]}
            >
              {/* Grab Handle */}
              <View style={styles.sheetHandleBar}>
                <View style={styles.sheetGrabHandle} />
              </View>

              {/* Liquid Header */}
              <View style={styles.liquidSheetHeaderRow}>
                <TouchableOpacity
                  style={[
                    styles.liquidSheetCloseBtn,
                    {
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
                      marginRight: 8,
                    },
                  ]}
                  onPress={handleHierarchyBack}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={hierarchyStep === 'country' ? 'close' : 'arrow-back'}
                    size={18}
                    color={isDarkMode ? '#FFFFFF' : '#0F172A'}
                  />
                </TouchableOpacity>

                <View
                  style={[
                    styles.sheetHeaderIconPill,
                    { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' },
                  ]}
                >
                  <Ionicons
                    name={
                      hierarchyStep === 'country'
                        ? 'earth'
                        : hierarchyStep === 'state'
                        ? 'map-outline'
                        : hierarchyStep === 'district'
                        ? 'compass-outline'
                        : 'business-outline'
                    }
                    size={20}
                    color="#10B981"
                  />
                </View>

                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={[styles.liquidSheetMainTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
                    {hierarchyStep === 'country'
                      ? (isTamil ? 'நாட்டைத் தேர்வுசெய்க' : 'Select Country')
                      : hierarchyStep === 'state'
                      ? (isTamil ? `${selectedCountryName} மாநிலங்கள்` : `Select State in ${selectedCountryName}`)
                      : hierarchyStep === 'district'
                      ? (isTamil ? `${selectedDistrictName} மாவட்டங்கள்` : `Select District in ${selectedDistrictName}`)
                      : (isTamil ? `${selectedDistrictName} நகரங்கள்` : `Select City in ${selectedDistrictName}`)}
                  </Text>
                  <Text style={[styles.liquidSheetSubTitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                    {hierarchyStep === 'country'
                      ? (isTamil ? 'நாடுகள் & Upstage POS கடைகள்' : 'Countries & Upstage POS store hubs')
                      : hierarchyStep === 'state'
                      ? (isTamil ? 'மாவட்டங்களைக் காண மாநிலத்தைத் தேர்வுசெய்க' : 'Choose state to view available districts')
                      : hierarchyStep === 'district'
                      ? (isTamil ? 'நகரங்களைக் காண மாவட்டத்தைத் தேர்வுசெய்க' : 'Choose district to view available cities')
                      : (isTamil ? 'நகரத்தைத் தேர்வுசெய்க' : 'Choose city to set delivery destination')}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.liquidSheetCloseBtn,
                    {
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                  onPress={() => {
                    triggerHaptic('light');
                    setIsLocationHierarchySheetOpen(false);
                    setHierarchySearchQuery('');
                  }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={18} color={isDarkMode ? '#FFFFFF' : '#0F172A'} />
                </TouchableOpacity>
              </View>

              {/* BREADCRUMB PROGRESS TRACK */}
              <View style={{ marginBottom: 8 }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.breadcrumbTrack}
                >
                  {/* Crumb: All Countries */}
                  <TouchableOpacity
                    style={[
                      styles.breadcrumbChip,
                      {
                        backgroundColor: hierarchyStep === 'country'
                          ? (isDarkMode ? '#0E3624' : '#DCFCE7')
                          : (isDarkMode ? '#111D15' : '#FFFFFF'),
                        borderColor: hierarchyStep === 'country'
                          ? '#10B981'
                          : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                      },
                      hierarchyStep === 'country' && styles.breadcrumbChipActive,
                    ]}
                    onPress={() => {
                      triggerHaptic('light');
                      setHierarchyStep('country');
                      setHierarchySearchQuery('');
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={{ fontSize: 13 }}>🌐</Text>
                    <Text
                      style={[
                        styles.breadcrumbText,
                        {
                          color: hierarchyStep === 'country'
                            ? '#10B981'
                            : (isDarkMode ? '#94A3B8' : '#64748B'),
                        },
                      ]}
                    >
                      {isTamil ? 'அனைத்து நாடுகள்' : 'All Countries'}
                    </Text>
                  </TouchableOpacity>

                  {/* Crumb: Country */}
                  {selectedCountryKey ? (
                    <>
                      <Ionicons name="chevron-forward" size={13} color="#94A3B8" style={styles.breadcrumbSeparator} />
                      <TouchableOpacity
                        style={[
                          styles.breadcrumbChip,
                          {
                            backgroundColor: hierarchyStep === 'state'
                              ? (isDarkMode ? '#0E3624' : '#DCFCE7')
                              : (isDarkMode ? '#111D15' : '#FFFFFF'),
                            borderColor: hierarchyStep === 'state'
                              ? '#10B981'
                              : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                          },
                          hierarchyStep === 'state' && styles.breadcrumbChipActive,
                        ]}
                        onPress={() => {
                          triggerHaptic('light');
                          setHierarchyStep('state');
                          setHierarchySearchQuery('');
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={{ fontSize: 13 }}>{currentCountry?.flag || '🇮🇳'}</Text>
                        <Text
                          style={[
                            styles.breadcrumbText,
                            {
                              color: hierarchyStep === 'state'
                                ? '#10B981'
                                : (isDarkMode ? '#FFFFFF' : '#0F172A'),
                              fontWeight: hierarchyStep === 'state' ? '800' : '600',
                            },
                          ]}
                        >
                          {selectedCountryName}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : null}

                  {/* Crumb: State */}
                  {selectedStateName && (hierarchyStep === 'district' || hierarchyStep === 'city') ? (
                    <>
                      <Ionicons name="chevron-forward" size={13} color="#94A3B8" style={styles.breadcrumbSeparator} />
                      <TouchableOpacity
                        style={[
                          styles.breadcrumbChip,
                          {
                            backgroundColor: hierarchyStep === 'district'
                              ? (isDarkMode ? '#0E3624' : '#DCFCE7')
                              : (isDarkMode ? '#111D15' : '#FFFFFF'),
                            borderColor: hierarchyStep === 'district'
                              ? '#10B981'
                              : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                          },
                          hierarchyStep === 'district' && styles.breadcrumbChipActive,
                        ]}
                        onPress={() => {
                          triggerHaptic('light');
                          setHierarchyStep('district');
                          setHierarchySearchQuery('');
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.breadcrumbText,
                            {
                              color: hierarchyStep === 'district'
                                ? '#10B981'
                                : (isDarkMode ? '#FFFFFF' : '#0F172A'),
                              fontWeight: hierarchyStep === 'district' ? '800' : '600',
                            },
                          ]}
                        >
                          {selectedStateName}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : null}

                  {/* Crumb: District */}
                  {selectedDistrictName && hierarchyStep === 'city' ? (
                    <>
                      <Ionicons name="chevron-forward" size={13} color="#94A3B8" style={styles.breadcrumbSeparator} />
                      <TouchableOpacity
                        style={[
                          styles.breadcrumbChip,
                          {
                            backgroundColor: hierarchyStep === 'city'
                              ? (isDarkMode ? '#0E3624' : '#DCFCE7')
                              : (isDarkMode ? '#111D15' : '#FFFFFF'),
                            borderColor: hierarchyStep === 'city'
                              ? '#10B981'
                              : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                          },
                          hierarchyStep === 'city' && styles.breadcrumbChipActive,
                        ]}
                        onPress={() => {
                          triggerHaptic('light');
                          setHierarchyStep('city');
                          setHierarchySearchQuery('');
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.breadcrumbText,
                            {
                              color: hierarchyStep === 'city'
                                ? '#10B981'
                                : (isDarkMode ? '#FFFFFF' : '#0F172A'),
                              fontWeight: hierarchyStep === 'city' ? '800' : '600',
                            },
                          ]}
                        >
                          {selectedDistrictName}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </ScrollView>
              </View>

              {/* Search Bar */}
              <View style={{ paddingHorizontal: 16 }}>
                <View
                  style={[
                    styles.nestedSearchBar,
                    {
                      backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
                      borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 0, 0, 0.1)',
                    },
                  ]}
                >
                  <Ionicons name="search" size={17} color="#10B981" />
                  <TextInput
                    style={[styles.nestedSearchInput, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}
                    placeholder={
                      hierarchyStep === 'country'
                        ? (isTamil ? 'நாட்டைத் தேடு (எ.கா: India, UAE)...' : 'Search country (e.g. India, UAE)...')
                        : hierarchyStep === 'state'
                        ? (isTamil ? 'மாநிலத்தைத் தேடு (எ.கா: Tamil Nadu)...' : 'Search state (e.g. Tamil Nadu)...')
                        : hierarchyStep === 'district'
                        ? (isTamil ? 'மாவட்டத்தைத் தேடு (எ.கா: Virudhunagar)...' : 'Search district (e.g. Virudhunagar)...')
                        : (isTamil ? 'நகரத்தைத் தேடு (எ.கா: Sattur, Sivakasi)...' : 'Search city in district...')
                    }
                    placeholderTextColor="#94A3B8"
                    value={hierarchySearchQuery}
                    onChangeText={setHierarchySearchQuery}
                  />
                  {hierarchySearchQuery ? (
                    <TouchableOpacity
                      onPress={() => {
                        triggerHaptic('light');
                        setHierarchySearchQuery('');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* LIST CONTENT */}
              <ScrollView
                style={{ flex: 1, paddingHorizontal: 16 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 36 }}
              >
                {/* ------------------------------------------- */}
                {/* STEP 1: COUNTRIES                           */}
                {/* ------------------------------------------- */}
                {hierarchyStep === 'country' && (
                  <View>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name="earth" size={14} color="#10B981" />
                      <Text style={[styles.nestedSectionLabel, { color: isDarkMode ? '#A7F3D0' : '#15803D' }]}>
                        {isTamil ? 'கிடைக்கக்கூடிய நாடுகள்' : 'Available Countries'}
                      </Text>
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{filteredCountries.length}</Text>
                      </View>
                    </View>

                    {filteredCountries.map(country => {
                      const isSelected = selectedCountryKey === country.id;
                      return (
                        <TouchableOpacity
                          key={country.id}
                          style={[
                            styles.cityListItem,
                            {
                              backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
                              borderColor: isSelected
                                ? '#10B981'
                                : (isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
                            },
                            isSelected && { borderWidth: 1.6 },
                          ]}
                          onPress={() => handleSelectCountryInHierarchy(country)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.areaIconWrap,
                              { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' },
                            ]}
                          >
                            <Text style={{ fontSize: 16 }}>{country.flag || '🌐'}</Text>
                          </View>

                          <View style={{ flex: 1, marginHorizontal: 10 }}>
                            <Text
                              style={[
                                styles.cityListItemText,
                                {
                                  color: isSelected ? '#10B981' : (isDarkMode ? '#FFFFFF' : '#0F172A'),
                                  fontWeight: isSelected ? '800' : '600',
                                },
                              ]}
                            >
                              {country.name}
                            </Text>
                            <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 1 }}>
                              {country.states ? `${Object.keys(country.states).length} states / regions` : 'Country'}
                            </Text>
                          </View>

                          {country.storeCount > 0 && (
                            <View style={styles.storeLocalityPill}>
                              <Text style={styles.storeLocalityPillText}>
                                ⚡ {country.storeCount} {country.storeCount === 1 ? 'Store' : 'Stores'}
                              </Text>
                            </View>
                          )}

                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={isSelected ? '#10B981' : '#94A3B8'}
                            style={{ marginLeft: 6 }}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* ------------------------------------------- */}
                {/* STEP 2: STATES IN SELECTED COUNTRY          */}
                {/* ------------------------------------------- */}
                {hierarchyStep === 'state' && (
                  <View>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name="map-outline" size={14} color="#10B981" />
                      <Text style={[styles.nestedSectionLabel, { color: isDarkMode ? '#A7F3D0' : '#15803D' }]}>
                        {isTamil ? `${selectedCountryName} மாநிலங்கள்` : `States in ${selectedCountryName}`}
                      </Text>
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{filteredStates.length}</Text>
                      </View>
                    </View>

                    {filteredStates.map(state => {
                      const isSelected = selectedStateKey === state.id;
                      return (
                        <TouchableOpacity
                          key={state.id}
                          style={[
                            styles.cityListItem,
                            {
                              backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
                              borderColor: isSelected
                                ? '#10B981'
                                : (isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
                            },
                            isSelected && { borderWidth: 1.6 },
                          ]}
                          onPress={() => handleSelectStateInHierarchy(state)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.areaIconWrap,
                              { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' },
                            ]}
                          >
                            <Ionicons name="map" size={16} color="#10B981" />
                          </View>

                          <View style={{ flex: 1, marginHorizontal: 10 }}>
                            <Text
                              style={[
                                styles.cityListItemText,
                                {
                                  color: isSelected ? '#10B981' : (isDarkMode ? '#FFFFFF' : '#0F172A'),
                                  fontWeight: isSelected ? '800' : '600',
                                },
                              ]}
                            >
                              {state.name}
                            </Text>
                            <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 1 }}>
                              {state.districts ? `${Object.keys(state.districts).length} districts` : selectedCountryName}
                            </Text>
                          </View>

                          {state.storeCount > 0 && (
                            <View style={styles.storeLocalityPill}>
                              <Text style={styles.storeLocalityPillText}>
                                ⚡ {state.storeCount} {state.storeCount === 1 ? 'Store' : 'Stores'}
                              </Text>
                            </View>
                          )}

                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={isSelected ? '#10B981' : '#94A3B8'}
                            style={{ marginLeft: 6 }}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* ------------------------------------------- */}
                {/* STEP 3: DISTRICTS IN SELECTED STATE         */}
                {/* ------------------------------------------- */}
                {hierarchyStep === 'district' && (
                  <View>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name="compass-outline" size={14} color="#10B981" />
                      <Text style={[styles.nestedSectionLabel, { color: isDarkMode ? '#A7F3D0' : '#15803D' }]}>
                        {isTamil ? `${selectedStateName} மாவட்டங்கள்` : `Districts in ${selectedStateName}`}
                      </Text>
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{filteredDistricts.length}</Text>
                      </View>
                    </View>

                    {filteredDistricts.map(district => {
                      const isSelected = selectedDistrictKey === district.id;
                      return (
                        <TouchableOpacity
                          key={district.id}
                          style={[
                            styles.cityListItem,
                            {
                              backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
                              borderColor: isSelected
                                ? '#10B981'
                                : (isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
                            },
                            isSelected && { borderWidth: 1.6 },
                          ]}
                          onPress={() => handleSelectDistrictInHierarchy(district)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.areaIconWrap,
                              { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' },
                            ]}
                          >
                            <Ionicons name="compass" size={16} color="#10B981" />
                          </View>

                          <View style={{ flex: 1, marginHorizontal: 10 }}>
                            <Text
                              style={[
                                styles.cityListItemText,
                                {
                                  color: isSelected ? '#10B981' : (isDarkMode ? '#FFFFFF' : '#0F172A'),
                                  fontWeight: isSelected ? '800' : '600',
                                },
                              ]}
                            >
                              {district.name}
                            </Text>
                            <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 1 }}>
                              {district.cities ? `${Object.keys(district.cities).length} cities & towns` : selectedStateName}
                            </Text>
                          </View>

                          {district.storeCount > 0 && (
                            <View style={styles.storeLocalityPill}>
                              <Text style={styles.storeLocalityPillText}>
                                ⚡ {district.storeCount} {district.storeCount === 1 ? 'Store' : 'Stores'}
                              </Text>
                            </View>
                          )}

                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={isSelected ? '#10B981' : '#94A3B8'}
                            style={{ marginLeft: 6 }}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* ------------------------------------------- */}
                {/* STEP 4: CITIES IN SELECTED DISTRICT         */}
                {/* (No Top Cities, No All Cities)              */}
                {/* ------------------------------------------- */}
                {hierarchyStep === 'city' && (
                  <View>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name="business" size={14} color="#10B981" />
                      <Text style={[styles.nestedSectionLabel, { color: isDarkMode ? '#A7F3D0' : '#15803D' }]}>
                        {isTamil ? `${selectedDistrictName} நகரங்கள்` : `Cities & Towns in ${selectedDistrictName}`}
                      </Text>
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{filteredCities.length}</Text>
                      </View>
                    </View>

                    {/* Custom search option if query not in list */}
                    {hierarchySearchQuery.trim() ? (
                      <TouchableOpacity
                        style={[
                          styles.cityListItem,
                          {
                            backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
                            borderColor: '#10B981',
                            borderWidth: 1.4,
                            marginBottom: 10,
                          },
                        ]}
                        onPress={() => {
                          handleSelectCityInHierarchy({
                            id: hierarchySearchQuery.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'),
                            name: hierarchySearchQuery.trim(),
                            district: selectedDistrictName,
                            state: selectedStateName,
                            country: selectedCountryName,
                          });
                        }}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.areaIconWrap,
                            { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' },
                          ]}
                        >
                          <Ionicons name="location" size={16} color="#10B981" />
                        </View>
                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                          <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 13.5 }}>
                            {isTamil ? `"${hierarchySearchQuery}" எனப் பயன்படுத்து` : `Use "${hierarchySearchQuery}" as city`}
                          </Text>
                          <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B', fontSize: 11, marginTop: 1 }}>
                            {selectedDistrictName}, {selectedStateName}
                          </Text>
                        </View>
                        <Ionicons name="arrow-forward" size={16} color="#10B981" />
                      </TouchableOpacity>
                    ) : null}

                    {filteredCities.map(city => {
                      const isSelected = cityName.toLowerCase() === city.name.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={city.id}
                          style={[
                            styles.cityListItem,
                            {
                              backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
                              borderColor: isSelected
                                ? '#10B981'
                                : (isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
                            },
                            isSelected && { borderWidth: 1.6 },
                          ]}
                          onPress={() => handleSelectCityInHierarchy(city)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.areaIconWrap,
                              { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' },
                            ]}
                          >
                            <Ionicons name="business" size={16} color="#10B981" />
                          </View>

                          <View style={{ flex: 1, marginHorizontal: 10 }}>
                            <Text
                              style={[
                                styles.cityListItemText,
                                {
                                  color: isSelected ? '#10B981' : (isDarkMode ? '#FFFFFF' : '#0F172A'),
                                  fontWeight: isSelected ? '800' : '600',
                                },
                              ]}
                            >
                              {city.name}
                            </Text>
                            <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 1 }}>
                              {city.district || selectedDistrictName}, {city.state || selectedStateName}
                            </Text>
                          </View>

                          {city.storeCount > 0 && (
                            <View style={styles.storeLocalityPill}>
                              <Text style={styles.storeLocalityPillText}>
                                ⚡ {city.storeCount} {city.storeCount === 1 ? 'Store' : 'Stores'}
                              </Text>
                            </View>
                          )}

                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={isSelected ? '#10B981' : '#94A3B8'}
                            style={{ marginLeft: 6 }}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}


              </ScrollView>
            </View>
          )}
        </KeyboardAvoidingView>
      );
    }

    // ==========================================
    // STEP 3: INTERACTIVE MAP PIN CONFIRMATION
    // ==========================================
    if (currentStep === 'map') {
      const liveAddress =
        editingLocation?.formattedAddress ||
        [editingLocation?.street, editingLocation?.city, editingLocation?.district, editingLocation?.state, editingLocation?.pincode]
          .filter(Boolean)
          .join(', ');

      const activePinLat = currentMapPinCoords?.latitude ?? mapRegion.latitude;
      const activePinLon = currentMapPinCoords?.longitude ?? mapRegion.longitude;

      return (
        <View style={styles.sheetContainer}>
          {/* Top Bar on Map */}
          <View style={styles.mapTopHeader}>
            <TouchableOpacity
              onPress={handleCancelMapPin}
              style={[styles.mapHeaderCircleBtn, { backgroundColor: isDarkMode ? '#132018' : '#FFFFFF' }]}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color={isDarkMode ? '#FFFFFF' : '#0F172A'} />
            </TouchableOpacity>

            <View
              style={[
                styles.mapSearchPill,
                { backgroundColor: isDarkMode ? '#132018' : '#FFFFFF' },
              ]}
            >
              <Ionicons name="location" size={16} color="#10B981" />
              <Text style={[styles.mapSearchText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
                {cityName ? `${cityName}${districtName ? `, ${districtName}` : ''}` : (editingLocation?.city || 'Select pin location')}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleCancelMapPin}
              style={[styles.mapHeaderCircleBtn, { backgroundColor: isDarkMode ? '#132018' : '#FFFFFF' }]}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={20} color={isDarkMode ? '#FFFFFF' : '#0F172A'} />
            </TouchableOpacity>
          </View>

          {/* Map Area */}
          <View style={{ flex: 1, position: 'relative' }}>
            {MapView ? (
              <MapView
                style={StyleSheet.absoluteFillObject}
                initialRegion={mapRegion}
                region={mapRegion}
                onRegionChangeComplete={handleRegionChangeComplete}
                showsUserLocation={false}
                showsMyLocationButton={false}
              />
            ) : (
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="map-outline" size={56} color="#94A3B8" />
                <Text style={{ color: '#94A3B8', marginTop: 8, fontSize: 13 }}>Interactive Pin Location</Text>
              </View>
            )}

            {/* Center Fixed Pin */}
            <View style={styles.centerPinWrap} pointerEvents="none">
              <Ionicons name="location" size={44} color="#EF4444" />
              <View style={styles.centerPinShadow} />
            </View>
          </View>

          {/* Floating Bottom Card */}
          <View
            style={[
              styles.floatingBottomCard,
              {
                backgroundColor: isDarkMode ? '#0D1711' : '#FFFFFF',
                borderTopColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              },
            ]}
          >
            <View style={styles.cardDragBar} />

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 }}>
              <View style={[styles.mapPinBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="location" size={20} color="#EF4444" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.bottomCardTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                  {isTamil ? 'இங்கே ஆர்டர் டெலிவரி செய்யப்படும்' : 'Order will be delivered here'}
                </Text>
                <Text style={[styles.bottomCardSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {isTamil
                    ? 'துல்லியமான இடத்திற்கு டெலிவரி செய்ய முள்ளை வரைபடத்தில் சரியாக வைக்கவும்'
                    : 'Place the pin accurately on the map to help us deliver to the right door'}
                </Text>
                <Text
                  style={[styles.bottomCardAddress, { color: isDarkMode ? '#A7F3D0' : '#15803D' }]}
                  numberOfLines={2}
                >
                  {resolvingPin
                    ? (isTamil ? 'முகவரி கண்டறியப்படுகிறது...' : 'Resolving address...')
                    : (liveAddress || `${Number(activePinLat).toFixed(5)}, ${Number(activePinLon).toFixed(5)}`)}
                </Text>
              </View>
            </View>

            {/* Actions: Cancel & Confirm buttons side-by-side */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                style={[
                  styles.cancelPinBtn,
                  {
                    flex: 1,
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                    borderWidth: 1,
                  },
                ]}
                onPress={handleCancelMapPin}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelPinBtnText, { color: isDarkMode ? '#E2E8F0' : '#475569' }]}>
                  {isTamil ? 'ரத்து' : 'Cancel'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmPinBtn, { flex: 2, backgroundColor: '#10B981', marginTop: 0 }]}
                onPress={handleConfirmMapLocation}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmPinBtnText}>
                  {isTamil ? 'இடத்தை உறுதி செய்க ➔' : 'Confirm Location ➔'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

  // ==========================================
  // "ORDERING FOR SOMEONE ELSE?" LIQUID GLASS ALERT MODAL
  // ==========================================
  const renderOrderingForSomeoneAlert = () => {
    if (!isOrderingForSomeoneAlertVisible) return null;

    return (
      <View style={styles.liquidAlertBackdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={() => {
            triggerHaptic('light');
            setIsOrderingForSomeoneAlertVisible(false);
          }}
          activeOpacity={1}
        />

        <View
          style={[
            styles.liquidAlertSheet,
            {
              backgroundColor: isDarkMode ? '#0B150E' : '#FFFFFF',
              borderColor: isDarkMode ? 'rgba(34, 197, 94, 0.25)' : 'rgba(22, 163, 74, 0.15)',
            },
          ]}
        >
          {/* Grab Handle */}
          <View style={styles.sheetGrabHandle} />

          {/* Header Row */}
          <View style={styles.liquidAlertHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={[
                  styles.headerIconCircle,
                  { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#DCFCE7' },
                ]}
              >
                <Ionicons name="gift-outline" size={18} color="#10B981" />
              </View>
              <Text style={[styles.sheetTitleText, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                {isTamil ? 'மற்றவருக்கு ஆர்டர் செய்கிறீர்களா?' : 'Ordering for someone else?'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                triggerHaptic('light');
                setIsOrderingForSomeoneAlertVisible(false);
              }}
              style={[
                styles.closeCircleBtn,
                { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9' },
              ]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={20} color={isDarkMode ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {/* Liquid Glass Hero Card */}
          <View
            style={[
              styles.liquidHeroCard,
              {
                backgroundColor: isDarkMode ? '#111D15' : '#F4F9F5',
                borderColor: isDarkMode ? 'rgba(34, 197, 94, 0.22)' : 'rgba(22, 163, 74, 0.15)',
              },
            ]}
          >
            {/* Ambient Triple Glass Bubble Cluster */}
            <View style={styles.glassBubbleCluster}>
              <View
                style={[
                  styles.glassBubble,
                  { backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.14)' : '#E0F2FE' },
                ]}
              >
                <Ionicons name="person" size={20} color="#38BDF8" />
              </View>

              <View
                style={[
                  styles.glassBubbleCenter,
                  { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7' },
                ]}
              >
                <Ionicons name="heart" size={26} color="#10B981" />
              </View>

              <View
                style={[
                  styles.glassBubble,
                  { backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.14)' : '#FEF3C7' },
                ]}
              >
                <Ionicons name="home" size={20} color="#F59E0B" />
              </View>
            </View>

            {/* Tag Pill */}
            <View
              style={[
                styles.alertTagPill,
                {
                  backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.14)' : '#DCFCE7',
                  borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)',
                },
              ]}
            >
              <Ionicons name="sparkles" size={11} color="#10B981" />
              <Text style={styles.alertTagPillText}>
                {isTamil ? 'உடனடி டெலிவரி • அன்புடன்' : 'EXPRESS DELIVERY • GIFT & CARE'}
              </Text>
            </View>

            <Text style={[styles.heroCardHeading, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
              {isTamil ? 'குடும்பத்தினர் அல்லது நண்பர்களுக்கு பரிசளிக்க' : 'Send groceries directly to loved ones'}
            </Text>
            <Text style={[styles.heroCardSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              {isTamil
                ? 'பெறுநரின் விவரங்களைச் சேர்த்தால், டெலிவரி பார்ட்னர் அவர்களுடன் எளிதாக தொடர்பு கொள்வார்.'
                : 'Add receiver details so our delivery partner coordinates directly with them at their door.'}
            </Text>
          </View>

          {/* 2 Feature Benefit Cards */}
          <View style={styles.benefitsCol}>
            {/* Benefit 1 */}
            <View
              style={[
                styles.glassBenefitCard,
                {
                  backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                },
              ]}
            >
              <View
                style={[
                  styles.benefitIconWrap,
                  { backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.14)' : '#E0F2FE' },
                ]}
              >
                <Ionicons name="call" size={19} color="#38BDF8" />
              </View>
              <View style={{ flex: 1, marginHorizontal: 10 }}>
                <Text style={[styles.benefitTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                  {isTamil ? 'பெறுநரின் தொடர்பு எண்' : "Receiver's Contact Number"}
                </Text>
                <Text style={[styles.benefitSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {isTamil
                    ? 'டெலிவரி அழைப்புகள் அவர்களுக்கு நேரடியாக செல்லும்'
                    : 'Alternate phone number for smooth delivery verification'}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={17} color="#10B981" />
            </View>

            {/* Benefit 2 */}
            <View
              style={[
                styles.glassBenefitCard,
                {
                  backgroundColor: isDarkMode ? '#111D15' : '#FFFFFF',
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                },
              ]}
            >
              <View
                style={[
                  styles.benefitIconWrap,
                  { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.14)' : '#DCFCE7' },
                ]}
              >
                <Ionicons name="storefront" size={19} color="#10B981" />
              </View>
              <View style={{ flex: 1, marginHorizontal: 10 }}>
                <Text style={[styles.benefitTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                  {isTamil ? 'கடை நேரடி ஒருங்கிணைப்பு' : 'Direct Store-to-Door Delivery'}
                </Text>
                <Text style={[styles.benefitSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {isTamil
                    ? 'எந்த சிரமமும் இன்றி அவர்களின் வாசலில் டெலிவரி'
                    : "We'll directly hand over fresh items at their doorstep"}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={17} color="#10B981" />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.alertActionsRow}>
            {/* Primary Action Button (Solid Emerald) */}
            <TouchableOpacity
              style={[styles.liquidAlertPrimaryBtn, { backgroundColor: '#10B981' }]}
              onPress={handleConfirmSomeoneElse}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add" size={17} color="#050906" style={{ marginRight: 8 }} />
              <Text style={styles.liquidAlertPrimaryBtnText}>
                {isTamil ? 'ஆம், பெறுநர் விவரங்களைச் சேர்' : "Yes, add receiver's details"}
              </Text>
            </TouchableOpacity>

            {/* Secondary Action Button (Glass Surface) */}
            <TouchableOpacity
              style={[
                styles.liquidAlertSecondaryBtn,
                {
                  backgroundColor: isDarkMode ? '#132018' : '#F1F5F9',
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                },
                savingAddress && { opacity: 0.7 },
              ]}
              onPress={handleConfirmForMyself}
              disabled={savingAddress}
              activeOpacity={0.85}
            >
              {savingAddress ? (
                <ActivityIndicator size="small" color={isDarkMode ? '#10B981' : '#16803C'} />
              ) : (
                <>
                  <Ionicons
                    name="person-outline"
                    size={16}
                    color={isDarkMode ? '#A7F3D0' : '#15803D'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.liquidAlertSecondaryBtnText,
                      { color: isDarkMode ? '#FFFFFF' : '#0F172A' },
                    ]}
                  >
                    {isTamil ? 'இல்லை, இது எனக்கானது' : "No, it's for me!"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (!visible) return null;

  // If overlayMode is true (e.g. opened inside Checkout Modal), render as absolute fill view
  // to prevent iOS native Modal dismissal collisions!
  if (overlayMode) {
    return (
      <View
        style={[
          styles.overlayModeContainer,
          { backgroundColor: isDarkMode ? '#080E0A' : '#F8FAFC' },
        ]}
      >
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1 }}>
          {renderFlowContent()}
          {renderOrderingForSomeoneAlert()}
        </SafeAreaView>
      </View>
    );
  }

  // Otherwise render as standard Modal on root home screen
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={currentStep === 'map' ? 'fullScreen' : Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={['top', 'left', 'right', 'bottom']}
        style={[
          styles.fullScreenModalBg,
          { backgroundColor: isDarkMode ? '#080E0A' : '#F8FAFC' },
        ]}
      >
        {renderFlowContent()}
        {renderOrderingForSomeoneAlert()}
      </SafeAreaView>
    </Modal>
  );
}

// Backwards compatibility aliases
export const SelectDeliveryLocationModal = props => <DeliveryLocationFlowModal {...props} initialStep="select" />;
export const AddAddressDetailsModal = props => <DeliveryLocationFlowModal {...props} initialStep="add_details" />;
export const MapLocationPickerModal = props => <DeliveryLocationFlowModal {...props} initialStep="map" />;

const styles = StyleSheet.create({
  fullScreenModalBg: {
    flex: 1,
  },
  overlayModeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
  },
  sheetContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 8,
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitleText: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  backBtn: {
    padding: 4,
  },
  liquidSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  liquidSearchInput: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 0,
  },
  quickActionsCol: {
    gap: 10,
    marginBottom: 16,
  },
  glassActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  actionSub: {
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: '500',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitleLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  savedScrollArea: {
    flex: 1,
  },
  savedAddressCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  savedCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  savedCardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderTopWidth: 1,
  },
  activeBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#10B981',
    fontSize: 10.5,
    fontWeight: '700',
  },
  savedCardActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  cardActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardActionChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tagIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedCardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  distPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  distPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  savedCardAddress: {
    fontSize: 11.5,
    marginTop: 3,
    lineHeight: 16,
  },
  emptySavedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptySavedTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySavedSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },

  // Add Address Form Styles
  locationBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  pinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerAreaText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  bannerCityText: {
    fontSize: 11.5,
    marginTop: 2,
  },
  changePinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  changePinBtnText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 12,
  },
  formItem: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
  formInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13.5,
  },
  multilineFormInput: {
    height: 60,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  groupHeading: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 10,
  },
  countryCodeBox: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagPillsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tagChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  tagChoiceText: {
    fontSize: 12,
  },
  saveActionBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  saveActionBtnText: {
    color: '#050906',
    fontSize: 14,
    fontWeight: '800',
  },

  // Map Screen Styles
  mapTopHeader: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mapHeaderCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  mapSearchPill: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  mapSearchText: {
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  centerPinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -22,
    marginTop: -44,
    alignItems: 'center',
  },
  centerPinShadow: {
    width: 10,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginTop: -2,
  },
  floatingBottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  cardDragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94A3B850',
    alignSelf: 'center',
    marginBottom: 8,
  },
  mapPinBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  bottomCardSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  bottomCardAddress: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  confirmPinBtn: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  confirmPinBtnText: {
    color: '#050906',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelPinBtn: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPinBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Image 1, 2, 3 Layout Styles
  inputSectionHeading: {
    fontSize: 14.5,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 6,
  },
  liquidCardContainer: {
    borderRadius: 16,
    borderWidth: 1.2,
    padding: 14,
    marginBottom: 4,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  selectorIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorValueText: {
    fontSize: 14,
  },
  selectorActionText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 13,
  },
  fieldBox: {
    marginTop: 12,
  },
  cleanInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13.5,
  },
  fieldHelperText: {
    fontSize: 11,
    marginTop: 4,
    marginLeft: 2,
    lineHeight: 15,
  },
  mapLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  cleanInputInline: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 0,
  },
  pinMapMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pinMapMiniBtnText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  radioGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: 14,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  radioLabel: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  contactFieldBox: {
    marginBottom: 12,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  countryCodeText: {
    fontSize: 13.5,
    fontWeight: '700',
    marginRight: 8,
  },
  phoneInputText: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 0,
  },
  tagChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  tagChipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 11.5,
  },
  primaryNextBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 12,
  },
  primaryNextBtnText: {
    color: '#050906',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Overlay Sheets (City & Area - Liquid Glass)
  nestedSheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  sheetHandleBar: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  breadcrumbTrack: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breadcrumbChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
  },
  breadcrumbChipActive: {
    borderColor: '#10B981',
    borderWidth: 1.5,
  },
  breadcrumbText: {
    fontSize: 12,
    fontWeight: '600',
  },
  breadcrumbSeparator: {
    marginHorizontal: 2,
  },
  liquidSheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sheetHeaderIconPill: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liquidSheetMainTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  liquidSheetSubTitle: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  liquidSheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  countrySectionWrap: {
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  countryPillsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
  },
  countryPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  countryFlagEmoji: {
    fontSize: 14,
  },
  countryPillText: {
    fontSize: 12,
  },
  countryStoreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  countryStoreBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  nestedSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  nestedSearchInput: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 0,
  },
  nestedSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  storeHubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  storeHubCard: {
    width: '48.6%',
    borderRadius: 14,
    borderWidth: 1.2,
    padding: 12,
  },
  storeHubTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  storeHubIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeHubBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  storeHubBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  storeHubCityText: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  storeHubSubText: {
    fontSize: 11,
    marginTop: 2,
  },
  storeHubSelectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  storeHubSelectedText: {
    color: '#10B981',
    fontSize: 10.5,
    fontWeight: '700',
  },
  topCitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topCityCard: {
    width: '31%',
    height: 82,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  topCityCardText: {
    fontSize: 11.5,
    marginTop: 5,
    textAlign: 'center',
  },
  topCityCardStateText: {
    fontSize: 9.5,
    marginTop: 1,
    textAlign: 'center',
  },
  pickOnMapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  pickOnMapIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickOnMapTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  pickOnMapSub: {
    fontSize: 11,
    color: '#10B981',
    marginTop: 2,
  },
  cityListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  cityListItemText: {
    fontSize: 13.5,
    flex: 1,
  },
  areaIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeLocalityPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  storeLocalityPillText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  pincodeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pincodeBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // "Ordering for someone else?" Liquid Glass Alert Modal
  liquidAlertBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
    zIndex: 999999,
  },
  liquidAlertSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 38 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetGrabHandle: {
    width: 42,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(148, 163, 184, 0.35)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  liquidAlertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  closeCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liquidHeroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
    overflow: 'hidden',
  },
  glassBubbleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: -8,
    marginBottom: 12,
  },
  glassBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  glassBubbleCenter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    zIndex: 2,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  alertTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  alertTagPillText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroCardHeading: {
    fontSize: 15.5,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  heroCardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16.5,
    paddingHorizontal: 8,
  },
  benefitsCol: {
    gap: 8,
    marginBottom: 16,
  },
  glassBenefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  benefitSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 15,
  },
  alertActionsRow: {
    gap: 10,
  },
  liquidAlertPrimaryBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  liquidAlertPrimaryBtnText: {
    color: '#050906',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  liquidAlertSecondaryBtn: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liquidAlertSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
