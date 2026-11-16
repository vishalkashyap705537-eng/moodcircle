// 17. DM chat (real-time, private)
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { Text, TextInput } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { quickModerate, timeAgo } from '../../lib/format';
import { errMsg, supabase } from '../../lib/supabase';
import { colors, radius } from '../../lib/theme';
import { Icon } from '../../components/Icon';

type Msg = { id: string; sender_id: string; body: string; created_at: string };

export default function DMChat() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { profile } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [other, setOther] = useState<{ id: string; name: string } | null>(null);
  const [text, setText] = useState('');

  const load = useCallback(async () => {
    const [{ data }, { data: t }] = await Promise.all([
      supabase.from('dm_messages').select('id, sender_id, body, created_at').eq('thread_id', id).order('created_at', { ascending: false }).limit(200),
      supabase.from('my_threads').select('other_id, other_name').eq('id', id).maybeSingle(),
    ]);
    setMsgs((data as Msg[]) ?? []);
    if (t) setOther({ id: t.other_id, name: t.other_name });
  }, [id]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`dm-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `thread_id=eq.${id}` }, (payload) => {
        const m = payload.new as Msg;
        setMsgs((xs) => (xs.some((x) => x.id === m.id) ? xs : [m, ...xs]));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, load]);

  const send = async () => {
    const body = text.trim();
    if (!body || !profile) return;
    const warn = quickModerate(body);
    if (warn) return Alert.alert('Hold on', warn);
    setText('');
    const { data, error } = await supabase.from('dm_messages').insert({ thread_id: id, sender_id: profile.id, body }).select('id, sender_id, body, created_at').single();
    if (error) {
      setText(body);
      return Alert.alert('Not sent', errMsg(error));
    }
    setMsgs((xs) => (xs.some((x) => x.id === data.id) ? xs : [data as Msg, ...xs]));
  };

  const menu = () => {
    if (!other) return;
    Alert.alert(other.name, undefined, [
      { text: 'View profile', onPress: () => router.push(`/user/${other.id}`) },
      { text: 'Report conversation', onPress: () => router.push({ pathname: '/report', params: { type: 'dm', id } }) },
      { text: 'Block user', style: 'destructive', onPress: async () => {
        await supabase.from('blocks').insert({ blocker_id: profile!.id, blocked_id: other.id });
        router.back();
      } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <Stack.Screen options={{
        title: other?.name ?? name ?? 'Chat',
        headerRight: () => <Pressable onPress={menu} hitSlop={12}><Icon name="more" size={22} color={colors.accent} /></Pressable>,
      }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          inverted
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12 }}
          ListFooterComponent={
            <View style={{ backgroundColor: colors.surface, padding: 12, borderRadius: radius.md, marginBottom: 12 }}>
              <Icon name="lock" size={18} color={colors.accent} style={{ alignSelf: 'center', marginBottom: 6 }} />
              <T dim size={13} style={{ textAlign: 'center' }}>
                Private chat. Never share passwords, money, your address or photos you wouldn't want shared. Block or report anytime from the menu (top right).
              </T>
            </View>
          }
          renderItem={({ item: m }) => {
            const mine = m.sender_id === profile?.id;
            return (
              <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', marginBottom: 8, backgroundColor: mine ? colors.accent : colors.surface, borderWidth: mine ? 0 : 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ color: mine ? '#fff' : colors.text, fontSize: 15, lineHeight: 21 }}>{m.body}</Text>
                <Text style={{ color: mine ? 'rgba(255,255,255,0.75)' : colors.textFaint, fontSize: 10, marginTop: 2, alignSelf: 'flex-end' }}>{timeAgo(m.created_at)}</Text>
              </View>
            );
          }}
        />
        <View style={{ flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, alignItems: 'flex-end' }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message…"
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={2000}
            style={{ flex: 1, color: colors.text, backgroundColor: colors.bg, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120, fontSize: 15 }}
          />
          <Pressable onPress={send} disabled={!text.trim()} style={{ marginLeft: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? colors.accent : colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="send" size={19} color={text.trim() ? '#fff' : colors.textFaint} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
