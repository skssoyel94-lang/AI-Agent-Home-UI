import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  type UserCredential,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

export function firebaseAuthErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Try signing in instead.';
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'The email or password is incorrect.';
      case 'auth/weak-password':
        return 'Use a stronger password with at least 6 characters.';
      case 'auth/invalid-email':
        return 'Enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
    }
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Something went wrong. Please try again.';
}

export async function createEmailAccount(
  emailAddress: string,
  password: string,
): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(
    firebaseAuth,
    emailAddress.trim(),
    password,
  );
  await sendEmailVerification(credential.user);
  return credential;
}

export async function signInWithEmail(
  emailAddress: string,
  password: string,
): Promise<UserCredential> {
  return signInWithEmailAndPassword(firebaseAuth, emailAddress.trim(), password);
}

export async function sendVerificationEmail() {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Your signup session has expired. Please start again.');
  await sendEmailVerification(user);
}