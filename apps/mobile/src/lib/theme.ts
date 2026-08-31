import { Platform } from 'react-native';

/**
 * Terminal Luxe: a near-black graphite instrument panel with a single citron
 * signal colour. Status hues stay muted so the accent always means "act here".
 */
export const palette = {
  ink: '#08090B',
  inkSunken: '#040507',
  panel: '#101216',
  panelRaised: '#171A1F',
  panelHover: '#1D2027',
  line: '#23262C',
  lineBright: '#33373F',

  paper: '#F6F7F5',
  muted: '#9BA2AC',
  /** Dimmest text tone still cleared for body copy: 4.8:1 on `panel`. */
  mutedDeep: '#7B828D',

  // Signal accent.
  citron: '#C8F751',
  citronDeep: '#9FCB2C',
  citronWash: '#161C09',
  citronLine: '#2F3D12',
  citronText: '#9EAE6C',

  blue: '#8AB6FF',
  blueWash: '#0D131F',
  blueLine: '#25314A',

  amber: '#FFC24B',
  amberWash: '#1D1709',
  amberLine: '#453516',
  amberText: '#B99146',

  red: '#FF7A85',
  redWash: '#1C1013',
  redLine: '#4C2027',
  redText: '#C08289',

  violet: '#BCA6FF',
} as const;

/** Legacy aliases so status colours read the same across the app. */
export const semantic = {
  accent: palette.citron,
  accentDeep: palette.citronDeep,
  accentWash: palette.citronWash,
  accentLine: palette.citronLine,
  accentText: palette.citronText,
} as const;

export const spacing = { xs: 6, sm: 10, md: 16, lg: 22, xl: 32, xxl: 46 } as const;
export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;
export const layout = { maxWidth: 760, narrowWidth: 720 } as const;
export const motion = { fast: 110, base: 190, slow: 420 } as const;

export const fonts = {
  display: 'SpaceGrotesk-Bold',
  medium: 'SpaceGrotesk-Medium',
  regular: 'SpaceGrotesk-Regular',
  mono: 'JetBrainsMono-Regular',
} as const;

/**
 * Weight comes from the font file, so these tokens never set `fontWeight`:
 * doing both makes browsers synthesise a second layer of bold.
 */
export const type = {
  display: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42, letterSpacing: -1.4 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.9 },
  heading: { fontFamily: fonts.display, fontSize: 19, lineHeight: 25, letterSpacing: -0.3 },
  subheading: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 23, letterSpacing: -0.2 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  /** Uppercase machine label. Mono keeps the instrument-panel voice. */
  label: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 15, letterSpacing: 0.4 },
  /**
   * Tertiary machine label. This is the floor: nothing in the product should
   * set a smaller size, because uppercase mono stops being readable below it.
   */
  labelSm: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 14, letterSpacing: 0.4 },
  data: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18 },
  mono: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 17 },
};

/** Minimum comfortable hit area. Apple asks 44, Material asks 48. */
export const hitTarget = 44;

export const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } },
  android: { elevation: 6 }, default: {},
});

export const shadowSoft = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  android: { elevation: 3 }, default: {},
});

export function glow(color: string) {
  if (Platform.OS === 'android') return { elevation: 8 } as const;
  return { shadowColor: color, shadowOpacity: 0.45, shadowRadius: 26, shadowOffset: { width: 0, height: 8 } } as const;
}

export const clickable = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;
