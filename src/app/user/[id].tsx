// Public profile of another user — only nickname, avatar, optional mood & circles
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Text } from '../../components/Text';
import { Avatar, Badge, Btn, Card, Chip, Empty, Field, Loading, Screen, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errMsg, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { Community, Profile } from '../../lib/types';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: me, moods } = useAuth();
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [state, setState] = useState<'none' | 'pending' | 'chat'>('none');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!me) return;
    const { data } = await supabase.from('profiles')
      .select('id, username, avatar, bio, current_mood, show_mood, show_communities, allow_dm_requests, is_premium, status, created_at')
      .eq('id', id).maybeSingle();
    setP((data as Profile) ?? null);
    if (data?.show_communities) {
      const { data: cm } = await supabase.from('community_members').select('communities(*)').eq('user_id', id);
      setCommunities(((cm ?? []).map((m) => m.communities).filter(Boolean) as unknown as Community[]));
    }
    const [{ data: b }, { data: th }, { data: rq }] = await Promise.all([
      supabase.from('blocks').select('blocked_id').eq('blocker_id', me.id).eq('blocked_id', id).maybeSingle(),
      supabase.from('my_threads').select('id').eq('other_id', id).maybeSingle(),
      supabase.from('dm_requests').select('id').eq('from_id', me.id).eq('to_id', id).eq('status', 'pending').maybeSingle(),
    ]);
    setBlocked(!!b);
    setThreadId(th?.id ?? null);
    setState(th ? 'chat' : rq ? 'pending' : 'none');
  }, [id, me]);

  useEffect(() => { load(); }, [load]);

  const sendRequest = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('send_dm_request', { p_to: id, p_message: note.trim() });
    setBusy(false);
    if (error) {
      const msg = errMsg(error);
      if (msg.includes('Premium')) {
        Alert.alert('Daily limit reached', msg, [
          { text: 'Not now', style: 'cancel' },
          { text: 'See Premium', onPress: () => router.push('/premium') },
        ]);
      } else Alert.alert('Could not send', msg);
      return;
    }
    setComposing(false);
    setState('pending');
  };

  const toggleBlock = async () => {
    if (!me) return;
    if (blocked) {
      await supabase.from('blocks').delete().eq('blocker_id', me.id).eq('blocked_id', id);
      setBlocked(false);
      return;
    }
    Alert.alert(`Block ${p?.username}?`, 'They won’t be able to message you, and you won’t see each other’s posts, comments or chat messages.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: async () => {
        await supabase.from('blocks').insert({ blocker_id: me.id, blocked_id: id });
        setBlocked(true);
      } },
    ]);
  };

  if (p === undefined || !me) return <Loading />;
  if (p === null || p.status === 'banned') return <Empty icon="eye-off" title="User not available" />;
  if (p.id === me.id) {
    router.replace('/profile');
    return null;
  }
  const mood = p.show_mood ? moods.find((m) => m.id === p.current_mood) : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: p.username }} />
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Avatar emoji={p.avatar} size={88} premium={p.is_premium} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <Text style={{ color: colors.heading, fontSize: 26, fontWeight: '700' }}>{p.username}</Text>
          {p.is_premium ? <Badge text="PLUS" /> : null}
        </View>
        {mood ? <T dim style={{ marginTop: 4 }}>Feeling {mood.label.toLowerCase()}</T> : null}
        {p.bio ? <T style={{ textAlign: 'center', marginTop: 8 }}>{p.bio}</T> : null}
      </View>

      {blocked ? (
        <Card><T dim>You've blocked this user.</T></Card>
      ) : state === 'chat' ? (
        <Btn title="Open chat" icon="message" onPress={() => router.push({ pathname: '/dm/[id]', params: { id: threadId!, name: p.username } })} />
      ) : state === 'pending' ? (
        <Btn title="Request sent" icon="hourglass" kind="secondary" disabled />
      ) : !p.allow_dm_requests ? (
        <Card><T dim>{p.username} isn't accepting message requests right now.</T></Card>
      ) : composing ? (
        <Card>
          <Field label="Add a short note (optional)" placeholder="Hey, your post really hit home…" value={note} onChangeText={setNote} maxLength={200} multiline />
          <Btn title="Send request" loading={busy} onPress={sendRequest} />
          <T faint size={12} style={{ marginTop: 8, textAlign: 'center' }}>They can accept or decline. Free accounts can send 3 requests a day.</T>
        </Card>
      ) : (
        <Btn title="Send message request" icon="send" onPress={() => setComposing(true)} />
      )}

      {p.show_communities && communities.length ? (
        <View style={{ marginTop: 24 }}>
          <T bold size={16} style={{ marginBottom: 10 }}>Circles</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {communities.map((c) => <Chip key={c.id} label={c.name} iconValue={c.emoji} onPress={() => router.push(`/community/${c.id}`)} />)}
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: 28 }}>
        <Btn small kind="ghost" title={blocked ? 'Unblock' : 'Block'} icon="ban" onPress={toggleBlock} />
        <Btn small kind="ghost" title="Report user" icon="flag" style={{ marginTop: 8 }} onPress={() => router.push({ pathname: '/report', params: { type: 'user', id: p.id } })} />
      </View>
    </Screen>
  );
}
