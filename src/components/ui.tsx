import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, gradients, radius, shadow, tint } from '../lib/theme';
import { Glyph, Icon, resolveIcon, type IconName } from './Icon';
import { Text, TextInput } from './Text';

export function Screen({
  children,
  scroll = true,
  edges = ['bottom'],
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
  style?: ViewStyle;
}) {
  return (
    <SafeAreaView style={s.screen} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={[s.pad, style]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={s.title}>{children}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

export function T({ children, dim, faint, size = 15, bold, style, numberOfLines }: {
  children: ReactNode; dim?: boolean; faint?: boolean; size?: number; bold?: boolean; style?: object; numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color: faint ? colors.textFaint : dim ? colors.textDim : colors.text, fontSize: size, fontWeight: bold ? '700' : '400', lineHeight: size * 1.45 }, style]}
    >
      {children}
    </Text>
  );
}

export function Btn({
  title, onPress, kind = 'primary', loading, disabled, small, style, icon,
}: {
  title: string; onPress?: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean; disabled?: boolean; small?: boolean; style?: ViewStyle; icon?: IconName;
}) {
  const fg = kind === 'primary' || kind === 'danger' ? colors.onAccent : colors.accent;
  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {icon ? <Icon name={icon} size={small ? 16 : 19} color={fg} style={{ marginRight: 8 }} /> : null}
      <Text style={[s.btnText, { color: fg }, small && { fontSize: 14 }]}>{title}</Text>
    </View>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        { borderRadius: small ? radius.sm : radius.md, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        kind === 'primary' && !disabled && shadow.lift,
        style,
      ]}
    >
      {kind === 'primary' ? (
        <LinearGradient colors={gradients.primary as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.btn, small && s.btnSmall]}>
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            s.btn,
            small && s.btnSmall,
            kind === 'danger' && { backgroundColor: colors.danger },
            kind === 'secondary' && { backgroundColor: colors.surface2 },
            kind === 'ghost' && { borderWidth: 1.5, borderColor: colors.accentLight, backgroundColor: 'transparent' },
          ]}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}

export function Field({ label, error, icon, ...props }: TextInputProps & { label?: string; error?: string | null; icon?: IconName }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View>
        {icon ? <Icon name={icon} size={18} color={colors.textFaint} style={{ position: 'absolute', left: 14, top: 15, zIndex: 1 }} /> : null}
        <TextInput
          placeholderTextColor={colors.textFaint}
          style={[s.input, icon && { paddingLeft: 42 }, props.multiline && { minHeight: 110, textAlignVertical: 'top' }]}
          {...props}
        />
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: ViewStyle }) {
  if (!onPress) return <View style={[s.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, style, pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] }]}>
      {children}
    </Pressable>
  );
}

/** Avatar: the stored avatar key (or legacy emoji) rendered as an icon in a soft circle. */
export function Avatar({ emoji, size = 40, premium }: { emoji: string; size?: number; premium?: boolean }) {
  const ring = premium ? 2.5 : 0;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: ring, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
      <LinearGradient
        colors={['#E9F0FD', '#CFDDF9']}
        start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
        style={{ width: size - ring * 2, height: size - ring * 2, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name={resolveIcon(emoji)} size={size * 0.46} color={colors.accent} strokeWidth={1.8} />
      </LinearGradient>
    </View>
  );
}

export function Chip({ label, active, onPress, color, icon, iconValue }: {
  label: string; active?: boolean; onPress?: () => void; color?: string; icon?: IconName; iconValue?: string;
}) {
  // Coloured chips (moods) use a soft tint when active so light colours stay readable.
  const fg = active && !color ? colors.onAccent : colors.text;
  const name = icon ?? (iconValue ? resolveIcon(iconValue) : undefined);
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.chip,
        active && (color
          ? { backgroundColor: tint(color, 0.18), borderColor: color, borderWidth: 1.5 }
          : { backgroundColor: colors.accent, borderColor: colors.accent }),
      ]}
    >
      {name ? <Icon name={name} size={15} color={active && !color ? colors.onAccent : color ?? colors.accent} style={{ marginRight: 6 }} /> : null}
      <Text style={{ color: fg, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Row({ icon, label, value, onPress, danger, toggle, onToggle }: {
  icon?: IconName; label: string; value?: string; onPress?: () => void; danger?: boolean;
  toggle?: boolean; onToggle?: (v: boolean) => void;
}) {
  const tone = danger ? colors.danger : colors.accent;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.bg }]}>
      {icon ? (
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: danger ? colors.dangerSoft : colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Icon name={icon} size={18} color={tone} />
        </View>
      ) : null}
      <Text style={{ flex: 1, color: danger ? colors.danger : colors.text, fontSize: 15, fontWeight: '500' }}>{label}</Text>
      {value ? <Text style={{ color: colors.textFaint, marginRight: 6, fontSize: 14 }}>{value}</Text> : null}
      {onToggle ? (
        <Switch value={!!toggle} onValueChange={onToggle} trackColor={{ true: colors.accent, false: colors.lavender }} thumbColor="#fff" ios_backgroundColor={colors.lavender} />
      ) : onPress ? (
        <Icon name="chevron-right" size={18} color={colors.accentLight} />
      ) : null}
    </Pressable>
  );
}

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 22 }}>
      {title ? <Text style={s.groupTitle}>{title}</Text> : null}
      <View style={s.group}>{children}</View>
    </View>
  );
}

export function Empty({ icon = 'moon', title, sub, children }: { icon?: IconName; title: string; sub?: string; children?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: 40 }}>
      <Glyph value={icon} size={76} style={{ marginBottom: 16 }} />
      <Text style={{ color: colors.heading, fontSize: 19, fontWeight: '700', textAlign: 'center', fontFamily: fonts.display }}>{title}</Text>
      {sub ? <Text style={{ color: colors.textDim, textAlign: 'center', marginTop: 6, lineHeight: 21 }}>{sub}</Text> : null}
      {children ? <View style={{ marginTop: 18, alignSelf: 'stretch' }}>{children}</View> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 40 }}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

export function Badge({ text, color = colors.gold }: { text: string; color?: string }) {
  return (
    <View style={{ backgroundColor: color, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 6 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>{text}</Text>
    </View>
  );
}

/** Round icon button used in headers and composers. */
export function IconBtn({ name, onPress, size = 44, filled, color }: { name: IconName; onPress?: () => void; size?: number; filled?: boolean; color?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
      {filled ? (
        <LinearGradient colors={gradients.primary as unknown as [string, string]} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={name} size={size * 0.45} color="#fff" />
        </LinearGradient>
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={name} size={size * 0.45} color={color ?? colors.accent} />
        </View>
      )}
    </Pressable>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: 20, paddingBottom: 40 },
  title: { color: colors.heading, fontSize: 30, fontFamily: fonts.display, letterSpacing: -0.4 },
  sub: { color: colors.textDim, fontSize: 15, marginTop: 6, lineHeight: 22 },
  btn: { height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  btnSmall: { height: 40, borderRadius: radius.sm, paddingHorizontal: 14 },
  btnText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
  label: { color: colors.textDim, fontSize: 13, marginBottom: 7, fontWeight: '600' },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, fontSize: 16, paddingHorizontal: 15, paddingVertical: 14 },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, ...shadow.soft },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, marginRight: 8, marginBottom: 8, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  groupTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 8, marginLeft: 6 },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadow.soft },
});
