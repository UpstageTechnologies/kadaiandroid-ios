import React, { useEffect, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
    PermissionsAndroid,
      TextInput,
} from 'react-native';

import { Dropdown } from 'react-native-element-dropdown';
import Geolocation from 'react-native-geolocation-service';
import {
  collection,
  getDocs,
  getFirestore,
} from '@react-native-firebase/firestore';

import { colors, spacing, radius, type } from '../../theme/tokens';
import { useNavigation } from '@react-navigation/native';
import AuthHeader from '../../components/layout/AuthHeader';

const validCoords = (lat, lon) => {
  const latitude = Number(lat);
  const longitude = Number(lon);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

export default function RegisterAddressScreen({ route }) {
  const db = getFirestore();
  const navigation = useNavigation();
  const { phone } = route.params || {};

  const [mode, setMode] = useState(null); // gps | manual

  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
const [stateOptions, setStateOptions] = useState([]);
const [districtOptions, setDistrictOptions] = useState([]);
const [cityOptions, setCityOptions] = useState([]);

const [statesLoading, setStatesLoading] = useState(false);
const [districtsLoading, setDistrictsLoading] = useState(false);
const [citiesLoading, setCitiesLoading] = useState(false);

  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [countryOptions, setCountryOptions] = useState([]);
const [countryId, setCountryId] = useState('');
 const requestIds = useRef({
  states: 0,
  districts: 0,
  cities: 0,
});

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        navigation.goBack();
        return true;
      },
    );

    return () => backHandler.remove();
  }, [navigation]);
 const loadCountries = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'location_master'));

    const countries = snapshot.docs
      .map(doc => {
        const data = doc.data() || {};

        return {
          id: doc.id,
          value: doc.id,
          label: String(data.name || doc.id).trim(),
          code: String(data.code || '').trim(),
          isActive: data.isActive !== false,
        };
      })
      .filter(item => item.isActive && item.label)
      .sort((a, b) => a.label.localeCompare(b.label));

    setCountryOptions(countries);

    console.log(
      '[REGISTER LOCATION] COUNTRIES:',
      countries,
    );
  } catch (error) {
    console.error(
      '[REGISTER LOCATION] COUNTRIES ERROR:',
      error,
    );

    setCountryOptions([]);

    Alert.alert(
      'Location Error',
      'Unable to load countries. Please try again.',
    );
  }
};
const loadStates = async selectedCountryId => {
  const requestId = ++requestIds.current.states;

  if (!selectedCountryId) {
    setStateOptions([]);
    return;
  }

  try {
    setStatesLoading(true);

    const snapshot = await getDocs(
      collection(db, 'location_master', selectedCountryId, 'states'),
    );

    if (requestId !== requestIds.current.states) return;

    const options = snapshot.docs
      .map(doc => {
        const data = doc.data() || {};

        const value = String(
          data.name ||
            data.state ||
            doc.id,
        ).trim();

        return value
          ? {
              label: value,
              value,
              id: doc.id,
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) =>
        a.label.localeCompare(b.label),
      );

    console.log(
      '[REGISTER LOCATION] STATES:',
      selectedCountryId,
      options,
    );

    setStateOptions(options);
  } catch (error) {
    console.error(
      '[REGISTER LOCATION] STATES ERROR:',
      error,
    );

    setStateOptions([]);

    Alert.alert(
      'Location Error',
      'Unable to load states. Please try again.',
    );
  } finally {
    if (requestId === requestIds.current.states) {
      setStatesLoading(false);
    }
  }
};
 const loadDistricts = async (
  selectedCountryId,
  selectedState,
) => {
  const requestId = ++requestIds.current.districts;

  if (!selectedCountryId || !selectedState) {
    setDistrictOptions([]);
    return;
  }

  try {
    setDistrictsLoading(true);

    const stateId = stateOptions.find(
      item => item.value === selectedState,
    )?.id;

    if (!stateId) {
      setDistrictOptions([]);
      return;
    }

    const snapshot = await getDocs(
      collection(
        db,
        'location_master',
        selectedCountryId,
        'states',
        stateId,
        'districts',
      ),
    );

    if (requestId !== requestIds.current.districts) return;

    const options = snapshot.docs
      .map(doc => {
        const data = doc.data() || {};

        const value = String(
          data.name ||
            data.district ||
            doc.id,
        ).trim();

        return value
          ? {
              label: value,
              value,
              id: doc.id,
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) =>
        a.label.localeCompare(b.label),
      );

    console.log(
      '[REGISTER LOCATION] DISTRICTS:',
      options,
    );

    setDistrictOptions(options);
  } catch (error) {
    console.error(
      '[REGISTER LOCATION] DISTRICTS ERROR:',
      error,
    );

    setDistrictOptions([]);

    Alert.alert(
      'Location Error',
      'Unable to load districts. Please try again.',
    );
  } finally {
    if (requestId === requestIds.current.districts) {
      setDistrictsLoading(false);
    }
  }
};
 const loadCities = async (
  selectedCountryId,
  selectedState,
  selectedDistrict,
) => {
  const requestId = ++requestIds.current.cities;

  if (
    !selectedCountryId ||
    !selectedState ||
    !selectedDistrict
  ) {
    setCityOptions([]);
    return;
  }

  try {
    setCitiesLoading(true);

    const stateId = stateOptions.find(
      item => item.value === selectedState,
    )?.id;

    const districtId = districtOptions.find(
      item => item.value === selectedDistrict,
    )?.id;

    if (!stateId || !districtId) {
      setCityOptions([]);
      return;
    }

    const snapshot = await getDocs(
      collection(
        db,
        'location_master',
        selectedCountryId,
        'states',
        stateId,
        'districts',
        districtId,
        'cities',
      ),
    );

    if (requestId !== requestIds.current.cities) return;

    const options = snapshot.docs
      .map(doc => {
        const data = doc.data() || {};

        const value = String(
          data.name ||
            data.city ||
            doc.id,
        ).trim();

        return value
          ? {
              label: value,
              value,
              id: doc.id,
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) =>
        a.label.localeCompare(b.label),
      );

    console.log(
      '[REGISTER LOCATION] CITIES:',
      options,
    );

    setCityOptions(options);
  } catch (error) {
    console.error(
      '[REGISTER LOCATION] CITIES ERROR:',
      error,
    );

    setCityOptions([]);

    Alert.alert(
      'Location Error',
      'Unable to load cities. Please try again.',
    );
  } finally {
    if (requestId === requestIds.current.cities) {
      setCitiesLoading(false);
    }
  }
};

const resetManualLocation = () => {
  setState('');
  setDistrict('');
  setCity('');
  setArea('');
  setDistrictOptions([]);
  setCityOptions([]);
};
const chooseManual = () => {
  setMode('manual');
  setLat(null);
  setLon(null);

  setCountryId('');
  setState('');
  setDistrict('');
  setCity('');
  setArea('');

  setStateOptions([]);
  setDistrictOptions([]);
  setCityOptions([]);
  

  loadCountries();
};

  const requestLocationPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const alreadyGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );

        if (alreadyGranted) return true;

        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message:
              'KadaiApp uses your current location to show nearby shops and local products.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );

        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          return true;
        }

        if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          Alert.alert(
            'Location Permission',
            'Location permission is blocked. Please enable it from Settings.',
          );
          return false;
        }

        Alert.alert(
          'Location Permission',
          'Please allow location permission to use your current location.',
        );
        return false;
      }

      const authorization =
        await Geolocation.requestAuthorization('whenInUse');

      if (authorization === 'granted') return true;

      Alert.alert(
        'Location Permission',
        'Please allow location permission to use your current location.',
      );
      return false;
    } catch (error) {
      console.error('[REGISTER LOCATION] PERMISSION ERROR:', error);
      Alert.alert(
        'Location Error',
        'Unable to request location permission.',
      );
      return false;
    }
  };

  const chooseCurrentLocation = async () => {
    if (locationLoading) return;

    setMode('gps');

    const allowed = await requestLocationPermission();
    if (!allowed) {
      setMode(null);
      return;
    }

    setLocationLoading(true);

    Geolocation.getCurrentPosition(
      position => {
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);

        setLocationLoading(false);

        if (!validCoords(latitude, longitude)) {
          setMode(null);
          Alert.alert(
            'Location Error',
            'Unable to read valid GPS coordinates. Please try again.',
          );
          return;
        }

        setLat(latitude);
        setLon(longitude);
      },
      error => {
        setLocationLoading(false);
        setMode(null);

        console.error('[REGISTER LOCATION] GPS ERROR:', error);

        let message =
          'Unable to detect your current location. Please try again.';

        if (error?.code === 1) {
          message =
            'Location permission was denied. Please allow location permission.';
        } else if (error?.code === 2) {
          message =
            'Location is currently unavailable. Please check GPS and try again.';
        } else if (error?.code === 3) {
          message =
            'Location request timed out. Please try again.';
        }

        Alert.alert('Current Location', message);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      },
    );
  };

  const handleNext = () => {
    if (!mode) {
      Alert.alert(
        'Choose a location',
        'Select Use Current Location or Add New Address to continue.',
      );
      return;
    }

    if (mode === 'gps') {
      if (!validCoords(lat, lon)) {
        Alert.alert(
          'Location Required',
          'Please use Current Location and wait until the location is detected.',
        );
        return;
      }

    navigation.navigate('RegisterDetails', {
  phone,
  country: countryId,
  state,
  district,
  city,
  area,
  address: '',
  pincode: '',
  lat: null,
  lon: null,
  locationSource: 'manual',
});
      return;
    }

 if (!state || !district || !city || !area.trim()) {
  Alert.alert(
    'Location Required',
    'Please select State, District, City and enter your Area.',
  );
  return;
}

    navigation.navigate('RegisterDetails', {
      phone,
     country: countryId,
      state,
      district,
      city,
      area,
      address: '',
      pincode: '',
      lat: null,
      lon: null,
      locationSource: 'manual',
    });
  };

  const renderDropdown = ({
    data,
    value,
    placeholder,
    onChange,
    loading,
    disabled,
  }) => (
    <Dropdown
      style={[styles.dropdown, disabled && styles.disabled]}
      containerStyle={styles.dropdownContainer}
      data={data}
      labelField="label"
      valueField="value"
      value={value}
      placeholder={loading ? 'Loading...' : placeholder}
      disable={disabled || loading}
      onChange={onChange}
      search
      searchPlaceholder="Search..."
      maxHeight={320}
      placeholderStyle={styles.placeholder}
      selectedTextStyle={styles.selected}
      inputSearchStyle={styles.searchInput}
      itemTextStyle={styles.itemText}
      activeColor="#f1f5f9"
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.canvas}
      />

      <AuthHeader
        onBack={() => navigation.goBack()}
        showSkip={false}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Text style={styles.heroIconText}>⌖</Text>
            </View>

            <Text style={styles.title}>Choose your location</Text>

            <Text style={styles.subtitle}>
              We use this location to show the right local products and shops.
              You can change it anytime later.
            </Text>
          </View>

          <View style={styles.choiceCard}>
            <Text style={styles.sectionEyebrow}>LOCATION METHOD</Text>

            <TouchableOpacity
              style={[
                styles.choice,
                mode === 'gps' && styles.choiceActive,
              ]}
              onPress={chooseCurrentLocation}
              activeOpacity={0.88}
              disabled={locationLoading}
            >
              <View style={[styles.choiceIcon, styles.gpsIcon]}>
                {locationLoading ? (
                  <ActivityIndicator color={colors.brand} />
                ) : (
                  <Text style={styles.choiceEmoji}>⌖</Text>
                )}
              </View>

              <View style={styles.choiceBody}>
                <Text style={styles.choiceTitle}>
                  {locationLoading
                    ? 'Detecting current location...'
                    : 'Use Current Location'}
                </Text>

                <Text style={styles.choiceText}>
                  Automatically use your phone's GPS location.
                </Text>

                {mode === 'gps' && validCoords(lat, lon) ? (
                  <Text style={styles.successText}>
                    ✓ Location detected
                  </Text>
                ) : null}
              </View>

              <View
                style={[
                  styles.radio,
                  mode === 'gps' && styles.radioActive,
                ]}
              >
                {mode === 'gps' ? <View style={styles.radioDot} /> : null}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.choice,
                mode === 'manual' && styles.choiceActive,
              ]}
              onPress={chooseManual}
              activeOpacity={0.88}
            >
              <View style={[styles.choiceIcon, styles.manualIcon]}>
                <Text style={styles.choiceEmoji}>⌂</Text>
              </View>

              <View style={styles.choiceBody}>
                <Text style={styles.choiceTitle}>Add New Address</Text>
                <Text style={styles.choiceText}>
                  Select State, District, City and Area manually.
                </Text>
              </View>

              <View
                style={[
                  styles.radio,
                  mode === 'manual' && styles.radioActive,
                ]}
              >
                {mode === 'manual' ? (
                  <View style={styles.radioDot} />
                ) : null}
              </View>
            </TouchableOpacity>
          </View>

          {mode === 'gps' && validCoords(lat, lon) ? (
            <View style={styles.detectedCard}>
              <Text style={styles.detectedTitle}>Current location ready</Text>
              <Text style={styles.detectedText}>
                {Number(lat).toFixed(6)}, {Number(lon).toFixed(6)}
              </Text>
              <Text style={styles.detectedHint}>
                This GPS position will be used for nearby shop matching.
              </Text>
            </View>
          ) : null}

          {mode === 'manual' ? (
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <View>
                  <Text style={styles.formTitle}>Add your location</Text>
                  <Text style={styles.formSubtitle}>
                    Select the place where you want to browse local products.
                  </Text>
                </View>
              </View>

            <Text style={styles.label}>COUNTRY</Text>

{renderDropdown({
  data: countryOptions,
  value: countryId,
  placeholder: 'Select Country',
  loading: countryOptions.length === 0,
  disabled: false,

  onChange: item => {
    const selectedId = item.value;

    setCountryId(selectedId);

    setState('');
    setDistrict('');
    setCity('');
    setArea('');

    setStateOptions([]);
    setDistrictOptions([]);
    setCityOptions([]);
   

    loadStates(selectedId);
  },
})}

              <Text style={styles.label}>STATE</Text>
              {renderDropdown({
                data: stateOptions,
                value: state,
                placeholder: 'Select State',
                loading: statesLoading,
                disabled: false,
              onChange: item => {
  const value = item.value;

  setState(value);
  setDistrict('');
  setCity('');
  setArea('');
  setDistrictOptions([]);
setCityOptions([]);

loadDistricts(countryId, value);
},
              })}

              <Text style={styles.label}>DISTRICT</Text>
              {renderDropdown({
                data: districtOptions,
                value: district,
                placeholder: state
                  ? 'Select District'
                  : 'Select State first',
                loading: districtsLoading,
                disabled: !state,
               onChange: item => {
  const value = item.value;

  setDistrict(value);
  setCity('');
  setArea('');

  setCityOptions([]);
 

  loadCities(countryId, state, value);
},
              })}

              <Text style={styles.label}>CITY</Text>
              {renderDropdown({
                data: cityOptions,
                value: city,
                placeholder: district
                  ? 'Select City'
                  : 'Select District first',
                loading: citiesLoading,
                disabled: !district,
            onChange: item => {
  const value = item.value;

  setCity(value);
  setArea('');
},
              })}

         <Text style={styles.label}>AREA / LOCALITY</Text>

<TextInput
  style={[
    styles.dropdown,
    !city && styles.disabled,
  ]}
  value={area}
  onChangeText={setArea}
  placeholder={
    city
      ? 'Enter your area / locality'
      : 'Select City first'
  }
  placeholderTextColor="#94a3b8"
  editable={!!city}
/>
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>i</Text>
                <Text style={styles.infoText}>
                  No door number, full delivery address or pincode is needed
                  here. This is only your shopping location.
                </Text>
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.nextButton,
              (!mode ||
                (mode === 'gps' && !validCoords(lat, lon)) ||
               (mode === 'manual' &&
  (!state || !district || !city || !area.trim()))) &&
                styles.nextDisabled,
            ]}
            onPress={handleNext}
            activeOpacity={0.9}
          >
            <Text style={styles.nextText}>Next</Text>
            <Text style={styles.nextArrow}>→</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 42,
  },
  hero: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroIconText: {
    fontSize: 28,
    color: colors.brand,
  },
  title: {
    ...type.heading,
    color: '#0f172a',
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 8,
    color: '#64748b',
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 430,
  },
  choiceCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#94a3b8',
    marginHorizontal: 4,
    marginBottom: 8,
  },
  choice: {
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  choiceActive: {
    borderColor: colors.brand,
    backgroundColor: '#fffaf0',
  },
  choiceIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  gpsIcon: {
    backgroundColor: '#fff4d6',
  },
  manualIcon: {
    backgroundColor: '#eef2ff',
  },
  choiceEmoji: {
    fontSize: 24,
    color: '#334155',
  },
  choiceBody: {
    flex: 1,
    paddingRight: 8,
  },
  choiceTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  choiceText: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
  },
  successText: {
    marginTop: 5,
    color: '#15803d',
    fontSize: 11,
    fontWeight: '800',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.brand,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  detectedCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  detectedTitle: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '900',
  },
  detectedText: {
    marginTop: 5,
    color: '#15803d',
    fontSize: 12,
    fontWeight: '700',
  },
  detectedHint: {
    marginTop: 5,
    color: '#4d7c5b',
    fontSize: 11,
    lineHeight: 16,
  },
  formCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formHeader: {
    marginBottom: 4,
  },
  formTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  formSubtitle: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
  },
  label: {
    marginTop: 18,
    marginBottom: 7,
    color: '#475569',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  fixedField: {
    height: 52,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fixedFieldText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  fixedBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
  },
  dropdown: {
    height: 52,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
  },
  disabled: {
    opacity: 0.5,
    backgroundColor: '#f8fafc',
  },
  dropdownContainer: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  placeholder: {
    color: '#94a3b8',
    fontSize: 14,
  },
  selected: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  searchInput: {
    height: 44,
    borderRadius: 10,
    color: '#0f172a',
  },
  itemText: {
    color: '#0f172a',
    fontSize: 14,
  },
  infoRow: {
    marginTop: 18,
    padding: 12,
    borderRadius: 13,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e2e8f0',
    textAlign: 'center',
    lineHeight: 18,
    color: '#64748b',
    fontSize: 11,
    fontWeight: '900',
    marginRight: 8,
  },
  infoText: {
    flex: 1,
    color: '#64748b',
    fontSize: 11,
    lineHeight: 17,
  },
  nextButton: {
    marginTop: 18,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  nextDisabled: {
    opacity: 0.45,
  },
  nextText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  nextArrow: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
});
