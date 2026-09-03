import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: PropsWithChildren<{
  title: string;
  subtitle: string;
  footer: React.ReactNode;
}>) {
  const colors = useColors();
  const router = useRouter();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={styles.scrollContent}
        bottomOffset={24}
      >
        <View style={styles.brand}>
          <View style={[styles.brandIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="sparkles" size={22} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.brandName, { color: colors.foreground }]}>CODEPILOT AI</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
          {children}
        </View>

        <View style={styles.footer}>{footer}</View>
        <Pressable
          onPress={() => router.replace('/')}
          style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="arrow-back" size={15} color={colors.mutedForeground} />
          <Text style={[styles.backText, { color: colors.mutedForeground }]}>
            Back to workspace
          </Text>
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

export function AuthDivider() {
  const colors = useColors();
  return (
    <View style={styles.dividerRow}>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or continue with email</Text>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
    </View>
  );
}

export function GoogleButton({ onPress, loading }: { onPress: () => void; loading?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      testID="google-auth-button"
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.googleButton,
        { backgroundColor: colors.secondary, borderColor: colors.border },
        pressed && styles.pressed,
        loading && styles.disabled,
      ]}
    >
      <Ionicons name="logo-google" size={18} color={colors.primary} />
      <Text style={[styles.googleText, { color: colors.foreground }]}>
        {loading ? 'Connecting to Google...' : 'Continue with Google'}
      </Text>
    </Pressable>
  );
}

export function GitHubButton({ onPress, loading }: { onPress: () => void; loading?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.googleButton,
        { backgroundColor: colors.secondary, borderColor: colors.border },
        pressed && styles.pressed,
        loading && styles.disabled,
      ]}
    >
      <Ionicons name="logo-github" size={18} color={colors.foreground} />
      <Text style={[styles.googleText, { color: colors.foreground }]}>
        {loading ? 'Connecting to GitHub...' : 'Continue with GitHub'}
      </Text>
    </Pressable>
  );
}

export function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  autoCapitalize?: 'none' | 'sentences';
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[
          styles.input,
          { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground },
        ]}
      />
    </View>
  );
}

export function AuthButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.authButton,
        { backgroundColor: colors.primary },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.authButtonText, { color: colors.primaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

export function AuthError({ message }: { message: string }) {
  const colors = useColors();
  if (!message) return null;
  return (
    <View style={[styles.errorBox, { backgroundColor: colors.destructive + '1A' }]}>
      <Text style={[styles.errorText, { color: colors.destructive }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  brand: { alignItems: 'center', marginBottom: 24 },
  brandIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandName: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 2.2 },
  card: { width: '100%', borderWidth: 1, borderRadius: 22, padding: 20 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 24, textAlign: 'center' },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
  },
  field: { marginBottom: 14 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 7 },
  input: {
    minHeight: 49,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  googleButton: {
    minHeight: 49,
    borderWidth: 1,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 19 },
  divider: { height: 1, flex: 1 },
  dividerText: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  authButton: {
    minHeight: 49,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  authButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  errorBox: { borderRadius: 11, padding: 11, marginBottom: 13 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  footer: { alignItems: 'center', marginTop: 18 },
  backLink: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'center', marginTop: 24 },
  backText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
});