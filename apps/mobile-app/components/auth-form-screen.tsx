import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { borderRadii, colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

type AuthMode = 'create-account' | 'sign-in';

type AuthFormScreenProps = {
  mode: AuthMode;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthFormScreen({ mode }: AuthFormScreenProps) {
  const router = useRouter();
  const { createAccount, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAwaitingEmailConfirmation, setIsAwaitingEmailConfirmation] = useState(false);

  const isCreateAccount = mode === 'create-account';
  const normalizedEmail = email.trim();
  const emailIsValid = emailPattern.test(normalizedEmail);
  const passwordsMatch = password === confirmPassword;
  const formIsComplete =
    emailIsValid && password.length > 0 && (!isCreateAccount || (confirmPassword.length > 0 && passwordsMatch));

  async function submit() {
    if (isSubmitting) return;

    if (!formIsComplete) {
      setEmailTouched(true);
      setConfirmPasswordTouched(true);
      return;
    }

    setAuthError(null);
    setIsSubmitting(true);

    const result = isCreateAccount
      ? await createAccount(normalizedEmail, password)
      : await signIn(normalizedEmail, password);

    setIsSubmitting(false);

    if (result.error) {
      setAuthError(result.error);
      return;
    }

    if (isCreateAccount && result.requiresEmailConfirmation) {
      setIsAwaitingEmailConfirmation(true);
      return;
    }

    router.replace('/');
  }

  if (isAwaitingEmailConfirmation) {
    return <EmailConfirmationState email={normalizedEmail} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brandBlock}>
            <Text style={styles.wordmark}>
              UNC<Text style={styles.wordmarkAccent}>O</Text>VR
            </Text>
            <View style={styles.goldRule} />
          </View>

          <View style={styles.headingBlock}>
            <Text style={styles.title}>{isCreateAccount ? 'Create your account' : 'Welcome back'}</Text>
            <Text style={styles.supportingText}>
              {isCreateAccount
                ? 'Start uncovering the benefits you already have.'
                : 'Sign in to continue to UNCOVR.'}
            </Text>
          </View>

          <View style={styles.form}>
            <AuthField
              autoComplete="email"
              error={emailTouched && !emailIsValid ? 'Enter a valid email address.' : undefined}
              keyboardType="email-address"
              label="Email"
              onBlur={() => setEmailTouched(true)}
              onChangeText={(value) => {
                setEmail(value);
                setAuthError(null);
              }}
              placeholder="you@example.com"
              textContentType="emailAddress"
              value={email}
            />
            <AuthField
              autoComplete={isCreateAccount ? 'new-password' : 'current-password'}
              label="Password"
              onChangeText={(value) => {
                setPassword(value);
                setAuthError(null);
              }}
              onSubmitEditing={isCreateAccount ? undefined : submit}
              placeholder="Enter your password"
              secureTextEntry
              textContentType={isCreateAccount ? 'newPassword' : 'password'}
              value={password}
            />
            {isCreateAccount && (
              <AuthField
                autoComplete="new-password"
                error={
                  confirmPasswordTouched && confirmPassword.length > 0 && !passwordsMatch
                    ? 'Passwords do not match.'
                    : undefined
                }
                label="Confirm password"
                onBlur={() => setConfirmPasswordTouched(true)}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  setAuthError(null);
                }}
                onSubmitEditing={submit}
                placeholder="Re-enter your password"
                secureTextEntry
                textContentType="newPassword"
                value={confirmPassword}
              />
            )}
          </View>

          {authError && (
            <Text accessibilityLiveRegion="polite" style={styles.authError}>
              {authError}
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={!formIsComplete || isSubmitting}
            onPress={submit}
            style={({ pressed }) => [
              styles.primaryButton,
              (!formIsComplete || isSubmitting) && styles.primaryButtonDisabled,
              pressed && formIsComplete && !isSubmitting && styles.primaryButtonPressed,
            ]}>
            {isSubmitting ? (
              <>
                <ActivityIndicator color={colors.primaryBlack} size="small" />
                <Text style={styles.primaryButtonText}>
                  {isCreateAccount ? 'Creating account...' : 'Signing in...'}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.primaryButtonText}>
                  {isCreateAccount ? 'Create account' : 'Sign in'}
                </Text>
                <Ionicons color={colors.primaryBlack} name="arrow-forward" size={19} />
              </>
            )}
          </Pressable>

          <Link href={isCreateAccount ? '/sign-in' : '/create-account'} asChild>
            <Pressable style={styles.secondaryAction}>
              <Text style={styles.secondaryText}>
                {isCreateAccount ? 'Already have an account? ' : ''}
                <Text style={styles.secondaryLink}>
                  {isCreateAccount ? 'Sign in' : 'Create an account'}
                </Text>
              </Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EmailConfirmationState({ email }: { email: string }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.content, styles.confirmationContent]}>
        <View style={styles.brandBlock}>
          <Text style={styles.wordmark}>
            UNC<Text style={styles.wordmarkAccent}>O</Text>VR
          </Text>
          <View style={styles.goldRule} />
        </View>

        <View style={styles.confirmationIcon}>
          <Ionicons color={colors.gold} name="mail-outline" size={32} />
        </View>
        <View style={styles.headingBlock}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.supportingText}>
            We sent confirmation instructions to {email}. Confirm your email, then sign in.
          </Text>
        </View>

        <Link href="/sign-in" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Go to sign in</Text>
            <Ionicons color={colors.primaryBlack} name="arrow-forward" size={19} />
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

type AuthFieldProps = {
  autoComplete: 'current-password' | 'email' | 'new-password';
  error?: string;
  keyboardType?: 'email-address';
  label: string;
  onBlur?: () => void;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  placeholder: string;
  secureTextEntry?: boolean;
  textContentType: 'emailAddress' | 'newPassword' | 'password';
  value: string;
};

function AuthField({ error, label, ...inputProps }: AuthFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        placeholderTextColor={colors.secondaryBlack}
        returnKeyType={inputProps.onSubmitEditing ? 'go' : 'next'}
        selectionColor={colors.gold}
        style={[styles.input, error && styles.inputError]}
        {...inputProps}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.offWhite,
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  brandBlock: {
    alignSelf: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  wordmark: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.semibold,
    letterSpacing: 1.5,
    lineHeight: typography.lineHeights.subtitle,
  },
  wordmarkAccent: {
    color: colors.gold,
  },
  goldRule: {
    backgroundColor: colors.gold,
    height: 2,
    width: spacing.xl,
  },
  headingBlock: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  title: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.bold,
    lineHeight: typography.lineHeights.title,
  },
  supportingText: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    opacity: 0.72,
  },
  form: {
    gap: spacing.md,
  },
  authError: {
    color: '#B42318',
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    marginTop: spacing.md,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  label: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.caption,
  },
  input: {
    backgroundColor: colors.offWhite,
    borderColor: colors.warmOffWhite,
    borderRadius: borderRadii.md,
    borderWidth: 1,
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputError: {
    borderColor: '#B42318',
  },
  errorText: {
    color: '#B42318',
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: borderRadii.full,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 52,
  },
  primaryButtonDisabled: {
    opacity: 0.38,
  },
  primaryButtonPressed: {
    opacity: 0.78,
  },
  primaryButtonText: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
  },
  secondaryAction: {
    alignItems: 'center',
    marginTop: spacing.lg,
    minHeight: 44,
    padding: spacing.sm,
  },
  secondaryText: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  secondaryLink: {
    color: colors.primaryBlack,
    fontWeight: typography.weights.semibold,
    textDecorationLine: 'underline',
    textDecorationColor: colors.gold,
  },
  confirmationContent: {
    justifyContent: 'center',
  },
  confirmationIcon: {
    alignItems: 'center',
    borderColor: colors.gold,
    borderRadius: borderRadii.full,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    width: 64,
  },
});
