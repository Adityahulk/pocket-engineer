import { Platform } from 'react-native';

export const palette = {
  ink: '#070C15', inkSunken: '#040810', panel: '#0F1826', panelRaised: '#17232F', panelHover: '#1B2838',
  paper: '#F4F7F2', muted: '#8D9BAE', mutedDeep: '#5B6B80', line: '#1F2C3E', lineBright: '#31435C',
  mint: '#8EF0C7', mintDark: '#45B991', mintWash: '#0C241F', mintLine: '#1F4C42', mintText: '#79C0AE',
  blue: '#8DC8FF', blueWash: '#0C1C2E', blueLine: '#274460',
  amber: '#F6C967', amberWash: '#241C0C', amberLine: '#4E3D14', amberText: '#C9A254',
  red: '#FF8792', redWash: '#25131A', redLine: '#5D2833', redText: '#CE8F98',
  violet: '#B9A6FF',
} as const;

export const spacing = { xs: 6, sm: 10, md: 16, lg: 22, xl: 32, xxl: 46 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const layout = { maxWidth: 760, narrowWidth: 720 } as const;
export const motion = { fast: 110, base: 190, slow: 420 } as const;

const monoFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
});

export const type = {
  label: { fontSize: 10, lineHeight: 13, fontWeight: '800' as const, letterSpacing: 1.6 },
  display: { fontSize: 38, lineHeight: 43, fontWeight: '900' as const, letterSpacing: -1.6 },
  title: { fontSize: 29, lineHeight: 35, fontWeight: '900' as const, letterSpacing: -1 },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '800' as const, letterSpacing: -0.4 },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '700' as const },
  body: { fontSize: 14, lineHeight: 22, fontWeight: '500' as const },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '500' as const },
  mono: { fontFamily: monoFamily, fontSize: 11, lineHeight: 17 },
};

export const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 6 }, default: {},
});

export const shadowSoft = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 3 }, default: {},
});

export function glow(color: string) {
  if (Platform.OS === 'android') return { elevation: 8 } as const;
  return { shadowColor: color, shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } } as const;
}

export const clickable = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;
