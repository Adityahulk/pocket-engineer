import { Platform } from 'react-native';

import Constants from 'expo-constants';

type PublicExtra = {
  apiUrl?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as PublicExtra;

function sameOriginApiUrl(): string {
  const location = (globalThis as { location?: { origin?: string; protocol?: string } }).location;
  if (location?.origin && location.protocol?.startsWith("http")) {
    return location.origin;
  }
  return "";
}

function defaultDevHost(): string {
  return Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";
}

export const publicEnv = {
  apiUrl: extra.apiUrl || process.env.EXPO_PUBLIC_API_URL || sameOriginApiUrl() || defaultDevHost(),
  supabaseUrl: extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || "",
  supabasePublishableKey:
    extra.supabasePublishableKey || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
};
