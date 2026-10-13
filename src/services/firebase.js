import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeAuth, 
  getReactNativePersistence, 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { getFirestore, collectionGroup, onSnapshot, doc, setDoc, getDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyCa0MF38J0Zyjjn26mhFEqifzHKOM2r3lI",
  authDomain: "scaner-billing.firebaseapp.com",
  projectId: "scaner-billing",
  storageBucket: "scaner-billing.firebasestorage.app",
  messagingSenderId: "207862672282",
  appId: "1:207862672282:web:a1465f24b5c14e3a1ae823"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const db = getFirestore(app);

export { 
  app, auth, db, 
  collectionGroup, onSnapshot, doc, setDoc, getDoc,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut 
};