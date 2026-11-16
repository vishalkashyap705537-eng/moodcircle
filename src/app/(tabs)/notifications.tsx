// 15. Notifications
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Text } from '../../components/Text';
import { Card, Empty, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { timeAgo } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { Notification } from '../../lib/types';
import { Glyph, type IconName } from '../../components/Icon';

const ICON: Record<string, IconName> = { comment: 'message', reaction: 'heart', dm_request: 'send', dm_accepted: 'hug', moderation: 'shield', premium: 'crown' };

export default function Notifications() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(100);
    setItems((data as Notification[]) ?? []);
  }, [profile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = async (n: Notification) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    if (n.data?.post_id) router.push(`/post/${n.data.post_id}`);
    else if (n.type === 'dm_request') router.push('/dm/requests');
    else if (n.data?.thread_id) router.push(`/dm/${n.data.thread_id}`);
  };

  const readAll = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
    load();
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={items}
      keyExtractor={(n) => n.id}
      ListHeaderComponent={items.some((n) => !n.is_read) ? (
        <Pressable onPress={readAll} style={{ alignSelf: 'flex-end', marginBottom: 10 }}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Mark all as read</Text>
        </Pressable>
      ) : undefined}
      renderItem={({ item: n }) => (
        <Card onPress={() => open(n)} style={!n.is_read ? { borderColor: colors.accent } : undefined}>
          <View style={{ flexDirection: 'row' }}>
            <Glyph value={ICON[n.type] ?? 'bell'} size={42} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <T bold>{n.title}</T>
              {n.body ? <T dim size={13} numberOfLines={2}>{n.body}</T> : null}
              <T faint size={12} style={{ marginTop: 4 }}>{timeAgo(n.created_at)}</T>
            </View>
          </View>
        </Card>
      )}
      ListEmptyComponent={<Empty icon="bell" title="No activity yet" sub="Reactions, comments and message requests will show up here." />}
    />
  );
}
