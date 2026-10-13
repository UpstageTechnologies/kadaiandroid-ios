import { Platform, PermissionsAndroid, Alert } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  writeBatch,
  query,
  where,
} from '@react-native-firebase/firestore';

const db = getFirestore();

// Default reference location (matching user screenshot: Padanthal, Sattur, Virudhunagar)
export const DEFAULT_USER_LOCATION = {
  id: 'loc_default_padanthal',
  tag: 'Home',
  area: 'Padanthal',
  street: 'Padanthal',
  city: 'Sattur',
  district: 'Virudhunagar',
  state: 'Tamil Nadu',
  pincode: '626203',
  country: 'India',
  lat: 9.3565,
  lon: 77.9250,
  formattedAddress: 'Padanthal, Sattur, Virudhunagar, Tamil Nadu',
  receiverName: 'Customer',
  receiverPhone: '9442461428',
  locationType: 'Home',
};

// Major Indian city coordinates for instant offline & high-accuracy location switching
export const CITY_COORDINATES = {
  // Virudhunagar District & Key Neighboring Towns
  sattur: { lat: 9.3639, lon: 77.9254, state: 'Tamil Nadu', district: 'Virudhunagar' },
  padanthal: { lat: 9.3565, lon: 77.9250, state: 'Tamil Nadu', district: 'Virudhunagar' },
  virudhunagar: { lat: 9.5680, lon: 77.9624, state: 'Tamil Nadu', district: 'Virudhunagar' },
  sivakasi: { lat: 9.4533, lon: 77.7947, state: 'Tamil Nadu', district: 'Virudhunagar' },
  aruppukkottai: { lat: 9.5103, lon: 78.0984, state: 'Tamil Nadu', district: 'Virudhunagar' },
  rajapalayam: { lat: 9.4532, lon: 77.5540, state: 'Tamil Nadu', district: 'Virudhunagar' },
  srivilliputhur: { lat: 9.5107, lon: 77.6322, state: 'Tamil Nadu', district: 'Virudhunagar' },
  kovilpatti: { lat: 9.1729, lon: 77.8687, state: 'Tamil Nadu', district: 'Thoothukudi' },
  kariapatti: { lat: 9.6644, lon: 78.1065, state: 'Tamil Nadu', district: 'Virudhunagar' },
  tiruchuli: { lat: 9.5312, lon: 78.2045, state: 'Tamil Nadu', district: 'Virudhunagar' },
  watrap: { lat: 9.6384, lon: 77.6366, state: 'Tamil Nadu', district: 'Virudhunagar' },

  // Tamil Nadu Hubs
  chennai: { lat: 13.0827, lon: 80.2707, state: 'Tamil Nadu', district: 'Chennai' },
  madurai: { lat: 9.9252, lon: 78.1198, state: 'Tamil Nadu', district: 'Madurai' },
  coimbatore: { lat: 11.0168, lon: 76.9558, state: 'Tamil Nadu', district: 'Coimbatore' },
  trichy: { lat: 10.7905, lon: 78.7047, state: 'Tamil Nadu', district: 'Tiruchirappalli' },
  tiruchirappalli: { lat: 10.7905, lon: 78.7047, state: 'Tamil Nadu', district: 'Tiruchirappalli' },
  salem: { lat: 11.6643, lon: 78.1460, state: 'Tamil Nadu', district: 'Salem' },
  tirunelveli: { lat: 8.7139, lon: 77.7567, state: 'Tamil Nadu', district: 'Tirunelveli' },
  erode: { lat: 11.3410, lon: 77.7172, state: 'Tamil Nadu', district: 'Erode' },
  tiruppur: { lat: 11.1085, lon: 77.3411, state: 'Tamil Nadu', district: 'Tiruppur' },
  thanjavur: { lat: 10.7870, lon: 79.1378, state: 'Tamil Nadu', district: 'Thanjavur' },
  dindigul: { lat: 10.3673, lon: 77.9803, state: 'Tamil Nadu', district: 'Dindigul' },
  vellore: { lat: 12.9165, lon: 79.1325, state: 'Tamil Nadu', district: 'Vellore' },
  thoothukudi: { lat: 8.7642, lon: 78.1348, state: 'Tamil Nadu', district: 'Thoothukudi' },
  tuticorin: { lat: 8.7642, lon: 78.1348, state: 'Tamil Nadu', district: 'Thoothukudi' },
  nagercoil: { lat: 8.1833, lon: 77.4119, state: 'Tamil Nadu', district: 'Kanyakumari' },
  kanchipuram: { lat: 12.8342, lon: 79.7036, state: 'Tamil Nadu', district: 'Kanchipuram' },
  karur: { lat: 10.9601, lon: 78.0766, state: 'Tamil Nadu', district: 'Karur' },
  hosur: { lat: 12.7409, lon: 77.8253, state: 'Tamil Nadu', district: 'Krishnagiri' },

  // Metros & Major Indian Cities
  bengaluru: { lat: 12.9716, lon: 77.5946, state: 'Karnataka', district: 'Bengaluru Urban' },
  bangalore: { lat: 12.9716, lon: 77.5946, state: 'Karnataka', district: 'Bengaluru Urban' },
  mumbai: { lat: 19.0760, lon: 72.8777, state: 'Maharashtra', district: 'Mumbai' },
  'new delhi': { lat: 28.6139, lon: 77.2090, state: 'Delhi', district: 'New Delhi' },
  delhi: { lat: 28.6139, lon: 77.2090, state: 'Delhi', district: 'Delhi' },
  hyderabad: { lat: 17.3850, lon: 78.4867, state: 'Telangana', district: 'Hyderabad' },
  kolkata: { lat: 22.5726, lon: 88.3639, state: 'West Bengal', district: 'Kolkata' },
  ahmedabad: { lat: 23.0225, lon: 72.5714, state: 'Gujarat', district: 'Ahmedabad' },
  pune: { lat: 18.5204, lon: 73.8567, state: 'Maharashtra', district: 'Pune' },
  jaipur: { lat: 26.9124, lon: 75.7873, state: 'Rajasthan', district: 'Jaipur' },
  surat: { lat: 21.1702, lon: 72.8311, state: 'Gujarat', district: 'Surat' },
  lucknow: { lat: 26.8467, lon: 80.9462, state: 'Uttar Pradesh', district: 'Lucknow' },
  kanpur: { lat: 26.4499, lon: 80.3319, state: 'Uttar Pradesh', district: 'Kanpur' },
  nagpur: { lat: 21.1458, lon: 79.0882, state: 'Maharashtra', district: 'Nagpur' },
  indore: { lat: 22.7196, lon: 75.8577, state: 'Madhya Pradesh', district: 'Indore' },
  thane: { lat: 19.2183, lon: 72.9781, state: 'Maharashtra', district: 'Thane' },
  bhopal: { lat: 23.2599, lon: 77.4126, state: 'Madhya Pradesh', district: 'Bhopal' },
  visakhapatnam: { lat: 17.6868, lon: 83.2185, state: 'Andhra Pradesh', district: 'Visakhapatnam' },
  patna: { lat: 25.5941, lon: 85.1376, state: 'Bihar', district: 'Patna' },
  vadodara: { lat: 22.3072, lon: 73.1812, state: 'Gujarat', district: 'Vadodara' },
  ghaziabad: { lat: 28.6692, lon: 77.4538, state: 'Uttar Pradesh', district: 'Ghaziabad' },
  ludhiana: { lat: 30.9010, lon: 75.8573, state: 'Punjab', district: 'Ludhiana' },
  agra: { lat: 27.1767, lon: 78.0081, state: 'Uttar Pradesh', district: 'Agra' },
  nashik: { lat: 19.9975, lon: 73.7898, state: 'Maharashtra', district: 'Nashik' },
  faridabad: { lat: 28.4089, lon: 77.3178, state: 'Haryana', district: 'Faridabad' },
  meerut: { lat: 28.9845, lon: 77.7064, state: 'Uttar Pradesh', district: 'Meerut' },
  rajkot: { lat: 22.3039, lon: 70.8022, state: 'Gujarat', district: 'Rajkot' },
  varanasi: { lat: 25.3176, lon: 82.9739, state: 'Uttar Pradesh', district: 'Varanasi' },
  srinagar: { lat: 34.0837, lon: 74.7973, state: 'Jammu and Kashmir', district: 'Srinagar' },
  aurangabad: { lat: 19.8762, lon: 75.3433, state: 'Maharashtra', district: 'Aurangabad' },
  dhanbad: { lat: 23.7957, lon: 86.4304, state: 'Jharkhand', district: 'Dhanbad' },
  amritsar: { lat: 31.6340, lon: 74.8723, state: 'Punjab', district: 'Amritsar' },
  allahabad: { lat: 25.4358, lon: 81.8463, state: 'Uttar Pradesh', district: 'Prayagraj' },
  ranchi: { lat: 23.3441, lon: 85.3096, state: 'Jharkhand', district: 'Ranchi' },
  howrah: { lat: 22.5958, lon: 88.2636, state: 'West Bengal', district: 'Howrah' },
  jabalpur: { lat: 23.1815, lon: 79.9864, state: 'Madhya Pradesh', district: 'Jabalpur' },
  gwalior: { lat: 26.2183, lon: 78.1828, state: 'Madhya Pradesh', district: 'Gwalior' },
  vijayawada: { lat: 16.5062, lon: 80.6480, state: 'Andhra Pradesh', district: 'Krishna' },
  jodhpur: { lat: 26.2389, lon: 73.0243, state: 'Rajasthan', district: 'Jodhpur' },
  raipur: { lat: 21.2514, lon: 81.6296, state: 'Chhattisgarh', district: 'Raipur' },
  kota: { lat: 25.2138, lon: 75.8648, state: 'Rajasthan', district: 'Kota' },
  guwahati: { lat: 26.1445, lon: 91.7362, state: 'Assam', district: 'Kamrup Metropolitan' },
  chandigarh: { lat: 30.7333, lon: 76.7794, state: 'Chandigarh', district: 'Chandigarh' },
  thiruvananthapuram: { lat: 8.5241, lon: 76.9366, state: 'Kerala', district: 'Thiruvananthapuram' },
  kochi: { lat: 9.9312, lon: 76.2673, state: 'Kerala', district: 'Ernakulam' },
  kozhikode: { lat: 11.2588, lon: 75.7804, state: 'Kerala', district: 'Kozhikode' },
  thrissur: { lat: 10.5276, lon: 76.2144, state: 'Kerala', district: 'Thrissur' },
  mysore: { lat: 12.2958, lon: 76.6394, state: 'Karnataka', district: 'Mysuru' },
  hubli: { lat: 15.3647, lon: 75.1240, state: 'Karnataka', district: 'Dharwad' },
  mangalore: { lat: 12.9141, lon: 74.8560, state: 'Karnataka', district: 'Dakshina Kannada' },
  belgaum: { lat: 15.8497, lon: 74.4977, state: 'Karnataka', district: 'Belagavi' },
  gurgaon: { lat: 28.4595, lon: 77.0266, state: 'Haryana', district: 'Gurugram' },
  noida: { lat: 28.5355, lon: 77.3910, state: 'Uttar Pradesh', district: 'Gautam Buddha Nagar' },
  pondicherry: { lat: 11.9416, lon: 79.8083, state: 'Puducherry', district: 'Puducherry' },
};

// Popular areas and verified neighborhoods with high accuracy coordinates
export const CITY_POPULAR_AREAS = {
  sattur: [
    { name: 'Padanthal', lat: 9.3565, lon: 77.9250, pincode: '626203' },
    { name: 'Main Road / Bazaar', lat: 9.3642, lon: 77.9260, pincode: '626203' },
    { name: 'Bus Stand Area', lat: 9.3628, lon: 77.9248, pincode: '626203' },
    { name: 'Railway Station Road', lat: 9.3665, lon: 77.9275, pincode: '626203' },
    { name: 'North Car Street', lat: 9.3650, lon: 77.9255, pincode: '626203' },
    { name: 'Melapudur', lat: 9.3580, lon: 77.9220, pincode: '626203' },
    { name: 'Kamarajar Nagar', lat: 9.3610, lon: 77.9290, pincode: '626203' },
    { name: 'Venkatachalapuram', lat: 9.3520, lon: 77.9180, pincode: '626203' },
  ],
  padanthal: [
    { name: 'Padanthal Main Area', lat: 9.3565, lon: 77.9250, pincode: '626203' },
    { name: 'Kamaraj Nagar', lat: 9.3580, lon: 77.9230, pincode: '626203' },
    { name: 'College Road', lat: 9.3540, lon: 77.9260, pincode: '626203' },
  ],
  virudhunagar: [
    { name: 'Main Bazaar', lat: 9.5685, lon: 77.9620, pincode: '626001' },
    { name: 'Madurai Road', lat: 9.5750, lon: 77.9650, pincode: '626001' },
    { name: 'Railway Feeder Road', lat: 9.5660, lon: 77.9600, pincode: '626001' },
    { name: 'Collectorate Complex / Kooraikundu', lat: 9.5850, lon: 77.9550, pincode: '626002' },
    { name: 'Ramamoorthy Road', lat: 9.5695, lon: 77.9640, pincode: '626001' },
    { name: 'Aruppukottai Road', lat: 9.5640, lon: 77.9710, pincode: '626001' },
    { name: 'Kamarajar Salai', lat: 9.5710, lon: 77.9630, pincode: '626001' },
    { name: 'Allampatti', lat: 9.5590, lon: 77.9680, pincode: '626001' },
    { name: 'Rosalpatti', lat: 9.5520, lon: 77.9590, pincode: '626001' },
  ],
  sivakasi: [
    { name: 'Main Bazaar', lat: 9.4533, lon: 77.7947, pincode: '626123' },
    { name: 'NRKR Road', lat: 9.4510, lon: 77.7980, pincode: '626123' },
    { name: 'Bus Stand Area', lat: 9.4560, lon: 77.7930, pincode: '626123' },
    { name: 'Coronation Colony', lat: 9.4590, lon: 77.8010, pincode: '626123' },
    { name: 'Palaniandavar Colony', lat: 9.4620, lon: 77.7910, pincode: '626123' },
    { name: 'Thiruthangal Road', lat: 9.4750, lon: 77.8050, pincode: '626130' },
    { name: 'Paraipatti', lat: 9.4470, lon: 77.7880, pincode: '626123' },
  ],
  aruppukkottai: [
    { name: 'Main Bazaar', lat: 9.5103, lon: 78.0984, pincode: '626101' },
    { name: 'Bus Stand Area', lat: 9.5120, lon: 78.0950, pincode: '626101' },
    { name: 'Railway Feeder Road', lat: 9.5080, lon: 78.1020, pincode: '626101' },
    { name: 'Gandhi Nagar', lat: 9.5150, lon: 78.0920, pincode: '626101' },
  ],
  rajapalayam: [
    { name: 'Main Bazaar', lat: 9.4532, lon: 77.5540, pincode: '626117' },
    { name: 'PACR Road', lat: 9.4580, lon: 77.5590, pincode: '626117' },
    { name: 'Tenkasi Road', lat: 9.4480, lon: 77.5490, pincode: '626117' },
    { name: 'Gandhi Kalaimandram Area', lat: 9.4550, lon: 77.5520, pincode: '626117' },
  ],
  srivilliputhur: [
    { name: 'Andal Temple / Car Street', lat: 9.5107, lon: 77.6322, pincode: '626125' },
    { name: 'Madurai Road', lat: 9.5160, lon: 77.6380, pincode: '626125' },
    { name: 'Bus Stand Area', lat: 9.5120, lon: 77.6290, pincode: '626125' },
  ],
  kovilpatti: [
    { name: 'Main Road', lat: 9.1729, lon: 77.8687, pincode: '628501' },
    { name: 'New Bus Stand', lat: 9.1780, lon: 77.8720, pincode: '628501' },
    { name: 'Old Bus Stand', lat: 9.1690, lon: 77.8650, pincode: '628501' },
  ],
  madurai: [
    { name: 'Meenakshi Amman Temple / South Masi St', lat: 9.9195, lon: 78.1193, pincode: '625001' },
    { name: 'KK Nagar', lat: 9.9320, lon: 78.1480, pincode: '625020' },
    { name: 'Anna Nagar', lat: 9.9210, lon: 78.1450, pincode: '625020' },
    { name: 'Simmakkal', lat: 9.9270, lon: 78.1230, pincode: '625001' },
    { name: 'Mattuthavani', lat: 9.9450, lon: 78.1620, pincode: '625007' },
    { name: 'Goripalayam', lat: 9.9310, lon: 78.1310, pincode: '625002' },
    { name: 'Periyar Bus Stand', lat: 9.9170, lon: 78.1130, pincode: '625001' },
  ],
  chennai: [
    { name: 'T. Nagar', lat: 13.0418, lon: 80.2341, pincode: '600017' },
    { name: 'Adyar', lat: 13.0012, lon: 80.2565, pincode: '600020' },
    { name: 'Anna Nagar', lat: 13.0850, lon: 80.2100, pincode: '600040' },
    { name: 'Velachery', lat: 12.9750, lon: 80.2200, pincode: '600042' },
    { name: 'Mylapore', lat: 13.0330, lon: 80.2670, pincode: '600004' },
    { name: 'Guindy', lat: 13.0067, lon: 80.2025, pincode: '600032' },
    { name: 'Tambaram', lat: 12.9249, lon: 80.1000, pincode: '600045' },
  ],
};

// Helper: Resolve exact coordinates for an area within a given city
export function resolveAreaCoordinates(cityName, areaName) {
  if (!cityName) return null;
  const cKey = (cityName || '').trim().toLowerCase();
  const aKey = (areaName || '').trim().toLowerCase();

  // 1. Check in CITY_POPULAR_AREAS
  if (CITY_POPULAR_AREAS[cKey]) {
    const matched = CITY_POPULAR_AREAS[cKey].find(
      a => a.name.toLowerCase() === aKey || a.name.toLowerCase().includes(aKey) || aKey.includes(a.name.toLowerCase())
    );
    if (matched) {
      return { ...matched };
    }
  }

  // 2. Check in CITY_COORDINATES
  if (CITY_COORDINATES[cKey]) {
    return {
      lat: CITY_COORDINATES[cKey].lat,
      lon: CITY_COORDINATES[cKey].lon,
      pincode: CITY_COORDINATES[cKey].pincode || '626001',
    };
  }

  return null;
}

// Compute Haversine distance in kilometers accurately. Returns null if coordinates are invalid.
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (
    !Number.isFinite(nLat1) ||
    !Number.isFinite(nLon1) ||
    !Number.isFinite(nLat2) ||
    !Number.isFinite(nLon2) ||
    nLat1 < -90 || nLat1 > 90 ||
    nLat2 < -90 || nLat2 > 90 ||
    nLon1 < -180 || nLon1 > 180 ||
    nLon2 < -180 || nLon2 > 180 ||
    (nLat1 === 0 && nLon1 === 0) ||
    (nLat2 === 0 && nLon2 === 0)
  ) {
    return null;
  }

  const R = 6371; // Earth's radius in km
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Extract coordinates safely from any seller or address object, with city/area fallback
export function getSellerCoordinates(data) {
  if (!data) return null;

  const rawLat =
    data?.address?.lat ??
    data?.address?.latitude ??
    data?.latitude ??
    data?.lat ??
    data?.location?.latitude ??
    data?.location?.lat ??
    data?.coordinates?.latitude ??
    data?.coords?.latitude;

  const rawLon =
    data?.address?.lon ??
    data?.address?.lng ??
    data?.address?.longitude ??
    data?.longitude ??
    data?.lon ??
    data?.lng ??
    data?.location?.longitude ??
    data?.location?.lng ??
    data?.location?.lon ??
    data?.coordinates?.longitude ??
    data?.coords?.longitude;

  const lat = Number(rawLat);
  const lon = Number(rawLon);

  if (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    !(lat === 0 && lon === 0)
  ) {
    return { lat, lon };
  }

  // Fallback: If seller lacks explicit numeric coordinates, resolve via their city or address text
  const rawCity =
    (typeof data?.city === 'string' && data.city) ||
    (typeof data?.district === 'string' && data.district) ||
    (typeof data?.address?.city === 'string' && data.address.city) ||
    (typeof data?.address?.district === 'string' && data.address.district) ||
    (typeof data?.storeAddress?.city === 'string' && data.storeAddress.city) ||
    (typeof data?.storeAddress === 'string' && data.storeAddress) ||
    (typeof data?.address === 'string' && data.address) ||
    '';

  const cleanCity = rawCity.trim().toLowerCase();
  if (cleanCity) {
    if (CITY_COORDINATES[cleanCity]) {
      return { lat: CITY_COORDINATES[cleanCity].lat, lon: CITY_COORDINATES[cleanCity].lon };
    }
    for (const [k, coords] of Object.entries(CITY_COORDINATES)) {
      if (cleanCity.includes(k)) {
        return { lat: coords.lat, lon: coords.lon };
      }
    }
  }

  return null;
}

// Normalize address payload ensuring high accuracy coordinates and valid fields
export function normalizeAddressPayload(addr) {
  if (!addr || typeof addr !== 'object') {
    return { ...DEFAULT_USER_LOCATION };
  }

  // 1. Extract raw coordinates across all known aliases
  const rawLat =
    addr.lat ??
    addr.latitude ??
    addr.coords?.latitude ??
    addr.location?.latitude ??
    addr.coordinates?.latitude ??
    addr.address?.lat ??
    addr.address?.latitude;

  const rawLon =
    addr.lon ??
    addr.lng ??
    addr.longitude ??
    addr.coords?.longitude ??
    addr.location?.longitude ??
    addr.coordinates?.longitude ??
    addr.address?.lon ??
    addr.address?.lng ??
    addr.address?.longitude;

  let lat = Number(rawLat);
  let lon = Number(rawLon);

  // 2. Identify city/area keywords to verify or snap coordinates
  const rawCity =
    (typeof addr.city === 'string' && addr.city) ||
    (typeof addr.district === 'string' && addr.district) ||
    (typeof addr.area === 'string' && addr.area) ||
    (typeof addr.address?.city === 'string' && addr.address.city) ||
    '';

  const cleanCity = rawCity.trim().toLowerCase();
  let matchedCityCoords = null;

  if (cleanCity && CITY_COORDINATES[cleanCity]) {
    matchedCityCoords = CITY_COORDINATES[cleanCity];
  } else if (cleanCity) {
    for (const [k, coords] of Object.entries(CITY_COORDINATES)) {
      if (cleanCity.includes(k) || k.includes(cleanCity)) {
        matchedCityCoords = coords;
        break;
      }
    }
  }

  // Also check formattedAddress or street if city wasn't matched
  if (!matchedCityCoords) {
    const fullText = (
      (typeof addr.formattedAddress === 'string' ? addr.formattedAddress : '') +
      ' ' +
      (typeof addr.fullAddress === 'string' ? addr.fullAddress : '') +
      ' ' +
      (typeof addr.street === 'string' ? addr.street : '')
    ).toLowerCase();

    for (const [k, coords] of Object.entries(CITY_COORDINATES)) {
      if (fullText.includes(k)) {
        matchedCityCoords = coords;
        break;
      }
    }
  }

  // 3. Resolve and validate coordinates
  const isCoordsValid =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    !(lat === 0 && lon === 0);

  if (!isCoordsValid) {
    if (matchedCityCoords) {
      lat = matchedCityCoords.lat;
      lon = matchedCityCoords.lon;
    } else {
      lat = DEFAULT_USER_LOCATION.lat;
      lon = DEFAULT_USER_LOCATION.lon;
    }
  } else if (matchedCityCoords) {
    // If coordinates differ from the specified city by > 18 km, snap to the city coordinates
    // (This prevents device GPS from Sattur overriding a Virudhunagar / Madurai / Chennai saved address)
    const distFromCity = calculateDistance(lat, lon, matchedCityCoords.lat, matchedCityCoords.lon);
    if (distFromCity === null || distFromCity > 18) {
      lat = matchedCityCoords.lat;
      lon = matchedCityCoords.lon;
    }
  }

  const resolvedTag = (addr.tag || addr.locationType || 'Home').trim();
  const resolvedCity = (addr.city || matchedCityCoords?.district || 'Sattur').trim();
  const resolvedDistrict = (addr.district || matchedCityCoords?.district || 'Virudhunagar').trim();
  const resolvedState = (addr.state || matchedCityCoords?.state || 'Tamil Nadu').trim();
  const resolvedStreet = (addr.street || addr.area || resolvedCity).trim();

  const parts = [
    addr.completeAddress,
    resolvedStreet,
    resolvedCity,
    resolvedDistrict,
    resolvedState,
    addr.pincode,
  ].filter(Boolean);

  const formattedAddress =
    addr.formattedAddress ||
    addr.fullAddress ||
    (parts.length > 0 ? parts.join(', ') : `${resolvedStreet}, ${resolvedCity}, ${resolvedState}`);

  return {
    ...addr,
    id: addr.id || `addr_${Date.now()}`,
    tag: resolvedTag,
    locationType: resolvedTag,
    label: addr.label || `${resolvedTag} (${resolvedCity})`,
    area: addr.area || resolvedStreet,
    street: resolvedStreet,
    city: resolvedCity,
    district: resolvedDistrict,
    state: resolvedState,
    pincode: addr.pincode || (matchedCityCoords ? '626001' : '626203'),
    country: addr.country || 'India',
    lat,
    lon,
    latitude: lat,
    longitude: lon,
    formattedAddress,
    fullAddress: formattedAddress,
    receiverName: addr.receiverName || 'Customer',
    receiverPhone: addr.receiverPhone || '9442461428',
  };
}

// Reverse geocode latitude and longitude to readable address
export async function reverseGeocodeLocation(lat, lon) {
  const nLat = Number(lat);
  const nLon = Number(lon);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) {
    return null;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      nLat
    )}&lon=${encodeURIComponent(nLon)}&addressdetails=1&zoom=18`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'KadaiApp/1.0',
      },
    });
    clearTimeout(timer);

    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || payload.error) return null;

    const address = payload.address || {};
    const country = (address.country || address.country_name || 'India').trim();
    const state = (address.state || address.region || address.province || 'Tamil Nadu').trim();
    const district = (address.county || address.district || address.state_district || 'Virudhunagar').trim();
    const city = (address.city || address.town || address.village || address.municipality || 'Sattur').trim();
    const area = (
      address.suburb ||
      address.neighbourhood ||
      address.quarter ||
      address.residential ||
      address.locality ||
      address.road ||
      city ||
      'Padanthal'
    ).trim();
    const street = (address.road || area).trim();
    const pincode = (address.postcode || '').trim();
    const fullAddress = (payload.display_name || '').trim();

    const parts = [street, area !== street ? area : null, city, district, state, pincode].filter(Boolean);

    return {
      country,
      state,
      district,
      city,
      area,
      street,
      pincode,
      fullAddress: fullAddress || parts.join(', '),
      formattedAddress: parts.join(', '),
      lat: nLat,
      lon: nLon,
    };
  } catch (error) {
    console.log('Reverse geocode note:', error?.message);
    return null;
  }
}



// Forward geocode city and street name to accurate lat/lon coordinates
export async function forwardGeocodeAddress(addressOrCity) {
  if (!addressOrCity || typeof addressOrCity !== 'string') return null;
  const clean = addressOrCity.trim().toLowerCase();

  // 1. Direct local coordinate lookup
  if (CITY_COORDINATES[clean]) {
    return { ...CITY_COORDINATES[clean] };
  }
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (clean.includes(key)) {
      return { ...coords };
    }
  }

  // 1b. Check in CITY_POPULAR_AREAS
  for (const [cityKey, areaList] of Object.entries(CITY_POPULAR_AREAS)) {
    const found = areaList.find(a => clean.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(clean));
    if (found) {
      return { lat: found.lat, lon: found.lon, pincode: found.pincode };
    }
  }

  // 2. Online forward geocode via OpenStreetMap Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
      addressOrCity + ', India'
    )}&limit=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'KadaiApp/1.0',
      },
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          return { lat, lon };
        }
      }
    }
  } catch (e) {
    console.log('forwardGeocodeAddress note:', e?.message);
  }

  return null;
}

// Fetch active store locations from Firebase Firestore (created by Upstage POS sellers)
export const BASE_LOCATION_HIERARCHY = {
  india: {
    id: 'india',
    name: 'India',
    flag: '🇮🇳',
    storeCount: 3,
    states: {
      tamil_nadu: {
        id: 'tamil_nadu',
        name: 'Tamil Nadu',
        storeCount: 3,
        districts: {
          virudhunagar: {
            id: 'virudhunagar',
            name: 'Virudhunagar',
            storeCount: 3,
            cities: {
              sattur: {
                id: 'sattur',
                name: 'Sattur',
                district: 'Virudhunagar',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.3639,
                lon: 77.9254,
                pincode: '626203',
                storeCount: 2,
                streets: [
                  { name: 'Padanthal', lat: 9.3565, lon: 77.9250, pincode: '626203', isStore: true },
                  { name: 'Main Road / Bazaar', lat: 9.3642, lon: 77.9260, pincode: '626203', isStore: true },
                  { name: 'Bus Stand Area', lat: 9.3628, lon: 77.9248, pincode: '626203' },
                  { name: 'Railway Station Road', lat: 9.3665, lon: 77.9275, pincode: '626203' },
                  { name: 'North Car Street', lat: 9.3650, lon: 77.9255, pincode: '626203' },
                  { name: 'Melapudur', lat: 9.3580, lon: 77.9220, pincode: '626203' },
                  { name: 'Kamarajar Nagar', lat: 9.3610, lon: 77.9290, pincode: '626203' },
                  { name: 'Venkatachalapuram', lat: 9.3520, lon: 77.9180, pincode: '626203' },
                ],
              },
              padanthal: {
                id: 'padanthal',
                name: 'Padanthal',
                district: 'Virudhunagar',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.3565,
                lon: 77.9250,
                pincode: '626203',
                storeCount: 1,
                streets: [
                  { name: 'Padanthal Main Area', lat: 9.3565, lon: 77.9250, pincode: '626203', isStore: true },
                  { name: 'Kamaraj Nagar', lat: 9.3580, lon: 77.9230, pincode: '626203' },
                  { name: 'College Road', lat: 9.3540, lon: 77.9260, pincode: '626203' },
                ],
              },
              virudhunagar: {
                id: 'virudhunagar',
                name: 'Virudhunagar',
                district: 'Virudhunagar',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.5680,
                lon: 77.9624,
                pincode: '626001',
                storeCount: 1,
                streets: [
                  { name: 'Main Bazaar', lat: 9.5685, lon: 77.9620, pincode: '626001', isStore: true },
                  { name: 'Madurai Road', lat: 9.5750, lon: 77.9650, pincode: '626001' },
                  { name: 'Railway Feeder Road', lat: 9.5660, lon: 77.9600, pincode: '626001' },
                  { name: 'Collectorate Complex / Kooraikundu', lat: 9.5850, lon: 77.9550, pincode: '626002' },
                  { name: 'Ramamoorthy Road', lat: 9.5695, lon: 77.9640, pincode: '626001' },
                  { name: 'Aruppukottai Road', lat: 9.5640, lon: 77.9710, pincode: '626001' },
                  { name: 'Kamarajar Salai', lat: 9.5710, lon: 77.9630, pincode: '626001' },
                  { name: 'Allampatti', lat: 9.5590, lon: 77.9680, pincode: '626001' },
                  { name: 'Rosalpatti', lat: 9.5520, lon: 77.9590, pincode: '626001' },
                ],
              },
              sivakasi: {
                id: 'sivakasi',
                name: 'Sivakasi',
                district: 'Virudhunagar',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.4533,
                lon: 77.7947,
                pincode: '626123',
                storeCount: 1,
                streets: [
                  { name: 'Main Bazaar', lat: 9.4533, lon: 77.7947, pincode: '626123', isStore: true },
                  { name: 'NRKR Road', lat: 9.4510, lon: 77.7980, pincode: '626123' },
                  { name: 'Bus Stand Area', lat: 9.4560, lon: 77.7930, pincode: '626123' },
                  { name: 'Coronation Colony', lat: 9.4590, lon: 77.8010, pincode: '626123' },
                  { name: 'Palaniandavar Colony', lat: 9.4620, lon: 77.7910, pincode: '626123' },
                  { name: 'Thiruthangal Road', lat: 9.4750, lon: 77.8050, pincode: '626130' },
                  { name: 'Paraipatti', lat: 9.4470, lon: 77.7880, pincode: '626123' },
                ],
              },
              aruppukkottai: {
                id: 'aruppukkottai',
                name: 'Aruppukkottai',
                district: 'Virudhunagar',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.5103,
                lon: 78.0984,
                pincode: '626101',
                storeCount: 0,
                streets: [
                  { name: 'Main Bazaar', lat: 9.5103, lon: 78.0984, pincode: '626101' },
                  { name: 'Bus Stand Area', lat: 9.5120, lon: 78.0950, pincode: '626101' },
                  { name: 'Railway Feeder Road', lat: 9.5080, lon: 78.1020, pincode: '626101' },
                  { name: 'Gandhi Nagar', lat: 9.5150, lon: 78.0920, pincode: '626101' },
                ],
              },
              rajapalayam: {
                id: 'rajapalayam',
                name: 'Rajapalayam',
                district: 'Virudhunagar',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.4532,
                lon: 77.5540,
                pincode: '626117',
                storeCount: 0,
                streets: [
                  { name: 'Main Bazaar', lat: 9.4532, lon: 77.5540, pincode: '626117' },
                  { name: 'PACR Road', lat: 9.4580, lon: 77.5590, pincode: '626117' },
                  { name: 'Tenkasi Road', lat: 9.4480, lon: 77.5490, pincode: '626117' },
                  { name: 'Gandhi Kalaimandram Area', lat: 9.4550, lon: 77.5520, pincode: '626117' },
                ],
              },
              srivilliputhur: {
                id: 'srivilliputhur',
                name: 'Srivilliputhur',
                district: 'Virudhunagar',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.5107,
                lon: 77.6322,
                pincode: '626125',
                storeCount: 0,
                streets: [
                  { name: 'Andal Temple / Car Street', lat: 9.5107, lon: 77.6322, pincode: '626125' },
                  { name: 'Madurai Road', lat: 9.5160, lon: 77.6380, pincode: '626125' },
                  { name: 'Bus Stand Area', lat: 9.5120, lon: 77.6290, pincode: '626125' },
                ],
              },
            },
          },
          thoothukudi: {
            id: 'thoothukudi',
            name: 'Thoothukudi',
            storeCount: 0,
            cities: {
              kovilpatti: {
                id: 'kovilpatti',
                name: 'Kovilpatti',
                district: 'Thoothukudi',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.1729,
                lon: 77.8687,
                pincode: '628501',
                storeCount: 0,
                streets: [
                  { name: 'Main Road', lat: 9.1729, lon: 77.8687, pincode: '628501' },
                  { name: 'New Bus Stand', lat: 9.1780, lon: 77.8720, pincode: '628501' },
                  { name: 'Old Bus Stand', lat: 9.1690, lon: 77.8650, pincode: '628501' },
                ],
              },
            },
          },
          madurai: {
            id: 'madurai',
            name: 'Madurai',
            storeCount: 0,
            cities: {
              madurai: {
                id: 'madurai',
                name: 'Madurai',
                district: 'Madurai',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.9252,
                lon: 78.1198,
                pincode: '625001',
                storeCount: 0,
                streets: [
                  { name: 'Meenakshi Amman Temple / South Masi St', lat: 9.9195, lon: 78.1193, pincode: '625001' },
                  { name: 'KK Nagar', lat: 9.9320, lon: 78.1480, pincode: '625020' },
                  { name: 'Anna Nagar', lat: 9.9210, lon: 78.1450, pincode: '625020' },
                  { name: 'Simmakkal', lat: 9.9270, lon: 78.1230, pincode: '625001' },
                  { name: 'Mattuthavani', lat: 9.9450, lon: 78.1620, pincode: '625007' },
                  { name: 'Goripalayam', lat: 9.9310, lon: 78.1310, pincode: '625002' },
                  { name: 'Periyar Bus Stand', lat: 9.9170, lon: 78.1130, pincode: '625001' },
                ],
              },
            },
          },
          chennai: {
            id: 'chennai',
            name: 'Chennai',
            storeCount: 0,
            cities: {
              chennai: {
                id: 'chennai',
                name: 'Chennai',
                district: 'Chennai',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 13.0827,
                lon: 80.2707,
                pincode: '600001',
                storeCount: 0,
                streets: [
                  { name: 'T. Nagar', lat: 13.0418, lon: 80.2341, pincode: '600017' },
                  { name: 'Adyar', lat: 13.0012, lon: 80.2565, pincode: '600020' },
                  { name: 'Anna Nagar', lat: 13.0850, lon: 80.2100, pincode: '600040' },
                  { name: 'Velachery', lat: 12.9750, lon: 80.2200, pincode: '600042' },
                  { name: 'Mylapore', lat: 13.0330, lon: 80.2670, pincode: '600004' },
                  { name: 'Guindy', lat: 13.0067, lon: 80.2025, pincode: '600032' },
                  { name: 'Tambaram', lat: 12.9249, lon: 80.1000, pincode: '600045' },
                ],
              },
            },
          },
          coimbatore: {
            id: 'coimbatore',
            name: 'Coimbatore',
            storeCount: 0,
            cities: {
              coimbatore: {
                id: 'coimbatore',
                name: 'Coimbatore',
                district: 'Coimbatore',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 11.0168,
                lon: 76.9558,
                pincode: '641001',
                storeCount: 0,
                streets: [
                  { name: 'RS Puram', lat: 11.0080, lon: 76.9510, pincode: '641002' },
                  { name: 'Gandhipuram', lat: 11.0180, lon: 76.9680, pincode: '641012' },
                  { name: 'Peelamedu', lat: 11.0280, lon: 77.0120, pincode: '641004' },
                  { name: 'Saibaba Colony', lat: 11.0320, lon: 76.9450, pincode: '641011' },
                ],
              },
            },
          },
          tirunelveli: {
            id: 'tirunelveli',
            name: 'Tirunelveli',
            storeCount: 0,
            cities: {
              tirunelveli: {
                id: 'tirunelveli',
                name: 'Tirunelveli',
                district: 'Tirunelveli',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 8.7139,
                lon: 77.7567,
                pincode: '627001',
                storeCount: 0,
                streets: [
                  { name: 'Palayamkottai', lat: 8.7190, lon: 77.7420, pincode: '627002' },
                  { name: 'Junction / Bus Stand', lat: 8.7280, lon: 77.7210, pincode: '627001' },
                  { name: 'Town / Nellaiappar Temple', lat: 8.7290, lon: 77.6980, pincode: '627006' },
                ],
              },
            },
          },
          salem: {
            id: 'salem',
            name: 'Salem',
            storeCount: 0,
            cities: {
              salem: {
                id: 'salem',
                name: 'Salem',
                district: 'Salem',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 11.6643,
                lon: 78.1460,
                pincode: '636001',
                storeCount: 0,
                streets: [
                  { name: 'Fairlands', lat: 11.6780, lon: 78.1420, pincode: '636016' },
                  { name: 'Four Roads', lat: 11.6580, lon: 78.1520, pincode: '636009' },
                  { name: 'New Bus Stand', lat: 11.6690, lon: 78.1380, pincode: '636004' },
                ],
              },
            },
          },
        },
      },
      kerala: {
        id: 'kerala',
        name: 'Kerala',
        storeCount: 0,
        districts: {
          ernakulam: {
            id: 'ernakulam',
            name: 'Ernakulam',
            storeCount: 0,
            cities: {
              kochi: {
                id: 'kochi',
                name: 'Kochi',
                district: 'Ernakulam',
                state: 'Kerala',
                country: 'India',
                lat: 9.9312,
                lon: 76.2673,
                pincode: '682001',
                storeCount: 0,
                streets: [
                  { name: 'MG Road', lat: 9.9720, lon: 76.2840, pincode: '682035' },
                  { name: 'Marine Drive', lat: 9.9810, lon: 76.2750, pincode: '682031' },
                  { name: 'Fort Kochi', lat: 9.9650, lon: 76.2420, pincode: '682001' },
                  { name: 'Edappally', lat: 10.0260, lon: 76.3080, pincode: '682024' },
                ],
              },
            },
          },
          thiruvananthapuram: {
            id: 'thiruvananthapuram',
            name: 'Thiruvananthapuram',
            storeCount: 0,
            cities: {
              thiruvananthapuram: {
                id: 'thiruvananthapuram',
                name: 'Thiruvananthapuram',
                district: 'Thiruvananthapuram',
                state: 'Kerala',
                country: 'India',
                lat: 8.5241,
                lon: 76.9366,
                pincode: '695001',
                storeCount: 0,
                streets: [
                  { name: 'East Fort', lat: 8.4830, lon: 76.9480, pincode: '695023' },
                  { name: 'Palayam', lat: 8.5020, lon: 76.9510, pincode: '695034' },
                  { name: 'Kowdiar', lat: 8.5280, lon: 76.9640, pincode: '695003' },
                ],
              },
            },
          },
        },
      },
      karnataka: {
        id: 'karnataka',
        name: 'Karnataka',
        storeCount: 0,
        districts: {
          bengaluru_urban: {
            id: 'bengaluru_urban',
            name: 'Bengaluru Urban',
            storeCount: 0,
            cities: {
              bengaluru: {
                id: 'bengaluru',
                name: 'Bengaluru',
                district: 'Bengaluru Urban',
                state: 'Karnataka',
                country: 'India',
                lat: 12.9716,
                lon: 77.5946,
                pincode: '560001',
                storeCount: 0,
                streets: [
                  { name: 'Indiranagar', lat: 12.9784, lon: 77.6408, pincode: '560038' },
                  { name: 'Koramangala', lat: 12.9352, lon: 77.6245, pincode: '560034' },
                  { name: 'Whitefield', lat: 12.9698, lon: 77.7500, pincode: '560066' },
                  { name: 'Jayanagar', lat: 12.9308, lon: 77.5838, pincode: '560041' },
                  { name: 'MG Road', lat: 12.9756, lon: 77.6066, pincode: '560001' },
                ],
              },
            },
          },
        },
      },
      maharashtra: {
        id: 'maharashtra',
        name: 'Maharashtra',
        storeCount: 0,
        districts: {
          mumbai: {
            id: 'mumbai',
            name: 'Mumbai',
            storeCount: 0,
            cities: {
              mumbai: {
                id: 'mumbai',
                name: 'Mumbai',
                district: 'Mumbai',
                state: 'Maharashtra',
                country: 'India',
                lat: 19.0760,
                lon: 72.8777,
                pincode: '400001',
                storeCount: 0,
                streets: [
                  { name: 'Bandra West', lat: 19.0596, lon: 72.8295, pincode: '400050' },
                  { name: 'Andheri West', lat: 19.1197, lon: 72.8468, pincode: '400058' },
                  { name: 'Colaba', lat: 18.9067, lon: 72.8147, pincode: '400005' },
                  { name: 'Juhu', lat: 19.1075, lon: 72.8263, pincode: '400049' },
                ],
              },
            },
          },
          pune: {
            id: 'pune',
            name: 'Pune',
            storeCount: 0,
            cities: {
              pune: {
                id: 'pune',
                name: 'Pune',
                district: 'Pune',
                state: 'Maharashtra',
                country: 'India',
                lat: 18.5204,
                lon: 73.8567,
                pincode: '411001',
                storeCount: 0,
                streets: [
                  { name: 'Kothrud', lat: 18.5074, lon: 73.8077, pincode: '411038' },
                  { name: 'Koregaon Park', lat: 18.5362, lon: 73.8940, pincode: '411001' },
                  { name: 'Viman Nagar', lat: 18.5679, lon: 73.9143, pincode: '411014' },
                ],
              },
            },
          },
        },
      },
      delhi: {
        id: 'delhi',
        name: 'Delhi',
        storeCount: 0,
        districts: {
          new_delhi: {
            id: 'new_delhi',
            name: 'New Delhi',
            storeCount: 0,
            cities: {
              new_delhi: {
                id: 'new_delhi',
                name: 'New Delhi',
                district: 'New Delhi',
                state: 'Delhi',
                country: 'India',
                lat: 28.6139,
                lon: 77.2090,
                pincode: '110001',
                storeCount: 0,
                streets: [
                  { name: 'Connaught Place', lat: 28.6315, lon: 77.2167, pincode: '110001' },
                  { name: 'South Extension', lat: 28.5724, lon: 77.2208, pincode: '110049' },
                  { name: 'Hauz Khas', lat: 28.5494, lon: 77.2001, pincode: '110016' },
                ],
              },
            },
          },
        },
      },
    },
  },
  united_arab_emirates: {
    id: 'united_arab_emirates',
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    storeCount: 0,
    states: {
      dubai: {
        id: 'dubai',
        name: 'Dubai',
        storeCount: 0,
        districts: {
          dubai: {
            id: 'dubai',
            name: 'Dubai City',
            storeCount: 0,
            cities: {
              dubai: {
                id: 'dubai',
                name: 'Dubai',
                district: 'Dubai City',
                state: 'Dubai',
                country: 'United Arab Emirates',
                lat: 25.2048,
                lon: 55.2708,
                pincode: '',
                storeCount: 0,
                streets: [
                  { name: 'Downtown / Burj Khalifa', lat: 25.1972, lon: 55.2744 },
                  { name: 'Dubai Marina', lat: 25.0805, lon: 55.1403 },
                  { name: 'Deira / Gold Souk', lat: 25.2711, lon: 55.3075 },
                  { name: 'Bur Dubai', lat: 25.2532, lon: 55.2974 },
                  { name: 'Jumeirah', lat: 25.1872, lon: 55.2446 },
                ],
              },
            },
          },
        },
      },
      abu_dhabi: {
        id: 'abu_dhabi',
        name: 'Abu Dhabi',
        storeCount: 0,
        districts: {
          abu_dhabi: {
            id: 'abu_dhabi',
            name: 'Abu Dhabi City',
            storeCount: 0,
            cities: {
              abu_dhabi: {
                id: 'abu_dhabi',
                name: 'Abu Dhabi',
                district: 'Abu Dhabi City',
                state: 'Abu Dhabi',
                country: 'United Arab Emirates',
                lat: 24.4539,
                lon: 54.3773,
                pincode: '',
                storeCount: 0,
                streets: [
                  { name: 'Corniche Road', lat: 24.4764, lon: 54.3312 },
                  { name: 'Al Reem Island', lat: 24.4984, lon: 54.4072 },
                  { name: 'Yas Island', lat: 24.4988, lon: 54.6044 },
                ],
              },
            },
          },
        },
      },
    },
  },
  sri_lanka: {
    id: 'sri_lanka',
    name: 'Sri Lanka',
    flag: '🇱🇰',
    storeCount: 0,
    states: {
      western_province: {
        id: 'western_province',
        name: 'Western Province',
        storeCount: 0,
        districts: {
          colombo: {
            id: 'colombo',
            name: 'Colombo District',
            storeCount: 0,
            cities: {
              colombo: {
                id: 'colombo',
                name: 'Colombo',
                district: 'Colombo District',
                state: 'Western Province',
                country: 'Sri Lanka',
                lat: 6.9271,
                lon: 79.8612,
                pincode: '',
                storeCount: 0,
                streets: [
                  { name: 'Pettah Main Street', lat: 6.9388, lon: 79.8540 },
                  { name: 'Galle Face Green', lat: 6.9249, lon: 79.8458 },
                  { name: 'Kollupitiya', lat: 6.9080, lon: 79.8510 },
                  { name: 'Bambalapitiya', lat: 6.8920, lon: 79.8550 },
                ],
              },
            },
          },
        },
      },
    },
  },
  singapore: {
    id: 'singapore',
    name: 'Singapore',
    flag: '🇸🇬',
    storeCount: 0,
    states: {
      central_region: {
        id: 'central_region',
        name: 'Central Region',
        storeCount: 0,
        districts: {
          central: {
            id: 'central',
            name: 'Central Area',
            storeCount: 0,
            cities: {
              singapore: {
                id: 'singapore',
                name: 'Singapore',
                district: 'Central Area',
                state: 'Central Region',
                country: 'Singapore',
                lat: 1.3521,
                lon: 103.8198,
                pincode: '',
                storeCount: 0,
                streets: [
                  { name: 'Orchard Road', lat: 1.3048, lon: 103.8318 },
                  { name: 'Marina Bay Sands', lat: 1.2834, lon: 103.8607 },
                  { name: 'Little India', lat: 1.3068, lon: 103.8519 },
                  { name: 'Chinatown', lat: 1.2815, lon: 103.8436 },
                ],
              },
            },
          },
        },
      },
    },
  },
};

// Extracts available countries, cities with active stores, and full location hierarchy (Country -> State -> District -> City -> Street)
export async function fetchAvailableStoreLocations() {
  try {
    const countriesMap = new Map();
    const citiesMap = new Map();
    const areasByCity = {};

    // Clone base hierarchy
    const hierarchy = JSON.parse(JSON.stringify(BASE_LOCATION_HIERARCHY));

    // Query all Upstage POS sellers from Firestore
    const sellersSnap = await getDocs(
      query(collection(db, 'users'), where('role', '==', 'seller'))
    );

    sellersSnap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const coords = getSellerCoordinates(data);

      const rawCountry = (
        data.country ||
        data.address?.country ||
        data.storeAddress?.country ||
        data.storeCountry ||
        'India'
      ).trim();
      const countryName = rawCountry.charAt(0).toUpperCase() + rawCountry.slice(1);
      const countryKey = countryName.toLowerCase();

      // Tally country
      if (!countriesMap.has(countryKey)) {
        countriesMap.set(countryKey, {
          id: countryKey,
          name: countryName,
          flag: countryKey === 'india' ? '🇮🇳' : '🌐',
          storeCount: 1,
        });
      } else {
        countriesMap.get(countryKey).storeCount += 1;
      }

      const rawState = (data.state || data.address?.state || data.storeAddress?.state || 'Tamil Nadu').trim();
      const stateName = rawState.charAt(0).toUpperCase() + rawState.slice(1);
      const stateKey = stateName.toLowerCase().replace(/[^a-z0-9]/g, '_');

      const rawDistrict = (data.district || data.address?.district || '').trim();
      const districtName = rawDistrict ? (rawDistrict.charAt(0).toUpperCase() + rawDistrict.slice(1)) : 'Virudhunagar';
      const districtKey = districtName.toLowerCase().replace(/[^a-z0-9]/g, '_');

      // Extract city
      const rawCity = (
        data.city ||
        data.address?.city ||
        data.storeAddress?.city ||
        data.location?.city ||
        data.district ||
        ''
      ).trim();

      // Extract area / street
      const rawArea = (
        data.area ||
        data.address?.area ||
        data.street ||
        data.address?.street ||
        data.storeAddress?.area ||
        data.storeAddress?.street ||
        ''
      ).trim();

      const shopName = data.shopName || data.name || 'Store';

      if (rawCity) {
        const cityKey = rawCity.toLowerCase().replace(/[^a-z0-9]/g, '_');

        if (!citiesMap.has(cityKey)) {
          citiesMap.set(cityKey, {
            id: cityKey,
            name: rawCity,
            city: rawCity,
            district: districtName || (CITY_COORDINATES[cityKey]?.district || ''),
            state: stateName || (CITY_COORDINATES[cityKey]?.state || 'Tamil Nadu'),
            country: countryName,
            lat: coords?.lat || (CITY_COORDINATES[cityKey]?.lat || DEFAULT_USER_LOCATION.lat),
            lon: coords?.lon || (CITY_COORDINATES[cityKey]?.lon || DEFAULT_USER_LOCATION.lon),
            storeCount: 1,
            stores: [{ id: docSnap.id, name: shopName, area: rawArea, lat: coords?.lat, lon: coords?.lon }],
            areas: rawArea ? [rawArea] : [],
          });
        } else {
          const entry = citiesMap.get(cityKey);
          entry.storeCount += 1;
          entry.stores.push({ id: docSnap.id, name: shopName, area: rawArea, lat: coords?.lat, lon: coords?.lon });
          if (rawArea && !entry.areas.includes(rawArea)) {
            entry.areas.push(rawArea);
          }
        }

        if (rawArea) {
          if (!areasByCity[cityKey]) areasByCity[cityKey] = [];
          if (!areasByCity[cityKey].some(a => a.name.toLowerCase() === rawArea.toLowerCase())) {
            areasByCity[cityKey].push({
              name: rawArea,
              lat: coords?.lat || (CITY_COORDINATES[cityKey]?.lat || DEFAULT_USER_LOCATION.lat),
              lon: coords?.lon || (CITY_COORDINATES[cityKey]?.lon || DEFAULT_USER_LOCATION.lon),
              isStoreLocation: true,
              storeName: shopName,
            });
          }
        }
      }

      // Merge into hierarchy tree: Country -> State -> District -> City -> Street
      if (!hierarchy[countryKey]) {
        hierarchy[countryKey] = {
          id: countryKey,
          name: countryName,
          flag: countryKey === 'india' ? '🇮🇳' : '🌐',
          storeCount: 0,
          states: {},
        };
      }
      hierarchy[countryKey].storeCount += 1;

      if (!hierarchy[countryKey].states[stateKey]) {
        hierarchy[countryKey].states[stateKey] = {
          id: stateKey,
          name: stateName,
          storeCount: 0,
          districts: {},
        };
      }
      hierarchy[countryKey].states[stateKey].storeCount += 1;

      if (!hierarchy[countryKey].states[stateKey].districts[districtKey]) {
        hierarchy[countryKey].states[stateKey].districts[districtKey] = {
          id: districtKey,
          name: districtName,
          storeCount: 0,
          cities: {},
        };
      }
      hierarchy[countryKey].states[stateKey].districts[districtKey].storeCount += 1;

      if (rawCity) {
        const cityKey = rawCity.toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (!hierarchy[countryKey].states[stateKey].districts[districtKey].cities[cityKey]) {
          hierarchy[countryKey].states[stateKey].districts[districtKey].cities[cityKey] = {
            id: cityKey,
            name: rawCity,
            district: districtName,
            state: stateName,
            country: countryName,
            lat: coords?.lat || (CITY_COORDINATES[cityKey]?.lat || DEFAULT_USER_LOCATION.lat),
            lon: coords?.lon || (CITY_COORDINATES[cityKey]?.lon || DEFAULT_USER_LOCATION.lon),
            pincode: data.pincode || data.address?.pincode || (CITY_COORDINATES[cityKey]?.pincode || '626203'),
            storeCount: 0,
            streets: [],
          };
        }
        const cityObj = hierarchy[countryKey].states[stateKey].districts[districtKey].cities[cityKey];
        cityObj.storeCount += 1;

        if (rawArea) {
          const streetExists = cityObj.streets.some(s => s.name.toLowerCase() === rawArea.toLowerCase());
          if (!streetExists) {
            cityObj.streets.unshift({
              name: rawArea,
              lat: coords?.lat || cityObj.lat,
              lon: coords?.lon || cityObj.lon,
              pincode: data.pincode || data.address?.pincode || cityObj.pincode,
              isStore: true,
              storeName: shopName,
            });
          } else {
            const existing = cityObj.streets.find(s => s.name.toLowerCase() === rawArea.toLowerCase());
            if (existing) {
              existing.isStore = true;
              existing.storeName = shopName;
            }
          }
        }
      }
    });

    // Ensure India is always present as default option
    if (!countriesMap.has('india')) {
      countriesMap.set('india', {
        id: 'india',
        name: 'India',
        flag: '🇮🇳',
        storeCount: citiesMap.size || 3,
      });
    }

    const countries = Array.from(countriesMap.values());
    const storeCities = Array.from(citiesMap.values()).sort((a, b) => b.storeCount - a.storeCount);

    const result = {
      countries,
      storeCities,
      storeAreasByCity: areasByCity,
      hierarchy,
    };

    // Cache to AsyncStorage for instant warm start
    AsyncStorage.setItem('@kadai_store_locations_cache', JSON.stringify(result)).catch(() => {});

    return result;
  } catch (error) {
    console.log('fetchAvailableStoreLocations note:', error?.message);
    try {
      const raw = await AsyncStorage.getItem('@kadai_store_locations_cache');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      countries: [{ id: 'india', name: 'India', flag: '🇮🇳', storeCount: 3 }],
      storeCities: [],
      storeAreasByCity: {},
      hierarchy: BASE_LOCATION_HIERARCHY,
    };
  }
}

// Request Location Permission
export async function requestLocationPermission() {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'Upstage Kadai needs access to your location to find fresh items from neighborhood stores.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    if (Platform.OS === 'ios') {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      return auth === 'granted';
    }

    return true;
  } catch (e) {
    console.log('Permission error:', e?.message);
    return false;
  }
}

// Detect User's Current GPS Location and Reverse-Geocode
export function detectUserLocation(onProgress = null) {
  return new Promise(async resolve => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        // Fall back to cached or default location
        const cached = await getCachedLocation();
        return resolve(cached || DEFAULT_USER_LOCATION);
      }

      if (onProgress) onProgress('locating');

      Geolocation.getCurrentPosition(
        async position => {
          const lat = Number(position?.coords?.latitude);
          const lon = Number(position?.coords?.longitude);

          if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            const cached = await getCachedLocation();
            return resolve(cached || DEFAULT_USER_LOCATION);
          }

          if (onProgress) onProgress('resolving');
          const resolved = await reverseGeocodeLocation(lat, lon);

          const finalLocation = {
            id: `loc_${Date.now()}`,
            tag: 'Home',
            locationType: 'Home',
            area: resolved?.area || 'Padanthal',
            street: resolved?.street || resolved?.area || 'Padanthal',
            city: resolved?.city || 'Sattur',
            district: resolved?.district || 'Virudhunagar',
            state: resolved?.state || 'Tamil Nadu',
            pincode: resolved?.pincode || '626203',
            country: resolved?.country || 'India',
            lat,
            lon,
            formattedAddress:
              resolved?.formattedAddress ||
              resolved?.fullAddress ||
              `${resolved?.area || 'Padanthal'}, ${resolved?.city || 'Sattur'}, ${resolved?.state || 'Tamil Nadu'}`,
            isGps: true,
            timestamp: new Date().toISOString(),
          };

          // Cache for instant cold start
          await AsyncStorage.setItem('@kadai_active_address', JSON.stringify(finalLocation));
          resolve(finalLocation);
        },
        async error => {
          console.log('Geolocation getCurrentPosition note:', error?.message);
          const cached = await getCachedLocation();
          resolve(cached || DEFAULT_USER_LOCATION);
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 120000,
        }
      );
    } catch (e) {
      console.log('detectUserLocation error:', e?.message);
      const cached = await getCachedLocation();
      resolve(cached || DEFAULT_USER_LOCATION);
    }
  });
}

// Retrieve Cached Location from AsyncStorage
export async function getCachedLocation() {
  try {
    const raw = await AsyncStorage.getItem('@kadai_active_address');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        return normalizeAddressPayload(parsed);
      }
    }
  } catch (e) {}
  return null;
}

// Save an active location to AsyncStorage and Firestore
export async function saveActiveLocation(userId, addressData) {
  try {
    const normalized = normalizeAddressPayload(addressData);
    const payload = {
      ...normalized,
      timestamp: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem('@kadai_active_address', JSON.stringify(payload));

    // Also persist in local saved list for instant recall
    try {
      const localCached = await AsyncStorage.getItem('@kadai_saved_addresses_local');
      const existing = localCached ? JSON.parse(localCached) : [];
      const updated = [payload, ...existing.filter(item => item.id !== payload.id)];
      await AsyncStorage.setItem('@kadai_saved_addresses_local', JSON.stringify(updated.slice(0, 15)));
    } catch (e) {}

    if (userId) {
      const customerRef = doc(db, 'customers', userId);
      const addrId = addressData.id || `addr_${Date.now()}`;
      const savedRef = doc(db, 'customers', userId, 'saved_addresses', addrId);

      const batch = writeBatch(db);
      batch.set(customerRef, { address: payload }, { merge: true });
      batch.set(savedRef, { ...payload, id: addrId, isActive: true });
      await batch.commit();
      console.log('✅ Address saved to Firebase Firestore for user:', userId);
    }

    return payload;
  } catch (e) {
    console.log('saveActiveLocation note:', e?.message);
    return normalizeAddressPayload(addressData);
  }
}

// Load Saved Addresses for the User directly from Firebase Firestore (ZERO dummy addresses)
export async function fetchUserSavedAddresses(userId) {
  if (!userId) {
    try {
      const cached = await AsyncStorage.getItem('@kadai_saved_addresses_local');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(item => normalizeAddressPayload(item));
        }
      }
    } catch (e) {}
    return [];
  }

  try {
    const list = [];
    const seen = new Set();

    // 1. Fetch from Firestore subcollection: customers/{userId}/saved_addresses
    const snap = await getDocs(collection(db, 'customers', userId, 'saved_addresses'));
    if (!snap.empty) {
      snap.docs.forEach(d => {
        const data = d.data() || {};
        const key = `${data.street || ''}_${data.city || ''}_${data.pincode || ''}_${data.tag || ''}`.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          list.push(normalizeAddressPayload({ id: d.id, ...data }));
        }
      });
    }

    // 2. Also check primary customer profile doc: customers/{userId}
    const customerSnap = await getDoc(doc(db, 'customers', userId));
    if (customerSnap.exists()) {
      const cData = customerSnap.data() || {};
      if (cData.address && (cData.address.fullAddress || cData.address.street || cData.address.city)) {
        const key = `${cData.address.street || ''}_${cData.address.city || ''}_${cData.address.pincode || ''}_${cData.address.tag || ''}`.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          list.unshift(normalizeAddressPayload({
            id: 'registered_primary_addr',
            tag: cData.address.tag || cData.address.locationType || 'Home',
            locationType: cData.address.locationType || 'Home',
            label: `${cData.address.tag || 'Home'} (${cData.address.area || cData.address.city || 'Primary'})`,
            receiverName: cData.name || cData.address.receiverName || 'Customer',
            receiverPhone: cData.mobile || cData.address.receiverPhone || '',
            ...cData.address,
            isActive: true,
          }));
        }
      }
    }

    // 3. Also check local session cache
    try {
      const cached = await AsyncStorage.getItem('@kadai_saved_addresses_local');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          parsed.forEach(data => {
            const key = `${data.street || ''}_${data.city || ''}_${data.pincode || ''}_${data.tag || ''}`.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              list.push(normalizeAddressPayload(data));
            }
          });
        }
      }
    } catch (e) {}

    return list.map(item => normalizeAddressPayload(item));
  } catch (e) {
    console.log('fetchUserSavedAddresses from Firebase note:', e?.message);
    return [];
  }
}

// Delete a saved address from Firestore and local caches
export async function deleteSavedAddress(userId, addressId, addressData = null) {
  try {
    if (!addressId) return false;

    // 1. Remove from local AsyncStorage cache
    try {
      const localCached = await AsyncStorage.getItem('@kadai_saved_addresses_local');
      if (localCached) {
        const parsed = JSON.parse(localCached);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(item => {
            if (item.id && item.id === addressId) return false;
            if (addressData?.formattedAddress && item.formattedAddress === addressData.formattedAddress) return false;
            return true;
          });
          await AsyncStorage.setItem('@kadai_saved_addresses_local', JSON.stringify(filtered));
        }
      }
    } catch (e) {
      console.log('Error updating local saved addresses cache on delete:', e);
    }

    // 2. If it's the current active address, update active address to fallback
    try {
      const activeRaw = await AsyncStorage.getItem('@kadai_active_address');
      if (activeRaw) {
        const active = JSON.parse(activeRaw);
        if (active.id === addressId || (addressData?.formattedAddress && active.formattedAddress === addressData.formattedAddress)) {
          await AsyncStorage.setItem('@kadai_active_address', JSON.stringify(DEFAULT_USER_LOCATION));
        }
      }
    } catch (e) {}

    // 3. Remove from Firebase Firestore
    if (userId) {
      if (addressId !== 'registered_primary_addr') {
        const addressRef = doc(db, 'customers', userId, 'saved_addresses', addressId);
        await deleteDoc(addressRef);
        console.log('✅ Address deleted from Firestore:', addressId);
      } else {
        // If it was the primary profile address, clear the address field on the customer document
        const customerRef = doc(db, 'customers', userId);
        await updateDoc(customerRef, { address: null });
        console.log('✅ Primary address cleared on customer profile');
      }
    }

    return true;
  } catch (error) {
    console.log('deleteSavedAddress error:', error?.message);
    return false;
  }
}

