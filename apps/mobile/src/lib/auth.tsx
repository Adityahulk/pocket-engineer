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

import { palette } from '@/lib/theme';
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
    return <View style={styles.loading}><ActivityIndicator size="large" color={palette.mint} /></View>;
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
      <View style={styles.brandMark}><Text style={styles.brandGlyph}>PE</Text></View>
      <Text style={styles.eyebrow}>PRIVATE MISSION CONTROL</Text>
      <Text style={styles.title}>Welcome back.</Text>
      <Text style={styles.subtitle}>Sign in to manage your software and AI engineers.</Text>
      <View style={styles.form}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={palette.muted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={palette.muted}
          autoCapitalize="none"
          autoComplete="current-password"
          secureTextEntry
          onSubmitEditing={submit}
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={submitting || !email.trim() || !password}
          onPress={submit}
          style={({ pressed }) => [styles.button, (pressed || submitting) && styles.buttonPressed]}>
          <Text style={styles.buttonText}>{submitting ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>
      </View>
      <Text style={styles.help}>Accounts are created by the private-alpha administrator.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.ink },
  page: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: palette.ink },
  brandMark: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.mint, marginBottom: 24 },
  brandGlyph: { color: palette.ink, fontSize: 16, fontWeight: '900', letterSpacing: -1 },
  eyebrow: { color: palette.mint, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: palette.paper, fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1.5, marginTop: 10 },
  subtitle: { color: palette.muted, fontSize: 16, lineHeight: 23, marginTop: 10, maxWidth: 340 },
  form: { gap: 12, marginTop: 34 },
  input: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panel, color: palette.paper, paddingHorizontal: 17, fontSize: 16 },
  error: { color: palette.red, fontSize: 13, lineHeight: 18 },
  button: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.mint, marginTop: 2 },
  buttonPressed: { opacity: 0.68 },
  buttonText: { color: palette.ink, fontSize: 15, fontWeight: '900' },
  help: { color: palette.muted, textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 22 },
});
