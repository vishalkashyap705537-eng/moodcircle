// 16. DM requests
import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { Avatar, Btn, Card, Chip, Empty, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { timeAgo } from '../../lib/format';
import { errMsg, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

type Req = {
  id: string; message: string; status: string; created_at: string;
  from: { id: string; username: string; avatar: string } | null;
  to: { id: string; username: string; avatar: string } | null;
};

export default function DMRequests() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'in' | 'out'>('in');
  const [items, setItems] = useState<Req[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    const col = tab === 'in' ? 'to_id' : 'from_id';
    const { data } = await supabase.from('dm_requests')
      .select('id, message, status, created_at, from:profiles!dm_requests_from_id_fkey(id, username, avatar), to:profiles!dm_requests_to_id_fkey(id, username, avatar)')
      .eq(col, profile.id).order('created_at', { ascending: false }).limit(50);
    setItems((data as unknown as Req[]) ?? []);
  }, [profile, tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const respond = async (r: Req, accept: boolean) => {
    const { data, error } = await supabase.rpc('respond_dm_request', { p_id: r.id, p_accept: accept });
    if (error) return Alert.alert('Error', errMsg(error));
    if (accept && data) router.push({ pathname: '/dm/[id]', params: { id: data as string, name: r.from?.username ?? '' } });
    else load();
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={items}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <Stack.Screen options={{ title: 'Message requests' }} />
          <Chip label="Received" active={tab === 'in'} onPress={() => setTab('in')} />
          <Chip label="Sent" active={tab === 'out'} onPress={() => setTab('out')} />
        </View>
      }
      renderItem={({ item: r }) => {
        const other = tab === 'in' ? r.from : r.to;
        return (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar emoji={other?.avatar ?? 'moon'} size={44} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <T bold>{other?.username ?? 'Unknown'}</T>
                <T faint size={12}>{timeAgo(r.created_at)} · {r.status}</T>
              </View>
              {other ? <Btn small kind="ghost" title="Profile" onPress={() => router.push(`/user/${other.id}`)} /> : null}
            </View>
            {r.message ? <T dim style={{ marginTop: 10 }}>"{r.message}"</T> : null}
            {tab === 'in' && r.status === 'pending' ? (
              <View style={{ flexDirection: 'row', marginTop: 12 }}>
                <Btn small title="Accept" style={{ flex: 1 }} onPress={() => respond(r, true)} />
                <View style={{ width: 8 }} />
                <Btn small kind="secondary" title="Decline" style={{ flex: 1 }} onPress={() => respond(r, false)} />
              </View>
            ) : null}
          </Card>
        );
      }}
      ListEmptyComponent={<Empty icon="inbox" title={tab === 'in' ? 'No requests' : 'No sent requests'} sub="Nobody can message you privately unless you accept their request." />}
    />
  );
}
