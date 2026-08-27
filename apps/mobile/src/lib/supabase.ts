import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { publicEnv } from './env';

const secureStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};

let client: SupabaseClient | null = null;

function createAuthClient(url: string, publishableKey: string): SupabaseClient {
  return createClient(url, publishableKey, {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
}

if (publicEnv.supabaseUrl && publicEnv.supabasePublishableKey) {
  client = createAuthClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey);
}

export function getSupabase(): SupabaseClient | null {
  return client;
}

export async function ensureSupabase(): Promise<SupabaseClient | null> {
  if (client) return client;
  try {
    const response = await fetch(`${publicEnv.apiUrl}/v1/auth/config`);
    if (!response.ok) return null;
    const config = (await response.json()) as {
      supabase_url?: string;
      supabase_publishable_key?: string;
    };
    if (config.supabase_url && config.supabase_publishable_key) {
      client = createAuthClient(config.supabase_url, config.supabase_publishable_key);
    }
  } catch {
    return client;
  }
  return client;
}
