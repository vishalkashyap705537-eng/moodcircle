// Admin 9. Premium / subscriptions
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Badge, Card, Empty, T } from '../../components/ui';
import { timeAgo } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

type S = { user_id: string; product_id: string | null; store: string | null; status: string; expires_at: string | null; updated_at: string; profiles: { username: string } | null };

export default function Subs() {
  const [items, setItems] = useState<S[]>([]);
  useFocusEffect(useCallback(() => {
    supabase.from('subscriptions').select('*, profiles(username)').order('updated_at', { ascending: false }).limit(200)
      .then(({ data }) => setItems((data as unknown as S[]) ?? []));
  }, []));

  const active = items.filter((s) => s.status === 'active').length;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={items}
      keyExtractor={(s) => s.user_id}
      ListHeaderComponent={
        <Card>
          <T faint size={12}>Active subscriptions</T>
          <T bold size={28}>{active}</T>
          <T dim size={12}>Revenue & refunds: see the Razorpay and PayPal dashboards (and RevenueCat / Google Play Console / App Store Connect for store subscriptions).</T>
        </Card>
      }
      renderItem={({ item: s }) => (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T bold style={{ flex: 1 }}>{s.profiles?.username ?? s.user_id.slice(0, 8)}</T>
            <Badge text={s.status.toUpperCase()} color={s.status === 'active' ? colors.success : colors.textFaint} />
          </View>
          <T faint size={12}>
            {s.product_id ?? '—'} · {s.store ?? '—'}{s.expires_at ? ` · expires ${new Date(s.expires_at).toLocaleDateString()}` : ''} · updated {timeAgo(s.updated_at)}
          </T>
        </Card>
      )}
      ListEmptyComponent={<Empty icon="star" title="No subscriptions yet" />}
    />
  );
}
