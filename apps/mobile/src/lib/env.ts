import Constants from 'expo-constants';

type PublicExtra = {
  apiUrl?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as PublicExtra;

export const publicEnv = {
  apiUrl: extra.apiUrl || process.env.EXPO_PUBLIC_API_URL || '',
  supabaseUrl: extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabasePublishableKey:
    extra.supabasePublishableKey || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
};
