// Drop-in replacements for React Native's Text / TextInput that apply the app fonts.
// fontWeight is translated to the matching font file (custom fonts on Android ignore
// fontWeight), and large bold text automatically uses the display face (Outfit).
import type { ComponentProps } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { fonts } from '../lib/theme';

function familyFor(style: TextStyle | undefined): string {
  const w = String(style?.fontWeight ?? '400');
  const size = style?.fontSize ?? 15;
  const heavy = w === 'bold' || Number(w) >= 600;
  if (heavy && size >= 20) return Number(w) >= 800 ? fonts.displayBold : fonts.display;
  switch (w) {
    case '500': return fonts.medium;
    case '600': return fonts.semibold;
    case '700': case 'bold': return fonts.bold;
    case '800': case '900': return fonts.extrabold;
    default: return fonts.regular;
  }
}

function withFont(style: TextProps['style']) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (flat.fontFamily) return style;
  return [style, { fontFamily: familyFor(flat), fontWeight: 'normal' as const }];
}

// React 19: `ref` is a normal prop, so it passes straight through.
export function Text({ style, ...props }: ComponentProps<typeof RNText>) {
  return <RNText {...props} style={withFont(style)} />;
}

export function TextInput({ style, ...props }: ComponentProps<typeof RNTextInput>) {
  return <RNTextInput {...props} style={withFont(style as TextProps['style']) as ComponentProps<typeof RNTextInput>['style']} />;
}
