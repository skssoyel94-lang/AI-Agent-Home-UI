import { useAuth, useSSO, useSignUp } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Link, type Href, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import {
  AuthButton,
  AuthDivider,
  AuthError,
  AuthField,
  AuthShell,
  GitHubButton,
  GoogleButton,
} from '@/components/AuthShell';
import { useColors } from '@/hooks/useColors';
import { useFirebaseAuth } from '@/components/FirebaseAuthProvider';
import {
  createEmailAccount,
  firebaseAuthErrorMessage,
  sendVerificationEmail,
} from '@/lib/email-auth';

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

function errorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return 'We could not create your account. Please check your details and try again.';
}

export default function SignUpScreen() {
  useWarmUpBrowser();
  const colors = useColors();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { user: firebaseUser, refreshUser } = useFirebaseAuth();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const goHome = useCallback(() => {
    router.replace('/');
  }, [router]);

  const handleEmailSignUp = async () => {
    setLocalError('');
    try {
      await createEmailAccount(emailAddress, password);
      setVerificationSent(true);
    } catch (error) {
      setLocalError(firebaseAuthErrorMessage(error));
    }
  };

  const handleCheckVerification = async () => {
    setLocalError('');
    setVerificationLoading(true);
    try {
      const refreshedUser = await refreshUser();
      if (refreshedUser?.emailVerified) goHome();
      else setLocalError('Your email is not verified yet. Open the link in your inbox and try again.');
    } catch (error) {
      setLocalError(firebaseAuthErrorMessage(error));
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLocalError('');
    setGoogleLoading(true);
    try {
      const { createdSessionId, setActive, signUp } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({
          scheme: 'ai-agent-home-mobile',
          path: 'oauth-native',
        }),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        goHome();
      } else if (signUp?.status === 'missing_requirements') {
        router.replace('/oauth-continue' as Href);
      } else {
        setLocalError('Google sign-up could not be completed. Please try again.');
      }
    } catch (error) {
      setLocalError(errorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGitHubSignUp = async () => {
    setLocalError('');
    setGithubLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_github',
        redirectUrl: AuthSession.makeRedirectUri({
          scheme: 'ai-agent-home-mobile',
          path: 'oauth-native',
        }),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        goHome();
      } else {
        setLocalError('GitHub sign-up needs additional account details.');
      }
    } catch (error) {
      setLocalError(errorMessage(error));
    } finally {
      setGithubLoading(false);
    }
  };

  if (isSignedIn || firebaseUser) return null;

  const sdkError = errors?.fields?.emailAddress?.message || errors?.fields?.password?.message || '';
  const isLoading = fetchStatus === 'fetching';
  const verifying = verificationSent;

  return (
    <AuthShell
      title={verifying ? 'Verify your email' : 'Create your account'}
      subtitle={
        verifying
          ? `Enter the code we sent to ${emailAddress}`
          : 'Start building in your personal AI workspace'
      }
      footer={
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
          Already have an account?{' '}
          <Link href={'/sign-in' as Href} style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
            Sign in
          </Link>
        </Text>
      }
    >
      {verifying ? (
        <>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 }}>
            We sent a verification link to {emailAddress}. Open it in your email, then return here.
          </Text>
          <AuthError message={localError} />
          <AuthButton
            label={verificationLoading ? 'Checking...' : 'I verified my email'}
            onPress={handleCheckVerification}
            disabled={verificationLoading}
          />
          <Text
            onPress={() => {
              setLocalError('');
              void sendVerificationEmail().catch((error) =>
                setLocalError(firebaseAuthErrorMessage(error)),
              );
            }}
            style={{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 12, textAlign: 'center', marginTop: 18 }}
          >
            Resend verification email
          </Text>
        </>
      ) : (
        <>
          <GoogleButton onPress={handleGoogleSignUp} loading={googleLoading} />
          <GitHubButton onPress={handleGitHubSignUp} loading={githubLoading} />
          <AuthDivider />
          <AuthField
            label="Email address"
            value={emailAddress}
            onChangeText={setEmailAddress}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <AuthField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Create a password"
            secureTextEntry
            autoCapitalize="none"
          />
          <AuthError message={localError || sdkError} />
          <AuthButton
            label={isLoading ? 'Creating account...' : 'Create account'}
            onPress={handleEmailSignUp}
            disabled={!emailAddress || !password || isLoading || googleLoading || githubLoading}
          />
          <View nativeID="clerk-captcha" />
        </>
      )}
    </AuthShell>
  );
}