import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  firebaseAuth,
  initializeFirebaseAnalytics,
} from '@/lib/firebase';

type FirebaseAuthContextValue = {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<User | null>;
  signOut: () => Promise<void>;
};

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | null>(null);

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeFirebaseAnalytics();
    return onAuthStateChanged(
      firebaseAuth,
      (nextUser) => {
        setUser(nextUser);
        setLoading(false);
      },
      () => {
        setUser(null);
        setLoading(false);
      },
    );
  }, []);

  const refreshUser = async () => {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) return null;
    await currentUser.reload();
    const refreshedUser = firebaseAuth.currentUser;
    setUser(refreshedUser);
    return refreshedUser;
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      refreshUser,
      signOut: () => firebaseSignOut(firebaseAuth),
    }),
    [loading, user],
  );

  return <FirebaseAuthContext.Provider value={value}>{children}</FirebaseAuthContext.Provider>;
}

export function useFirebaseAuth() {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    throw new Error('useFirebaseAuth must be used inside FirebaseAuthProvider');
  }
  return context;
}