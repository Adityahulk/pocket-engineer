import type { Session } from '@supabase/supabase-js';
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { LogoLockup } from '@/components/brand/logo';
import { clickable, palette, radius, shadow, spacing, type } from '@/lib/theme';
import { ensureSupabase, getSupabase } from '@/lib/supabase';

type AuthContextValue = { session: Session | null; signOut: () => Promise<void> };
const AuthContext = createContext<AuthContextValue>({ session: null, signOut: async () => undefined });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthGate({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    ensureSupabase().then((client) => {
      setConfigured(Boolean(client));
      if (!client) {
        setLoading(false);
        return;
      }
      client.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      });
      const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
        setLoading(false);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    }).catch(() => {
      setConfigured(false);
      setLoading(false);
    });
    return () => unsubscribe?.();
  }, []);

  const value = useMemo(() => ({
    session,
    signOut: async () => { await getSupabase()?.auth.signOut(); },
  }), [session]);

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={palette.citron} /></View>;
  }
  if (configured && !session) return <SignIn />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) return;
    const client = getSupabase();
    if (!client) return;
    setSubmitting(true);
    setError('');
    const result = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) setError(result.error.message);
    setSubmitting(false);
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.glow} />
      <View style={styles.card}>
        <LogoLockup size={44} caption="PRIVATE MISSION CONTROL" />
        <Text style={styles.title}>Welcome back.</Text>
        <Text style={styles.subtitle}>Sign in to manage your software and AI engineers.</Text>
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor={palette.mutedDeep}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={palette.mutedDeep}
              autoCapitalize="none"
              autoComplete="current-password"
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={submit}
              style={styles.input}
            />
          </View>
          {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting || !email.trim() || !password, busy: submitting }}
            disabled={submitting || !email.trim() || !password}
            onPress={submit}
            style={({ pressed }) => [
              styles.button,
              clickable,
              (pressed || submitting) && styles.buttonPressed,
              (!email.trim() || !password) && styles.buttonDisabled,
            ]}>
            {submitting
              ? <ActivityIndicator color={palette.ink} />
              : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>
        </View>
        <Text style={styles.help}>Accounts are created by the private-alpha administrator.</Text>
      </View>
      <Text style={styles.loopFooter}>OBSERVE · DIRECT · VERIFY · SHIP</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.ink },
  page: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, backgroundColor: palette.ink, overflow: 'hidden' },
  glow: { position: 'absolute', width: 460, height: 460, borderRadius: 230, backgroundColor: '#2A3D0C', opacity: 0.16, top: -200 },
  card: {
    width: '100%', maxWidth: 430, backgroundColor: palette.panel, borderColor: palette.line,
    borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, ...shadow,
  },
  title: { ...type.display, color: palette.paper, fontSize: 33, lineHeight: 38, marginTop: spacing.lg },
  subtitle: { ...type.body, color: palette.muted, marginTop: 9 },
  form: { gap: 14, marginTop: spacing.lg },
  field: { gap: 7 },
  fieldLabel: { ...type.label, color: palette.mutedDeep, fontSize: 8 },
  input: {
    minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line,
    backgroundColor: palette.ink, color: palette.paper, paddingHorizontal: 16, fontSize: 15,
  },
  errorBox: { backgroundColor: palette.redWash, borderColor: palette.redLine, borderWidth: 1, borderRadius: radius.sm, padding: 11 },
  error: { ...type.caption, color: palette.red },
  button: {
    minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.citron, marginTop: 4,
  },
  buttonPressed: { opacity: 0.72 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { ...type.label, color: palette.ink, fontSize: 11 },
  help: { ...type.caption, color: palette.mutedDeep, textAlign: 'center', marginTop: spacing.lg },
  loopFooter: { ...type.label, color: '#3C4149', marginTop: spacing.xl },
});
