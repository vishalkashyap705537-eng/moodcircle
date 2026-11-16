// 22. Blocked users
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Avatar, Btn, Card, Empty, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

type B = { blocked_id: string; profiles: { username: string; avatar: string } | null };

export default function Blocked() {
  const { profile } = useAuth();
  const [items, setItems] = useState<B[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('blocks').select('blocked_id, profiles!blocks_blocked_id_fkey(username, avatar)').eq('blocker_id', profile.id);
    setItems((data as unknown as B[]) ?? []);
  }, [profile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unblock = async (id: string) => {
    await supabase.from('blocks').delete().eq('blocker_id', profile!.id).eq('blocked_id', id);
    load();
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={items}
      keyExtractor={(b) => b.blocked_id}
      renderItem={({ item: b }) => (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar emoji={b.profiles?.avatar ?? 'moon'} />
            <T bold style={{ flex: 1, marginLeft: 12 }}>{b.profiles?.username ?? 'User'}</T>
            <Btn small kind="secondary" title="Unblock" onPress={() => unblock(b.blocked_id)} />
          </View>
        </Card>
      )}
      ListEmptyComponent={<Empty icon="bird" title="No blocked users" sub="Blocked people can't message you or see your posts." />}
    />
  );
}
