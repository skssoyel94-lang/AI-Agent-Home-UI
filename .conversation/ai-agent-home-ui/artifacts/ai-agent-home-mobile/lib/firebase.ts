import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyDX835Pi2KFcAoXJiMtu_Y-JG2Oj3xVFeY',
  authDomain: 'codepilot-aii.firebaseapp.com',
  projectId: 'codepilot-aii',
  storageBucket: 'codepilot-aii.firebasestorage.app',
  messagingSenderId: '153889116171',
  appId: '1:153889116171:web:01f097e3d5c1c8a2b8b70e',
  measurementId: 'G-CPH0PLNY37',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth: Auth = getAuth(firebaseApp);

export function initializeFirebaseAnalytics() {
  if (Platform.OS !== 'web') return;
  void import('firebase/analytics').then(async ({ getAnalytics, isSupported }) => {
    if (await isSupported()) getAnalytics(firebaseApp);
  });
}