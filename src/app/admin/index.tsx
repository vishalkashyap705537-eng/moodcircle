// Admin 1. Dashboard
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Card, Group, Row, Screen, T } from '../../components/ui';
import { loadStats, type Stats } from '../../lib/admin';
import { colors } from '../../lib/theme';

function Stat({ label, value, alert }: { label: string; value: number | undefined; alert?: boolean }) {
  return (
    <Card style={{ width: '48%', borderColor: alert && value ? colors.danger : colors.border }}>
      <T faint size={12}>{label}</T>
      <T bold size={26} style={{ color: alert && value ? colors.danger : colors.text }}>{value ?? '–'}</T>
    </Card>
  );
}

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  useFocusEffect(useCallback(() => { loadStats().then(setS); }, []));

  return (
    <Screen>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Stat label="Total users" value={s?.users} />
        <Stat label="New users (7d)" value={s?.new_users_7d} />
        <Stat label="Open reports" value={s?.open_reports} alert />
        <Stat label="Flagged content" value={s?.flagged} alert />
        <Stat label="Premium users" value={s?.premium} />
        <Stat label="Posts (7d)" value={s?.posts_7d} />
      </View>
      <Group title="Manage">
        <Row icon="users" label="Users" value={String(s?.users ?? '')} onPress={() => router.push('/admin/users')} />
        <Row icon="community" label="Communities" value={String(s?.communities ?? '')} onPress={() => router.push('/admin/communities')} />
        <Row icon="file" label="Posts" value={String(s?.posts ?? '')} onPress={() => router.push('/admin/posts')} />
        <Row icon="message" label="Comments" value={String(s?.comments ?? '')} onPress={() => router.push('/admin/comments')} />
      </Group>
      <Group title="Safety">
        <Row icon="flag" label="Reports" value={s?.open_reports ? `${s.open_reports} open` : undefined} onPress={() => router.push('/admin/reports')} />
        <Row icon="shield" label="Moderation queue" value={s?.flagged ? `${s.flagged} flagged` : undefined} onPress={() => router.push('/admin/moderation')} />
        <Row icon="octagon" label="Banned / suspended users" value={String(s?.banned ?? '')} onPress={() => router.push('/admin/banned')} />
      </Group>
      <Group title="Business">
        <Row icon="star" label="Premium / subscriptions" onPress={() => router.push('/admin/subscriptions')} />
        <Row icon="chart" label="Analytics" onPress={() => router.push('/admin/analytics')} />
      </Group>
    </Screen>
  );
}
