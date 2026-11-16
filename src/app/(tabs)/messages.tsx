// DM inbox (accepted chats) + entry to DM requests
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Avatar, Badge, Card, Empty, Row, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { timeAgo } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { Thread } from '../../lib/types';

export default function Messages() {
  const { profile } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [pending, setPending] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!profile) return;
    supabase.from('my_threads').select('*').order('last_message_at', { ascending: false })
      .then(({ data }) => setThreads((data as Thread[]) ?? []));
    supabase.from('dm_requests').select('id', { count: 'exact', head: true })
      .eq('to_id', profile.id).eq('status', 'pending')
      .then(({ count }) => setPending(count ?? 0));
  }, [profile]));

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={threads}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={
        <View style={{ backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <Row icon="inbox" label="Message requests" value={pending ? `${pending} new` : undefined} onPress={() => router.push('/dm/requests')} />
        </View>
      }
      renderItem={({ item: t }) => (
        <Card onPress={() => router.push({ pathname: '/dm/[id]', params: { id: t.id, name: t.other_name } })}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar emoji={t.other_avatar} premium={t.other_premium} size={46} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T bold>{t.other_name}</T>
                {t.other_premium ? <Badge text="PLUS" /> : null}
              </View>
              <T dim size={13} numberOfLines={1}>{t.last_message ?? 'Say hi'}</T>
            </View>
            <T faint size={12}>{timeAgo(t.last_message_at)}</T>
          </View>
        </Card>
      )}
      ListEmptyComponent={
        <Empty icon="message" title="No private chats yet" sub="Tap someone's name on a post to send a message request. They choose whether to accept." />
      }
    />
  );
}
