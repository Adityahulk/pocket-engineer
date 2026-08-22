import { Platform } from 'react-native';

export const palette = {
  ink: '#08111F', panel: '#101C2C', panelRaised: '#17263A', paper: '#F4F7F2',
  muted: '#92A0B2', line: '#26364A', mint: '#8EF0C7', mintDark: '#45B991',
  blue: '#8DC8FF', amber: '#F6C967', red: '#FF8792',
} as const;

export const spacing = { xs: 6, sm: 10, md: 16, lg: 22, xl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20 } as const;
export const type = { label: { fontSize: 10, lineHeight: 13, fontWeight: '800' as const, letterSpacing: 1.6 } };
export const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 6 }, default: {},
});

