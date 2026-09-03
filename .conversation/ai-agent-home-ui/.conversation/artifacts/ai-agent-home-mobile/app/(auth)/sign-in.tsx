import { useSSO, useSignIn } from '@clerk/expo';
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
  return 'We could not sign you in. Please check your details and try again.';
}

export default function SignInScreen() {
  useWarmUpBrowser();
  const colors = useColors();
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

  const goHome = useCallback(() => {
    router.replace('/');
  }, [router]);

  const handleEmailSignIn = async () => {
    setLocalError('');
    const result = await signIn.password({ emailAddress, password });
    if (result.error) {
      setLocalError(errorMessage(result.error));
      return;
    }
    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: async () => goHome(),
      });
      return;
    }
    setLocalError('This account needs one more verification step before continuing.');
  };

  const handleGoogleSignIn = async () => {
    setLocalError('');
    setGoogleLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({
          scheme: 'ai-agent-home-mobile',
          path: 'oauth-native',
        }),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        goHome();
      } else {
        setLocalError('Google sign-in needs additional account details.');
      }
    } catch (error) {
      setLocalError(errorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
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
        setLocalError('GitHub sign-in needs additional account details.');
      }
    } catch (error) {
      setLocalError(errorMessage(error));
    } finally {
      setGithubLoading(false);
    }
  };

  const sdkError =
    errors?.fields?.identifier?.message || errors?.fields?.password?.message || '';
  const isLoading = fetchStatus === 'fetching';

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue to your AI workspace"
      footer={
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
          New to CodePilot AI?{' '}
          <Link href={'/sign-up' as Href} style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
            Create an account
          </Link>
        </Text>
      }
    >
      <GoogleButton onPress={handleGoogleSignIn} loading={googleLoading} />
      <GitHubButton onPress={handleGitHubSignIn} loading={githubLoading} />
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
        placeholder="Enter your password"
        secureTextEntry
        autoCapitalize="none"
      />
      <AuthError message={localError || sdkError} />
      <AuthButton
        label={isLoading ? 'Signing in...' : 'Continue'}
        onPress={handleEmailSignIn}
        disabled={!emailAddress || !password || isLoading || googleLoading || githubLoading}
      />
      <View nativeID="clerk-captcha" />
    </AuthShell>
  );
}