import { useSignUp } from '@clerk/expo';
import { type Href, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  AuthButton,
  AuthError,
  AuthField,
  AuthShell,
} from '@/components/AuthShell';
import { useColors } from '@/hooks/useColors';

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'We could not finish your Google sign-up. Please try again.';
}

function snakeToCamel(value: string): string {
  return value.replace(/([-_][a-z])/g, (match) =>
    match.toUpperCase().replace(/-|_/, ''),
  );
}

export default function OAuthContinueScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState('');
  const missingFields = useMemo(
    () => (signUp.status === 'missing_requirements' ? signUp.missingFields : []),
    [signUp.missingFields, signUp.status],
  );

  const handleSubmit = async () => {
    setLocalError('');
    try {
      const result = await signUp.update(fieldValues);
      if (result.error) {
        setLocalError(errorMessage(result.error));
        return;
      }
      if (signUp.status === 'complete') {
        await signUp.finalize({
          navigate: async () => router.replace('/' as Href),
        });
      }
    } catch (error) {
      setLocalError(errorMessage(error));
    }
  };

  if (signUp.status !== 'missing_requirements') {
    return (
      <AuthShell
        title="Google sign-up"
        subtitle="Your Google sign-up session is no longer active."
        footer={
          <Text
            onPress={() => router.replace('/sign-up' as Href)}
            style={{
              color: colors.primary,
              fontFamily: 'Inter_600SemiBold',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            Start again
          </Text>
        }
      >
        <AuthError message="Please start the Google sign-up flow again." />
      </AuthShell>
    );
  }

  const sdkError = errors?.fields?.emailAddress?.message || '';
  const isLoading = fetchStatus === 'fetching';

  return (
    <AuthShell
      title="Almost there"
      subtitle="Google connected. Add the last details to finish your account."
      footer={
        <Text
          onPress={() => router.replace('/sign-up' as Href)}
          style={{
            color: colors.mutedForeground,
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          Not you?{' '}
          <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
            Use another account
          </Text>
        </Text>
      }
    >
      {missingFields.map((field) => {
        const fieldKey = snakeToCamel(field);
        return (
          <AuthField
            key={field}
            label={field.replaceAll('_', ' ')}
            value={fieldValues[fieldKey] || ''}
            onChangeText={(value) =>
              setFieldValues((current) => ({ ...current, [fieldKey]: value }))
            }
            placeholder={`Enter ${field.replaceAll('_', ' ')}`}
            autoCapitalize="sentences"
          />
        );
      })}
      <AuthError message={localError || sdkError} />
      <View nativeID="clerk-captcha" />
      <AuthButton
        label={isLoading ? 'Finishing...' : 'Finish sign-up'}
        onPress={handleSubmit}
        disabled={isLoading || missingFields.some((field) => !fieldValues[snakeToCamel(field)]?.trim())}
      />
    </AuthShell>
  );
}