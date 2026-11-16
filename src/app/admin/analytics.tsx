// Admin 10. Analytics
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../components/Text';
import { Card, Loading, Screen, T } from '../../components/ui';
import { loadStats, type Stats } from '../../lib/admin';
import { useAuth } from '../../lib/auth';
import { colors } from '../../lib/theme';

function Bars({ title, values, labels, color }: { title: string; values: number[]; labels: string[]; color: string }) {
  const max = Math.max(1, ...values);
  return (
    <Card>
      <T bold style={{ marginBottom: 10 }}>{title}</T>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120 }}>
        {values.map((v, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: colors.textFaint, fontSize: 9 }}>{v || ''}</Text>
            <View style={{ width: '70%', height: Math.max(2, (v / max) * 100), backgroundColor: color, borderRadius: 3 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {labels.map((l, i) => (
          <Text key={i} style={{ flex: 1, color: colors.textFaint, fontSize: 9, textAlign: 'center' }}>{i % 2 === 0 ? l : ''}</Text>
        ))}
      </View>
    </Card>
  );
}

export default function Analytics() {
  const { moods } = useAuth();
  const [s, setS] = useState<Stats | null>(null);
  useFocusEffect(useCallback(() => { loadStats().then(setS); }, []));
  if (!s) return <Loading />;

  const daily = s.daily ?? [];
  const labels = daily.map((d) => d.day.slice(8, 10));
  const totalMood = (s.moods ?? []).reduce((a, m) => a + m.n, 0) || 1;

  return (
    <Screen>
      <T dim style={{ marginBottom: 12 }}>Last 14 days</T>
      <Bars title="New sign-ups" values={daily.map((d) => d.signups)} labels={labels} color={colors.accent} />
      <Bars title="Posts" values={daily.map((d) => d.posts)} labels={labels} color={colors.success} />
      <Bars title="Group chat messages" values={daily.map((d) => d.messages)} labels={labels} color={colors.gold} />
      <Card>
        <T bold style={{ marginBottom: 10 }}>How users feel right now</T>
        {(s.moods ?? []).map((m) => {
          const mood = moods.find((x) => x.id === m.mood);
          const pct = Math.round((m.n / totalMood) * 100);
          return (
            <View key={m.mood} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row' }}>
                <T size={13} style={{ flex: 1 }}>{mood?.label ?? m.mood}</T>
                <T faint size={12}>{m.n} · {pct}%</T>
              </View>
              <View style={{ height: 6, backgroundColor: colors.surface2, borderRadius: 3, marginTop: 4 }}>
                <View style={{ width: `${pct}%`, height: 6, backgroundColor: mood?.color ?? colors.accent, borderRadius: 3 }} />
              </View>
            </View>
          );
        })}
      </Card>
      <Card>
        <T dim size={13}>
          Users {s.users} · Premium {s.premium} ({Math.round((s.premium / Math.max(1, s.users)) * 100)}%) · Posts {s.posts} · Comments {s.comments}
        </T>
      </Card>
    </Screen>
  );
}
