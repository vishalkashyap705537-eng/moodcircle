// Admin 8. Banned / suspended users
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Avatar, Badge, Btn, Card, Empty, T } from '../../components/ui';
import { setUserStatus } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { Profile } from '../../lib/types';

export default function Banned() {
  const [items, setItems] = useState<Profile[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').neq('status', 'active').order('created_at', { ascending: false });
    setItems((data as Profile[]) ?? []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={items}
      keyExtractor={(u) => u.id}
      renderItem={({ item: u }) => (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar emoji={u.avatar} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T bold>{u.username}</T>
                <Badge text={u.status.toUpperCase()} color={colors.danger} />
              </View>
              {u.suspended_until ? <T faint size={12}>Until {new Date(u.suspended_until).toLocaleString()}</T> : null}
            </View>
            <Btn small kind="secondary" title="Restore" onPress={async () => { await setUserStatus(u.id, 'active'); load(); }} />
          </View>
        </Card>
      )}
      ListEmptyComponent={<Empty icon="bird" title="No banned or suspended users" />}
    />
  );
}
