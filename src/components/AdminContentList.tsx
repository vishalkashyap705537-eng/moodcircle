// Shared list for Admin → Posts / Comments / Moderation queue
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { moderateUser, setHidden } from '../lib/admin';
import { timeAgo } from '../lib/format';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { Badge, Btn, Card, Chip, Empty, T } from './ui';

type Item = {
  id: string; body: string; created_at: string; is_hidden: boolean; is_flagged: boolean; is_anonymous?: boolean;
  author: { id: string; username: string } | null;
};

const CONF = {
  post: { table: 'posts', select: 'id, body, created_at, is_hidden, is_flagged, is_anonymous, author:profiles!posts_author_id_fkey(id, username)' },
  comment: { table: 'comments', select: 'id, body, created_at, is_hidden, is_flagged, is_anonymous, author:profiles!comments_author_id_fkey(id, username)' },
  message: { table: 'messages', select: 'id, body, created_at, is_hidden, is_flagged, author:profiles!messages_user_id_fkey(id, username)' },
} as const;

export function AdminContentList({ type, flaggedOnly }: { type: keyof typeof CONF; flaggedOnly?: boolean }) {
  const [filter, setFilter] = useState<'all' | 'flagged' | 'hidden'>(flaggedOnly ? 'flagged' : 'all');
  const [items, setItems] = useState<Item[]>([]);

  const load = useCallback(async () => {
    const c = CONF[type];
    let q = supabase.from(c.table).select(c.select).order('created_at', { ascending: false }).limit(100);
    if (filter === 'flagged') q = q.eq('is_flagged', true).eq('is_hidden', false);
    if (filter === 'hidden') q = q.eq('is_hidden', true);
    const { data } = await q;
    setItems((data as unknown as Item[]) ?? []);
  }, [type, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const del = (i: Item) => Alert.alert('Delete permanently?', undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from(CONF[type].table).delete().eq('id', i.id); load(); } },
  ]);

  const approve = async (i: Item) => {
    await supabase.from(CONF[type].table).update({ is_flagged: false }).eq('id', i.id);
    load();
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={items}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={flaggedOnly ? undefined : (
        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
          {(['all', 'flagged', 'hidden'] as const).map((f) => <Chip key={f} label={f[0].toUpperCase() + f.slice(1)} active={filter === f} onPress={() => setFilter(f)} />)}
        </View>
      )}
      renderItem={({ item: i }) => (
        <Card style={i.is_hidden ? { opacity: 0.6 } : i.is_flagged ? { borderColor: colors.danger } : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
            <T bold size={13}>{i.author?.username ?? 'deleted'}</T>
            {i.is_anonymous ? <Badge text="POSTED ANON" color={colors.textDim} /> : null}
            {i.is_flagged ? <Badge text="FLAGGED" color={colors.danger} /> : null}
            {i.is_hidden ? <Badge text="HIDDEN" color={colors.textFaint} /> : null}
            <T faint size={12} style={{ marginLeft: 'auto' }}>{timeAgo(i.created_at)}</T>
          </View>
          <T size={14}>{i.body}</T>
          <View style={{ flexDirection: 'row', marginTop: 10, flexWrap: 'wrap', gap: 6 }}>
            {i.is_flagged && !i.is_hidden ? <Btn small title="Approve" onPress={() => approve(i)} /> : null}
            <Btn small kind="secondary" title={i.is_hidden ? 'Unhide' : 'Hide'} onPress={async () => { await setHidden(type, i.id, !i.is_hidden); load(); }} />
            {i.author ? <Btn small kind="secondary" title="User…" onPress={() => moderateUser(i.author!.id, i.author!.username, load)} /> : null}
            <Btn small kind="danger" title="Delete" onPress={() => del(i)} />
          </View>
        </Card>
      )}
      ListEmptyComponent={<Empty icon="check-circle" title="Nothing here" />}
    />
  );
}
