// 2. Welcome
import { Link, router } from 'expo-router';
import { View } from 'react-native';
import { Text } from '../../components/Text';
import { Btn, Screen, T } from '../../components/ui';
import { colors } from '../../lib/theme';
import { Glyph, Orb } from '../../components/Icon';

const POINTS = [
  ['mask', 'Stay anonymous', 'Only your nickname is ever shown. No real name, number or photo needed.'],
  ['hug', 'Find your people', 'Pick how you feel and join groups of people feeling the same way.'],
  ['shield', 'Safe by design', 'Adults only (18+), strong moderation, and DMs only with your permission.'],
] as const;

export default function Welcome() {
  return (
    <Screen edges={['top', 'bottom']} style={{ flexGrow: 1, justifyContent: 'space-between' }}>
      <View style={{ marginTop: 40 }}>
        <Orb name="moon" size={76} />
        <Text style={{ color: colors.heading, fontSize: 34, fontWeight: '700', marginTop: 22, letterSpacing: -0.6, lineHeight: 40 }}>
          Whatever you feel,{'\n'}someone feels it too.
        </Text>
        <View style={{ marginTop: 32 }}>
          {POINTS.map(([e, t, d]) => (
            <View key={t} style={{ flexDirection: 'row', marginBottom: 20 }}>
              <Glyph value={e} size={44} rounded="square" style={{ marginRight: 14 }} />
              <View style={{ flex: 1 }}>
                <T bold size={16}>{t}</T>
                <T dim>{d}</T>
              </View>
            </View>
          ))}
        </View>
      </View>
      <View>
        <Btn title="Get started" onPress={() => router.push('/age')} />
        <Btn title="I already have an account" kind="ghost" style={{ marginTop: 12 }} onPress={() => router.push('/login')} />
        <T faint size={12} style={{ textAlign: 'center', marginTop: 16 }}>
          By continuing you agree to our <Link href="/legal/terms" style={{ color: colors.accent }}>Terms</Link> and{' '}
          <Link href="/legal/privacy-policy" style={{ color: colors.accent }}>Privacy Policy</Link>.
        </T>
      </View>
    </Screen>
  );
}
