import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { clickable } from '@/lib/theme';

type TouchableProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Applied while a mouse pointer is over the element (web only). */
  hoverStyle?: StyleProp<ViewStyle>;
  /** Overrides the default press feedback. */
  pressStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * Single-node pressable that adds hover affordance on web and a consistent
 * press response everywhere. Layout stays identical to a plain Pressable.
 */
export function Touchable({ style, hoverStyle, pressStyle, children, ...rest }: TouchableProps) {
  const [hovered, setHovered] = useState(false);
  const interactive = !rest.disabled;

  return (
    <Pressable
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      {...rest}
      onHoverIn={(event) => { setHovered(true); rest.onHoverIn?.(event); }}
      onHoverOut={(event) => { setHovered(false); rest.onHoverOut?.(event); }}
      style={({ pressed }) => [
        interactive ? clickable : null,
        style,
        hovered && interactive ? hoverStyle : null,
        pressed && interactive ? (pressStyle ?? styles.pressed) : null,
        rest.disabled ? styles.disabled : null,
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
});
