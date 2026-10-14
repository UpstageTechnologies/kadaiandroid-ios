import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';

import MapView, { Marker } from 'react-native-maps';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  writeBatch,
} from '@react-native-firebase/firestore';
import Geolocation from 'react-native-geolocation-service';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { AuthContext } from '../../context/AuthContext';
import AppHeader from '../../components/layout/AppHeader';
import { colors } from '../../theme/tokens';
import { saveActiveLocation } from '../../services/locationService';


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
const locationLabel = address => {
  if (!address) return 'Location not set';

  const parts = [
    address.area,
    address.landmark,
    address.city,
    address.district,
    address.state,
    address.country,
    address.pincode,
  ]
    .filter(Boolean)
    .map(part => String(part).trim())
    .filter(Boolean);

  const uniqueParts = [];
  const seen = new Set();

  parts.forEach(part => {
    const key = part.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueParts.push(part);
    }
  });

  if (uniqueParts.length) {
    return uniqueParts.slice(0, 4).join(', ');
  }

  const formatted = String(address.fullAddress || '').trim();
  if (formatted) {
    return formatted
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .slice(0, 4)
      .join(', ');
  }

  return 'Location not set';
};

const normalizeReverseGeocodeValue = value => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const buildReverseGeocodeAddress = result => {
  const address = result?.address || {};

  const country = normalizeReverseGeocodeValue(
    address.country || address.country_name || '',
  );
  const state = normalizeReverseGeocodeValue(
    address.state || address.region || address.province || '',
  );
  const district = normalizeReverseGeocodeValue(
    address.county || address.district || address.state_district || '',
  );
  const city = normalizeReverseGeocodeValue(
    address.city || address.town || address.village || address.municipality || '',
  );
  const area = normalizeReverseGeocodeValue(
    address.neighbourhood ||
      address.suburb ||
      address.quarter ||
      address.city_district ||
      address.locality ||
      address.road ||
      address.residential ||
      '',
  );
  const pincode = normalizeReverseGeocodeValue(address.postcode || '');
  const fullAddress = normalizeReverseGeocodeValue(result?.display_name || '');

  const structuredParts = [area, city, district, state, country, pincode].filter(Boolean);

  return {
    country,
    state,
    district,
    city,
    area,
    pincode,
    fullAddress: fullAddress || structuredParts.join(', '),
  };
};

const reverseGeocodeLocation = async (lat, lon) => {
  if (!validCoords(lat, lon)) {
    return null;
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
    Number(lat),
  )}&lon=${encodeURIComponent(Number(lon))}&addressdetails=1&zoom=18`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'KadaiApp/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Reverse geocoding failed with status ${response.status}.`,
    );
  }

  const payload = await response.json();

  if (!payload || payload.error) {
    throw new Error(
      payload?.error || 'Unable to resolve the address for this location.',
    );
  }

  return buildReverseGeocodeAddress(payload);
};

const sourceLabel = address =>
  address?.locationSource === 'gps' ||
  validCoords(address?.lat, address?.lon)
    ? 'Current location'
    : 'Added manually';

export default function LocationPickerScreen({ navigation }) {
  const db = getFirestore();
  const { user, customerData } = useContext(AuthContext);

  const mapRef = useRef(null);

  const registrationAddress = customerData?.address || null;

  const [savedLocations, setSavedLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);

  const [mode, setMode] = useState(null); // gps | manual

  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);

  const [countryId, setCountryId] = useState('');
  const [countryOptions, setCountryOptions] = useState([]);
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');

  const [stateOptions, setStateOptions] = useState([]);
  const [districtOptions, setDistrictOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);

  const [statesLoading, setStatesLoading] = useState(false);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);

  const requestIds = useRef({
    states: 0,
    districts: 0,
    cities: 0,
  });

  const activeAddress = useMemo(() => {
    const activeSaved = savedLocations.find(
      item => item.isActive === true,
    );

    return activeSaved || registrationAddress;
  }, [savedLocations, registrationAddress]);

  const activeIsRegistration =
    !savedLocations.some(item => item.isActive === true);

  const loadCountries = async () => {
    try {
      let countries = [];
      try {
        const snapshot = await getDocs(collection(db, 'location_master'));
        countries = snapshot.docs
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
      } catch (e) {
        console.log('[LOCATION PICKER] location_master read note:', e?.message);
      }

      // If location_master is empty, provide default country
      if (countries.length === 0) {
        countries = [
          { id: 'IN', value: 'IN', label: 'India', code: 'IN', isActive: true },
        ];
      }

      setCountryOptions(countries);
    } catch (error) {
      console.error('[LOCATION PICKER] COUNTRIES ERROR:', error);
      setCountryOptions([
        { id: 'IN', value: 'IN', label: 'India', code: 'IN', isActive: true },
      ]);
    }
  };

  const resetForm = () => {
    setMode(null);
    setLat(null);
    setLon(null);
    setGpsResolvedAddress(null);
    setGeoResolveError('');

    setCountryId('');
    setState('');
    setDistrict('');
    setCity('');
    setArea('');
    setLandmark('');

    setCountryOptions([]);
    setStateOptions([]);
    setDistrictOptions([]);
    setCityOptions([]);
  };

  const openAddLocation = () => {
  resetForm();
  setShowAddLocation(true);
  loadCountries();
};

  const closeAddLocation = () => {
    resetForm();
    setShowAddLocation(false);
  };

  useEffect(() => {
    if (!user?.uid) return undefined;

    const unsubscribe = onSnapshot(
      collection(db, 'customers', user.uid, 'saved_addresses'),
        snapshot => {
          setSavedLocations(
            snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            })),
          );
        },
        error => {
          console.error('[LOCATION PICKER] SAVED LOCATION ERROR:', error);
        },
      );

    return unsubscribe;
  }, [user?.uid]);

  const loadStates = async selectedCountryId => {
    const requestId = ++requestIds.current.states;

    if (!selectedCountryId) {
      setStateOptions([]);
      return;
    }

    try {
      setStatesLoading(true);

      let options = [];
      // 1. Try root `states` collection first
      try {
        const rootSnap = await getDocs(collection(db, 'states'));
        if (!rootSnap.empty) {
          options = rootSnap.docs
            .map(doc => {
              const data = doc.data() || {};
              const value = String(data.name || data.state || doc.id).trim();
              return value
                ? { label: value, value, id: doc.id, source: 'root' }
                : null;
            })
            .filter(Boolean);
        }
      } catch (e) {
        console.log('[LOCATION PICKER] Root states read note:', e?.message);
      }

      // 2. Fallback to location_master/{selectedCountryId}/states
      if (options.length === 0) {
        const snapshot = await getDocs(
          collection(db, 'location_master', selectedCountryId, 'states'),
        );
        options = snapshot.docs
          .map(doc => {
            const data = doc.data() || {};
            const value = String(data.name || data.state || doc.id).trim();
            return value
              ? { label: value, value, id: doc.id, source: 'location_master' }
              : null;
          })
          .filter(Boolean);
      }

      if (requestId !== requestIds.current.states) return;

      options.sort((a, b) => a.label.localeCompare(b.label));
      setStateOptions(options);

      console.log('[LOCATION PICKER] STATES:', selectedCountryId, options);
    } catch (error) {
      console.error('[LOCATION PICKER] STATES ERROR:', error);
      setStateOptions([]);
      Alert.alert('Location Error', 'Unable to load states. Please try again.');
    } finally {
      if (requestId === requestIds.current.states) {
        setStatesLoading(false);
      }
    }
  };

  const loadDistricts = async (selectedCountryId, selectedState) => {
    const requestId = ++requestIds.current.districts;

    if (!selectedCountryId || !selectedState) {
      setDistrictOptions([]);
      return;
    }

    try {
      setDistrictsLoading(true);

      const stateObj = stateOptions.find(item => item.value === selectedState);
      const stateId = stateObj?.id;

      if (!stateId) {
        setDistrictOptions([]);
        return;
      }

      let options = [];

      // 1. Try root collection states/{stateId}/districts
      try {
        const rootSnap = await getDocs(
          collection(db, 'states', stateId, 'districts'),
        );
        if (!rootSnap.empty) {
          options = rootSnap.docs
            .map(doc => {
              const data = doc.data() || {};
              const value = String(data.name || data.district || doc.id).trim();
              return value
                ? { label: value, value, id: doc.id, source: 'root' }
                : null;
            })
            .filter(Boolean);
        }
      } catch (e) {
        console.log('[LOCATION PICKER] Root districts read note:', e?.message);
      }

      // 2. Fallback to location_master/{selectedCountryId}/states/{stateId}/districts
      if (options.length === 0) {
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
        options = snapshot.docs
          .map(doc => {
            const data = doc.data() || {};
            const value = String(data.name || data.district || doc.id).trim();
            return value
              ? { label: value, value, id: doc.id, source: 'location_master' }
              : null;
          })
          .filter(Boolean);
      }

      if (requestId !== requestIds.current.districts) return;

      options.sort((a, b) => a.label.localeCompare(b.label));
      setDistrictOptions(options);
    } catch (error) {
      console.error('[LOCATION PICKER] DISTRICTS ERROR:', error);
      setDistrictOptions([]);
      Alert.alert('Location Error', 'Unable to load districts. Please try again.');
    } finally {
      if (requestId === requestIds.current.districts) {
        setDistrictsLoading(false);
      }
    }
  };

  const loadCities = async (selectedCountryId, selectedState, selectedDistrict) => {
    const requestId = ++requestIds.current.cities;

    if (!selectedCountryId || !selectedState || !selectedDistrict) {
      setCityOptions([]);
      return;
    }

    try {
      setCitiesLoading(true);

      const stateObj = stateOptions.find(item => item.value === selectedState);
      const districtObj = districtOptions.find(item => item.value === selectedDistrict);

      const stateId = stateObj?.id;
      const districtId = districtObj?.id;

      if (!stateId || !districtId) {
        setCityOptions([]);
        return;
      }

      let options = [];

      // 1. Try root collection states/{stateId}/districts/{districtId}/cities
      try {
        const rootSnap = await getDocs(
          collection(db, 'states', stateId, 'districts', districtId, 'cities'),
        );
        if (!rootSnap.empty) {
          options = rootSnap.docs
            .map(doc => {
              const data = doc.data() || {};
              const value = String(data.name || data.city || doc.id).trim();
              return value
                ? { label: value, value, id: doc.id, source: 'root' }
                : null;
            })
            .filter(Boolean);
        }
      } catch (e) {
        console.log('[LOCATION PICKER] Root cities read note:', e?.message);
      }

      // 2. Fallback to location_master/{selectedCountryId}/states/{stateId}/districts/{districtId}/cities
      if (options.length === 0) {
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
        options = snapshot.docs
          .map(doc => {
            const data = doc.data() || {};
            const value = String(data.name || data.city || doc.id).trim();
            return value
              ? { label: value, value, id: doc.id, source: 'location_master' }
              : null;
          })
          .filter(Boolean);
      }

      if (requestId !== requestIds.current.cities) return;

      options.sort((a, b) => a.label.localeCompare(b.label));
      setCityOptions(options);
    } catch (error) {
      console.error('[LOCATION PICKER] CITIES ERROR:', error);
      setCityOptions([]);
      Alert.alert('Location Error', 'Unable to load cities. Please try again.');
    } finally {
      if (requestId === requestIds.current.cities) {
        setCitiesLoading(false);
      }
    }
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
        } else {
          Alert.alert(
            'Location Permission',
            'Please allow location permission to use your current location.',
          );
        }

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
      console.error('[LOCATION PICKER] PERMISSION ERROR:', error);
      Alert.alert(
        'Location Error',
        'Unable to request location permission.',
      );
      return false;
    }
  };const useCurrentLocation = async () => {
  if (locationLoading) return;

  setMode('gps');
  setGpsResolvedAddress(null);
  setGeoResolveError('');

  const allowed = await requestLocationPermission();
  if (!allowed) {
    setMode(null);
    return;
  }

  setLocationLoading(true);

  Geolocation.getCurrentPosition(
    async position => {
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

      const resolved = await resolveGpsAddress(latitude, longitude);

      if (!resolved) {
        setMode('gps');
      }
    },
    error => {
      setLocationLoading(false);
      setMode(null);
      setGpsResolvedAddress(null);

      console.error('[LOCATION PICKER] GPS ERROR:', error);

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

  const chooseManual = () => {
    setMode('manual');

    setLat(null);
    setLon(null);

    setCountryId('');
    setState('');
    setDistrict('');
    setCity('');
    setArea('');
    setLandmark('');

    setStateOptions([]);
    setDistrictOptions([]);
    setCityOptions([]);

    loadCountries();
  };
const [geoResolveLoading, setGeoResolveLoading] = useState(false);
const [geoResolveError, setGeoResolveError] = useState('');
const [gpsResolvedAddress, setGpsResolvedAddress] = useState(null);

const resolveGpsAddress = async (latitude, longitude) => {
  if (!validCoords(latitude, longitude)) {
    return null;
  }

  setGeoResolveLoading(true);
  setGeoResolveError('');

  try {
    const resolved = await reverseGeocodeLocation(latitude, longitude);

    if (!resolved) {
      setGeoResolveError('Unable to resolve your current address. Please try again.');
      setGpsResolvedAddress(null);
      return null;
    }

    setGpsResolvedAddress(resolved);
    return resolved;
  } catch (error) {
    console.error('[LOCATION PICKER] REVERSE GEOCODE ERROR:', error);
    setGpsResolvedAddress(null);
    setGeoResolveError(
      error?.message || 'Unable to resolve your current address. Please try again.',
    );
    return null;
  } finally {
    setGeoResolveLoading(false);
  }
};
const saveNewLocation = async () => {
    if (!user?.uid) {
      Alert.alert('Login Required', 'Please login again.');
      return;
    }

    if (!mode) {
      Alert.alert(
        'Choose a location',
        'Select Current Location or Add New Address.',
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
    }

    if (mode === 'manual') {
      if (
        !countryId ||
        !state ||
        !district ||
        !city ||
        !area.trim()
      ) {
        Alert.alert(
          'Location Required',
          'Please select Country, State, District, City and enter Area / Locality.',
        );
        return;
      }
    }

    let resolvedAddress = gpsResolvedAddress;

    if (mode === 'gps' && !resolvedAddress) {
      resolvedAddress = await resolveGpsAddress(lat, lon);
    }

    if (mode === 'gps' && !resolvedAddress) {
      Alert.alert(
        'Location Resolution Failed',
        geoResolveError || 'Unable to resolve your current location. Please try again.',
        [
          {
            text: 'Retry',
            onPress: () => saveNewLocation(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
      );
      return;
    }

    const manualFullAddress = mode === 'manual'
      ? [area.trim(), landmark.trim(), city.trim(), district.trim(), state.trim()].filter(Boolean).join(', ')
      : (resolvedAddress?.fullAddress || '');

    const selectedCountryObj = countryOptions.find(c => c.value === countryId);
    const countryLabel = mode === 'manual' ? (selectedCountryObj?.label || countryId || 'India') : (resolvedAddress?.country || 'India');

    const payload = {
      type: 'Location',
      country: countryLabel,
      countryId: mode === 'manual' ? countryId : '',
      state: mode === 'manual' ? state.trim() : (resolvedAddress?.state || ''),
      district: mode === 'manual' ? district.trim() : (resolvedAddress?.district || ''),
      city: mode === 'manual' ? city.trim() : (resolvedAddress?.city || ''),
      area: mode === 'manual' ? area.trim() : (resolvedAddress?.area || ''),
      landmark: mode === 'manual' ? landmark.trim() : '',
      street: mode === 'manual' ? area.trim() : (resolvedAddress?.area || ''),
      fullAddress: manualFullAddress,
      formattedAddress: manualFullAddress,
      pincode: mode === 'manual' ? '' : (resolvedAddress?.pincode || ''),
      lat: mode === 'gps' && validCoords(lat, lon) ? Number(lat) : null,
      lon: mode === 'gps' && validCoords(lat, lon) ? Number(lon) : null,
      latitude: mode === 'gps' && validCoords(lat, lon) ? Number(lat) : null,
      longitude: mode === 'gps' && validCoords(lat, lon) ? Number(lon) : null,
      hasPin: Boolean(mode === 'gps' && validCoords(lat, lon)),
      googleMapsLink: mode === 'gps' && validCoords(lat, lon) ? `https://www.google.com/maps?q=${lat},${lon}` : '',
      locationSource: mode,
      isActive: true,
      timestamp: new Date().toISOString(),
    };

    if (mode === 'gps' && !payload.fullAddress) {
      Alert.alert(
        'Location Resolution Failed',
        'Current location was detected, but a readable address could not be resolved. Please try again.',
        [
          {
            text: 'Retry',
            onPress: () => saveNewLocation(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
      );
      return;
    }

    try {
      setLoading(true);

      const customerRef = doc(db, 'customers', user.uid);
      const savedRef = doc(
        collection(db, 'customers', user.uid, 'saved_addresses'),
      );
      const batch = writeBatch(db);

      savedLocations.forEach(item => {
        batch.update(
          doc(db, 'customers', user.uid, 'saved_addresses', item.id),
          {
            isActive: false,
          },
        );
      });

      batch.set(savedRef, payload);
      batch.set(
        customerRef,
        {
          address: payload,
        },
        { merge: true },
      );

      await batch.commit();
      await saveActiveLocation(user.uid, payload);

      closeAddLocation();

      Alert.alert(
        'Location Added ✓',
        'Your new shopping location is now active.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (error) {
      console.error(
        '[LOCATION PICKER] SAVE ERROR:',
        error,
      );

      Alert.alert(
        'Save Failed',
        error?.message || 'Unable to save this location.',
      );
    } finally {
      setLoading(false);
    }
  };
  const activateLocation = async address => {
    if (!user?.uid || !address) return;

    const hasCoordinates = validCoords(address.lat, address.lon);
    const source =
      address.locationSource ||
      (hasCoordinates ? 'gps' : 'manual');

    try {
      setLoading(true);

      const customerRef = doc(db, 'customers', user.uid);

      const batch = writeBatch(db);

      savedLocations.forEach(item => {
        batch.update(
          doc(db, 'customers', user.uid, 'saved_addresses', item.id),
          {
            isActive: item.id === address.id,
          },
        );
      });

      const updatedPayload = {
        country: address.country || '',
        countryId: address.countryId || '',
        state: address.state || '',
        district: address.district || '',
        city: address.city || '',
        area: address.area || '',
        landmark: address.landmark || '',
        street: address.street || address.area || '',
        fullAddress: address.fullAddress || '',
        formattedAddress: address.formattedAddress || address.fullAddress || '',
        pincode: address.pincode || '',
        lat: hasCoordinates ? Number(address.lat) : null,
        lon: hasCoordinates ? Number(address.lon) : null,
        locationSource: source,
        type: address.type || 'Location',
        isActive: true,
      };

      batch.set(
        customerRef,
        {
          address: updatedPayload,
        },
        { merge: true },
      );

      await batch.commit();
      await saveActiveLocation(user.uid, updatedPayload);

      if (hasCoordinates) {
        const target = {
          latitude: Number(address.lat),
          longitude: Number(address.lon),
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };

        mapRef.current?.animateToRegion(target, 700);
      }
    } catch (error) {
      console.error('[LOCATION PICKER] ACTIVATE ERROR:', error);
      Alert.alert(
        'Location Error',
        error?.message || 'Unable to change location.',
      );
    } finally {
      setLoading(false);
    }
  };

  const activateRegistrationLocation = async () => {
    if (!registrationAddress || !user?.uid) return;

    try {
      setLoading(true);

      const customerRef = doc(db, 'customers', user.uid);

      const batch = writeBatch(db);

      savedLocations.forEach(item => {
        batch.update(
          doc(db, 'customers', user.uid, 'saved_addresses', item.id),
          { isActive: false },
        );
      });

      batch.set(
        customerRef,
        {
          address: {
            ...registrationAddress,
            isActive: true,
          },
        },
        { merge: true },
      );

      await batch.commit();
      await saveActiveLocation(user.uid, registrationAddress);
    } catch (error) {
      console.error('[LOCATION PICKER] ACTIVATE REGISTRATION ERROR:', error);
      Alert.alert(
        'Location Error',
        error?.message || 'Unable to activate registration location.',
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteLocation = id => {
    if (!user?.uid || !id) return;

    const target = savedLocations.find(item => item.id === id);

    if (!target) return;

    if (target.isActive === true) {
      Alert.alert(
        'Active Location',
        'Select another location before deleting this active location.',
      );
      return;
    }

    Alert.alert(
      'Delete Location',
      'Remove this saved location from your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(
                doc(db, 'customers', user.uid, 'saved_addresses', id),
              );
            } catch (error) {
              console.error('[LOCATION PICKER] DELETE ERROR:', error);
              Alert.alert(
                'Delete Failed',
                error?.message || 'Unable to delete this location.',
              );
            }
          },
        },
      ],
    );
  };

  const mapLocation = activeAddress && validCoords(
    activeAddress.lat,
    activeAddress.lon,
  )
    ? {
        latitude: Number(activeAddress.lat),
        longitude: Number(activeAddress.lon),
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : null;

  const renderDropdown = ({
    data,
    value,
    placeholder,
    onChange,
    loading: isLoading,
    disabled,
  }) => (
    <Dropdown
      style={[styles.dropdown, disabled && styles.disabled]}
      containerStyle={styles.dropdownContainer}
      data={data}
      labelField="label"
      valueField="value"
      value={value}
      placeholder={isLoading ? 'Loading...' : placeholder}
      disable={disabled || isLoading}
      onChange={onChange}
      search
      searchPlaceholder="Search..."
      maxHeight={300}
      placeholderStyle={styles.placeholder}
      selectedTextStyle={styles.selected}
      inputSearchStyle={styles.searchInput}
      itemTextStyle={styles.itemText}
      activeColor="#f1f5f9"
    />
  );

  return (
   
  <View style={styles.container}>
      <AppHeader
        title="Choose location"
        navigation={navigation}
        showBack
      />

      {mapLocation ? (
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={mapLocation}
            showsUserLocation={false}
            loadingEnabled
          >
            <Marker
              coordinate={{
                latitude: mapLocation.latitude,
                longitude: mapLocation.longitude,
              }}
              title="Active shopping location"
            />
          </MapView>

          <View style={styles.mapBadge}>
            <Icon
              name="map-marker-radius-outline"
              size={15}
              color={colors.brand}
            />
            <Text style={styles.mapBadgeText}>
              Active location
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.noMap}>
          <Icon
            name="map-marker-off-outline"
            size={34}
            color="#94a3b8"
          />
          <Text style={styles.noMapTitle}>
            No GPS coordinates for this location
          </Text>
          <Text style={styles.noMapText}>
            Manual locations use State → District → City → Area matching.
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.pageIntro}>
          <Text style={styles.eyebrow}>SHOPPING LOCATION</Text>
          <Text style={styles.title}>Where do you want to shop from?</Text>
          <Text style={styles.subtitle}>
            Pick your current GPS position or a saved location. This controls
            the local product feed.
          </Text>
        </View>

        {activeAddress ? (
          <View style={styles.activeCard}>
            <View style={styles.cardTop}>
              <View style={styles.activePill}>
                <Icon
                  name="check-circle"
                  size={14}
                  color="#15803d"
                />
                <Text style={styles.activePillText}>ACTIVE</Text>
              </View>

              <Text style={styles.sourceText}>
                {sourceLabel(activeAddress)}
              </Text>
            </View>

            <Text style={styles.activeTitle}>
              {locationLabel(activeAddress) || 'Current location'}
            </Text>

            {validCoords(activeAddress.lat, activeAddress.lon) ? (
              <Text style={styles.coordinates}>
                {Number(activeAddress.lat).toFixed(6)}, {Number(activeAddress.lon).toFixed(6)}
              </Text>
            ) : (
              <Text style={styles.manualMeta}>
                Manual area-based location
              </Text>
            )}

            {activeIsRegistration ? (
              <Text style={styles.registrationMeta}>
                Registration location
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Icon
              name="map-marker-plus-outline"
              size={30}
              color={colors.brand}
            />
            <Text style={styles.emptyTitle}>Add your first location</Text>
            <Text style={styles.emptyText}>
              Choose GPS or add a location manually.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={openAddLocation}
          activeOpacity={0.9}
        >
          <View style={styles.addIcon}>
            <Icon
              name="plus"
              size={22}
              color="#fff"
            />
          </View>
          <View style={styles.addBody}>
            <Text style={styles.addTitle}>Add New Location</Text>
            <Text style={styles.addText}>
              Use GPS or select State, District, City and Area.
            </Text>
          </View>
          <Icon
            name="chevron-right"
            size={22}
            color="#64748b"
          />
        </TouchableOpacity>

        {savedLocations.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Saved locations</Text>
              <Text style={styles.sectionCount}>
                {savedLocations.length}
              </Text>
            </View>

            {savedLocations.map(item => {
              const isActive = item.isActive === true;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.locationCard,
                    isActive && styles.locationCardActive,
                  ]}
                >
                  <View style={styles.locationIconBox}>
                    <Icon
                      name={
                        validCoords(item.lat, item.lon)
                          ? 'crosshairs-gps'
                          : 'map-marker-outline'
                      }
                      size={21}
                      color={colors.brand}
                    />
                  </View>

                  <View style={styles.locationBody}>
                    <Text style={styles.locationTitle}>
                      {locationLabel(item) || 'Saved location'}
                    </Text>

                    <Text style={styles.locationSub}>
                      {sourceLabel(item)}
                    </Text>

                    {validCoords(item.lat, item.lon) ? (
                      <Text style={styles.locationCoords}>
                        {Number(item.lat).toFixed(5)}, {Number(item.lon).toFixed(5)}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.locationActions}>
                    {isActive ? (
                      <View style={styles.activeMini}>
                        <Icon
                          name="check"
                          size={13}
                          color="#15803d"
                        />
                        <Text style={styles.activeMiniText}>Active</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.selectButton}
                        onPress={() => activateLocation(item)}
                        disabled={loading}
                      >
                        <Text style={styles.selectButtonText}>Use</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deleteLocation(item.id)}
                      disabled={loading || isActive}
                    >
                      <Icon
                        name="trash-can-outline"
                        size={19}
                        color={isActive ? '#cbd5e1' : '#dc2626'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {registrationAddress ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Registration location
              </Text>
            </View>

            <View
              style={[
                styles.locationCard,
                activeIsRegistration && styles.locationCardActive,
              ]}
            >
              <View style={styles.locationIconBox}>
                <Icon
                  name={
                    validCoords(
                      registrationAddress.lat,
                      registrationAddress.lon,
                    )
                      ? 'crosshairs-gps'
                      : 'map-marker-outline'
                  }
                  size={21}
                  color={colors.brand}
                />
              </View>

              <View style={styles.locationBody}>
                <Text style={styles.locationTitle}>
                  {locationLabel(registrationAddress) ||
                    'Registration location'}
                </Text>
                <Text style={styles.locationSub}>
                  {sourceLabel(registrationAddress)}
                </Text>
              </View>

              <TouchableOpacity
                style={
                  activeIsRegistration
                    ? styles.activeMini
                    : styles.selectButton
                }
                onPress={
                  activeIsRegistration
                    ? undefined
                    : activateRegistrationLocation
                }
                disabled={activeIsRegistration || loading}
              >
                {activeIsRegistration ? (
                  <>
                    <Icon
                      name="check"
                      size={13}
                      color="#15803d"
                    />
                    <Text style={styles.activeMiniText}>Active</Text>
                  </>
                ) : (
                  <Text style={styles.selectButtonText}>Use</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {showAddLocation ? (
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>NEW LOCATION</Text>
                <Text style={styles.modalTitle}>Add a location</Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={closeAddLocation}
                disabled={loading}
              >
                <Icon
                  name="close"
                  size={22}
                  color="#334155"
                />
              </TouchableOpacity>
            </View>
<ScrollView
  style={styles.modalScroll}
  contentContainerStyle={styles.modalContent}
  showsVerticalScrollIndicator={true}
  showsHorizontalScrollIndicator={false}
  scrollEnabled={true}
  nestedScrollEnabled={true}
  keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag"
  bounces={true}
  alwaysBounceVertical={true}
  overScrollMode="always"
>
              <View style={styles.methodRow}>
                <TouchableOpacity
                  style={[
                    styles.methodCard,
                    mode === 'gps' && styles.methodCardActive,
                  ]}
                  onPress={useCurrentLocation}
                  disabled={locationLoading}
                >
                  <Icon
                    name="crosshairs-gps"
                    size={25}
                    color={mode === 'gps' ? colors.brand : '#475569'}
                  />
                  <Text style={styles.methodTitle}>
                    Use Current Location
                  </Text>
                  <Text style={styles.methodText}>
                    GPS
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.methodCard,
                    mode === 'manual' && styles.methodCardActive,
                  ]}
                  onPress={chooseManual}
                >
                  <Icon
                    name="map-marker-outline"
                    size={25}
                    color={mode === 'manual' ? colors.brand : '#475569'}
                  />
                  <Text style={styles.methodTitle}>
                    Add New Address
                  </Text>
                  <Text style={styles.methodText}>
                    Manual
                  </Text>
                </TouchableOpacity>
              </View>

              {locationLoading ? (
                <View style={styles.detectingBox}>
                  <ActivityIndicator color={colors.brand} />
                  <Text style={styles.detectingText}>
                    Detecting your current location...
                  </Text>
                </View>
              ) : null}

              {geoResolveLoading ? (
                <View style={styles.detectingBox}>
                  <ActivityIndicator color={colors.brand} />
                  <Text style={styles.detectingText}>
                    Resolving your current address...
                  </Text>
                </View>
              ) : null}

              {!geoResolveLoading && geoResolveError ? (
                <View style={styles.errorBox}>
                  <Icon name="alert-circle-outline" size={16} color="#dc2626" />
                  <Text style={styles.errorText}>{geoResolveError}</Text>
                </View>
              ) : null}

              {mode === 'gps' && validCoords(lat, lon) ? (
                <View style={styles.gpsReady}>
                  <Icon
                    name="check-circle"
                    size={18}
                    color="#15803d"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gpsReadyTitle}>
                      Current location captured
                    </Text>
                    <Text style={styles.gpsReadyText}>
                      {Number(lat).toFixed(6)}, {Number(lon).toFixed(6)}
                    </Text>
                  </View>
                </View>
              ) : null}

              {mode === 'manual' ? (
                <View style={styles.manualForm}>
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
    setLandmark('');

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
                      setLandmark('');

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
                      setLandmark('');

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
                      setLandmark('');
                    },
                  })}

                  <Text style={styles.label}>AREA / LOCALITY *</Text>
                  <TextInput
                    style={[styles.textInput, !city && styles.disabledInput]}
                    value={area}
                    onChangeText={setArea}
                    placeholder={city ? 'Enter Area / Locality (e.g. Gandhi Nagar)' : 'Select City first'}
                    placeholderTextColor="#94a3b8"
                    editable={!!city}
                  />

                  <Text style={styles.label}>LANDMARK (OPTIONAL)</Text>
                  <TextInput
                    style={[styles.textInput, !city && styles.disabledInput]}
                    value={landmark}
                    onChangeText={setLandmark}
                    placeholder="Enter nearby landmark (e.g. Near Bus Stand)"
                    placeholderTextColor="#94a3b8"
                    editable={!!city}
                  />

                  <View style={styles.infoBox}>
                    <Icon
                      name="information-outline"
                      size={17}
                      color="#64748b"
                    />
                    <Text style={styles.infoText}>
                      This is a shopping location for discovering local shops & deals.
                      Door number and pincode are not required.
                    </Text>
                  </View>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (loading ||
                    locationLoading ||
                    !mode ||
                    (mode === 'gps' && !validCoords(lat, lon)) ||
                    (mode === 'manual' &&
                      (!countryId ||
                        !state ||
                        !district ||
                        !city ||
                        !area.trim()))) &&
                    styles.saveDisabled,
                ]}
                onPress={saveNewLocation}
                disabled={
                  loading ||
                  locationLoading ||
                  !mode ||
                  (mode === 'gps' && !validCoords(lat, lon)) ||
                  (mode === 'manual' &&
                    (!countryId ||
                      !state ||
                      !district ||
                      !city ||
                      !area.trim()))
                }
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.saveText}>Save Location</Text>
                    <Text style={styles.saveArrow}>→</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      ) : null}

      {loading && !showAddLocation ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mapWrap: {
    height: 190,
    backgroundColor: '#e2e8f0',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mapBadgeText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
  },
  noMap: {
    height: 150,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  noMapTitle: {
    marginTop: 7,
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
  },
  noMapText: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  sheet: {
    flex: 1,
  },
  sheetContent: {
    padding: 18,
    paddingBottom: 50,
  },
  pageIntro: {
    marginBottom: 14,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  title: {
    marginTop: 5,
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
  },
  activeCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activePillText: {
    color: '#15803d',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  sourceText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  activeTitle: {
    marginTop: 11,
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  coordinates: {
    marginTop: 5,
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  manualMeta: {
    marginTop: 5,
    color: '#64748b',
    fontSize: 11,
  },
  registrationMeta: {
    marginTop: 8,
    color: colors.brand,
    fontSize: 10,
    fontWeight: '800',
  },
  emptyCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    marginTop: 8,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 11,
  },
  addButton: {
    minHeight: 72,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  addIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  addBody: {
    flex: 1,
  },
  addTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  addText: {
    marginTop: 3,
    color: '#64748b',
    fontSize: 11,
  },
  section: {
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionCount: {
    marginLeft: 7,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    color: '#475569',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '900',
  },
  locationCard: {
    minHeight: 82,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },
  locationCardActive: {
    borderColor: '#86efac',
    backgroundColor: '#fafffb',
  },
  locationIconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#fff7e6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  locationBody: {
    flex: 1,
  },
  locationTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
  },
  locationSub: {
    marginTop: 3,
    color: '#64748b',
    fontSize: 10,
  },
  locationCoords: {
    marginTop: 3,
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
  },
  locationActions: {
    alignItems: 'flex-end',
    marginLeft: 7,
    gap: 7,
  },
  selectButton: {
    minWidth: 52,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectButtonText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '900',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeMini: {
    minHeight: 32,
    paddingHorizontal: 9,
    borderRadius: 9,
    backgroundColor: '#f0fdf4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  activeMiniText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '900',
  },
  modalBackdrop: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'transparent',
  justifyContent: 'flex-end',
},
 modalCard: {
  height: '72%',
  width: '100%',
  minHeight: 0,
  backgroundColor: '#f8fafc',
  borderTopLeftRadius: 26,
  borderTopRightRadius: 26,
  overflow: 'hidden',
},
  modalHeader: {
  paddingHorizontal: 18,
  paddingVertical: 15,
  backgroundColor: '#fff',
  borderBottomWidth: 1,
  borderBottomColor: '#e2e8f0',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
},
  modalEyebrow: {
    color: colors.brand,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalTitle: {
    marginTop: 3,
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: 18,
    paddingBottom: 34,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  methodCard: {
    flex: 1,
    minHeight: 110,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  methodCardActive: {
    borderColor: colors.brand,
    backgroundColor: '#fffaf0',
  },
  methodTitle: {
    marginTop: 10,
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '900',
  },
  methodText: {
    marginTop: 3,
    color: '#94a3b8',
    fontSize: 10,
  },
  detectingBox: {
    marginTop: 12,
    padding: 13,
    borderRadius: 13,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  detectingText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  gpsReady: {
    marginTop: 12,
    padding: 13,
    borderRadius: 13,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  gpsReadyTitle: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '900',
  },
  gpsReadyText: {
    marginTop: 2,
    color: '#15803d',
    fontSize: 10,
    fontWeight: '700',
  },
  manualForm: {
    marginTop: 12,
    padding: 15,
    borderRadius: 17,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  label: {
    marginTop: 15,
    marginBottom: 7,
    color: '#475569',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  fixedField: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fixedText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  countryCode: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '900',
  },
  dropdown: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 13,
  },
  textInput: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 13,
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  disabledInput: {
    opacity: 0.5,
    backgroundColor: '#f8fafc',
  },
  disabled: {
    opacity: 0.5,
    backgroundColor: '#f8fafc',
  },
  dropdownContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  placeholder: {
    color: '#94a3b8',
    fontSize: 13,
  },
  selected: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  searchInput: {
    height: 42,
    color: '#0f172a',
  },
  itemText: {
    color: '#0f172a',
    fontSize: 13,
  },
  infoBox: {
    marginTop: 15,
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  infoText: {
    flex: 1,
    color: '#64748b',
    fontSize: 10,
    lineHeight: 16,
  },
  saveButton: {
    minHeight: 53,
    marginTop: 15,
    borderRadius: 15,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveDisabled: {
    opacity: 0.45,
  },
  saveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  saveArrow: {
    color: '#fff',
    fontSize: 19,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
  flex: 1,
  minHeight: 0,
  width: '100%',
},
errorBox: {
    marginTop: 12,
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  errorText: {
    flex: 1,
    color: '#b91c1c',
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '700',
  },
});
