// Premium SVG icon set (Lucide line icons) + helpers that turn stored values
// (mood / community / avatar keys — including legacy emoji values already in the database)
// into icons, so no emoji is ever rendered in the app.
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { View, type ViewStyle } from 'react-native';
import { colors, gradients, tint } from '../lib/theme';
import { ICONS, type IconName } from './iconData';

export type { IconName };

const EL: Record<string, React.ComponentType<Record<string, unknown>>> = {
  path: Path as never,
  circle: Circle as never,
  ellipse: Ellipse as never,
  line: Line as never,
  polyline: Polyline as never,
  polygon: Polygon as never,
  rect: Rect as never,
};

export function Icon({ name, size = 22, color = colors.accent, strokeWidth = 1.9, fill = 'none', style }: {
  name: IconName; size?: number; color?: string; strokeWidth?: number; fill?: string; style?: ViewStyle;
}) {
  const node = ICONS[name] ?? ICONS.sparkles;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" style={style}>
      {node.map(([tag, attrs], i) => {
        const C = EL[tag];
        return C ? <C key={i} {...attrs} /> : null;
      })}
    </Svg>
  );
}

// Legacy emoji values (seed data, older profiles) -> icon
const EMOJI_MAP: Record<string, IconName> = {
  '🌙': 'moon', '⭐': 'star', '🌸': 'flower', '🦋': 'butterfly', '🐱': 'cat', '🐼': 'rabbit', '🦊': 'fish',
  '🐧': 'bird', '🌊': 'waves', '🔥': 'flame', '🍀': 'clover', '🎧': 'headphones', '🌈': 'rainbow', '🪐': 'planet',
  '🐢': 'turtle', '🦉': 'owl', '🎭': 'mask', '🫂': 'hug', '😰': 'wind', '😢': 'rain', '😫': 'gauge', '🌀': 'brain',
  '💔': 'heart-crack', '🥱': 'coffee', '😊': 'smile', '🌿': 'leaf', '📚': 'book', '🌧️': 'rain', '🌧': 'rain',
  '🎲': 'dice', '✨': 'sparkles', '💬': 'message', '💜': 'heart', '🙋': 'hand', '💪': 'zap',
};

// Mood ids from the seed data -> icon (used before falling back to the stored emoji)
const MOOD_MAP: Record<string, IconName> = {
  lonely: 'hug', anxious: 'wind', sad: 'rain', stressed: 'gauge', overthinking: 'brain',
  heartbroken: 'heart-crack', bored: 'coffee', happy: 'smile', motivated: 'flame', calm: 'leaf',
};

export function resolveIcon(value: string | null | undefined, moodId?: string | null): IconName {
  if (moodId && MOOD_MAP[moodId]) return MOOD_MAP[moodId];
  if (!value) return 'sparkles';
  if (value in ICONS) return value as IconName;
  const v = value.trim();
  return EMOJI_MAP[v] ?? EMOJI_MAP[v.replace(/️/g, '')] ?? 'sparkles';
}

// Selectable icons for admin community editor
export const COMMUNITY_ICONS: IconName[] = [
  'message', 'moon', 'hug', 'waves', 'book', 'rain', 'brain', 'heart-crack', 'dice', 'sparkles',
  'flame', 'leaf', 'coffee', 'headphones', 'sun', 'heart', 'users', 'star',
];

/** An icon inside a soft rounded tile — replaces large decorative emoji. */
export function Glyph({ value, moodId, size = 44, color, bg, rounded = 'circle', style }: {
  value?: string | null; moodId?: string | null; size?: number; color?: string; bg?: string;
  rounded?: 'circle' | 'square'; style?: ViewStyle;
}) {
  const c = color ?? colors.accent;
  return (
    <View style={[{
      width: size, height: size, borderRadius: rounded === 'circle' ? size / 2 : size * 0.32,
      backgroundColor: bg ?? tint(c, 0.12), alignItems: 'center', justifyContent: 'center',
    }, style]}>
      <Icon name={resolveIcon(value, moodId)} size={size * 0.5} color={c} />
    </View>
  );
}

/** Glossy gradient orb with a white icon — used for hero moments (splash, premium, welcome). */
export function Orb({ name, size = 84, colorsPair = gradients.orb }: { name: IconName; size?: number; colorsPair?: readonly [string, string] }) {
  return (
    <LinearGradient colors={colorsPair as unknown as [string, string]} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        shadowColor: colors.shadow, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
      <Icon name={name} size={size * 0.46} color="#FFFFFF" strokeWidth={1.8} />
    </LinearGradient>
  );
}
