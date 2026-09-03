import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  type UserCredential,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { firebaseAuth } from '@/lib/firebase';

function getCurrentHost(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.hostname;
  }
  return 'this app';
}

export async function signInWithGoogle(): Promise<UserCredential | null> {
  if (Platform.OS !== 'web') {
    throw new Error(
      'Native Google sign-in needs the Firebase Google OAuth client ID. The web preview is ready now.',
    );
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    return await signInWithPopup(firebaseAuth, provider);
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'auth/popup-blocked'
    ) {
      await signInWithRedirect(firebaseAuth, provider);
      return null;
    }
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'auth/unauthorized-domain'
    ) {
      throw new Error(
        `Firebase has not authorized ${getCurrentHost()}. Add this hostname in Firebase Console → Authentication → Settings → Authorized domains.`,
      );
    }
    throw error;
  }
}