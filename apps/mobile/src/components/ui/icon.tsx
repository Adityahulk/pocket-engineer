import Feather from '@expo/vector-icons/Feather';
import type { ColorValue, StyleProp, TextStyle } from 'react-native';

import { palette } from '@/lib/theme';

export type IconName = keyof typeof Feather.glyphMap;

/** Single stroke-icon family for the whole product. */
export function Icon({ name, size = 16, color = palette.paper, style }: {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<TextStyle>;
}) {
  return <Feather name={name} size={size} color={color} style={style} />;
}
