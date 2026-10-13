import React, { createContext, useState, useEffect } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  db,
  doc,
  onSnapshot,
} from '../services/firebase';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [customerData, setCustomerData] = useState(null);

  const [isLoading, setIsLoading] = useState(true);

  const [registrationInProgress, setRegistrationInProgressState] =
    useState(false);

  const [registrationStateReady, setRegistrationStateReady] =
    useState(false);
const authInstance = getAuth();
  const setRegistrationInProgress = async (value) => {
    try {
      if (value) {
        await AsyncStorage.setItem(
          'registrationInProgress',
          'true'
        );
      } else {
        await AsyncStorage.removeItem(
          'registrationInProgress'
        );
      }

      setRegistrationInProgressState(value);
    } catch (e) {
      console.error(
        '❌ REGISTRATION STATE STORAGE ERROR',
        e
      );
    }
  };

  useEffect(() => {
    let mounted = true;
    let unsubscribeCustomer = null;

    const initialize = async () => {
      try {
        const storedRegistration =
          await AsyncStorage.getItem(
            'registrationInProgress'
          );

        if (mounted) {
          setRegistrationInProgressState(
            storedRegistration === 'true'
          );

          setRegistrationStateReady(true);
        }
      } catch (e) {
        console.error(
          '❌ REGISTRATION STATE LOAD ERROR',
          e
        );

        if (mounted) {
          setRegistrationInProgressState(false);
          setRegistrationStateReady(true);
        }
      }
    };

    initialize();
const unsubscribeAuth = onAuthStateChanged(
  authInstance,
  (firebaseUser) => {
        if (!mounted) return;

        if (unsubscribeCustomer) {
          unsubscribeCustomer();
          unsubscribeCustomer = null;
        }

        if (firebaseUser) {
          setUser(firebaseUser);

          const customerRef = doc(
            db,
            'customers',
            firebaseUser.uid
          );

          unsubscribeCustomer = onSnapshot(
            customerRef,
            (snap) => {
              if (!mounted) return;

              if (snap.exists()) {
                setCustomerData(snap.data());
              } else {
                setCustomerData(null);
              }
            },
            (error) => {
              console.error(
                '❌ CUSTOMER FIRESTORE ERROR'
              );
              console.error('CODE:', error?.code);
              console.error(
                'MESSAGE:',
                error?.message
              );

              if (mounted) {
                setCustomerData(null);
              }
            }
          );
        } else {
          setUser(null);
          setCustomerData(null);
        }

        setIsLoading(false);
      });

    return () => {
      mounted = false;

      unsubscribeAuth();

      if (unsubscribeCustomer) {
        unsubscribeCustomer();
      }
    };
  }, []);

  const loginUser = (userData, profileData) => {
    setUser(userData);
    setCustomerData(profileData);
  };

  const logoutUser = async () => {
    setIsLoading(true);

    try {
     await signOut(authInstance);
    } catch (e) {
      console.error('Logout error:', e);
    }

    try {
      await AsyncStorage.removeItem(
        'registrationInProgress'
      );
    } catch (e) {
      // Ignore storage cleanup error.
    }

    setRegistrationInProgressState(false);
    setUser(null);
    setCustomerData(null);
    setIsLoading(false);
  };

  if (!registrationStateReady) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        customerData,
        isLoading,

        registrationInProgress,
        setRegistrationInProgress,

        loginUser,
        logoutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};