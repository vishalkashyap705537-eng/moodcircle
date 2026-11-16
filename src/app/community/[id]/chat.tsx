// 10. Group chat (real-time)
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { Text, TextInput } from '../../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, T } from '../../../components/ui';
import { useAuth } from '../../../lib/auth';
import { quickModerate, timeAgo } from '../../../lib/format';
import { errMsg, supabase } from '../../../lib/supabase';
import { colors, radius } from '../../../lib/theme';
import type { ChatMessage } from '../../../lib/types';
import { Icon } from '../../../components/Icon';

export default function GroupChat() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { profile } = useAuth();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('chat_messages').select('*').eq('community_id', id).order('created_at', { ascending: false }).limit(100);
    setMsgs((data as ChatMessage[]) ?? []);
  }, [id]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`room-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `community_id=eq.${id}` }, async (payload) => {
        const { data } = await supabase.from('chat_messages').select('*').eq('id', (payload.new as { id: string }).id).maybeSingle();
        if (data) setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [data as ChatMessage, ...m]));
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
    setSending(true);
    const { error } = await supabase.from('messages').insert({ community_id: id, user_id: profile.id, body });
    setSending(false);
    if (error) return Alert.alert('Not sent', errMsg(error));
    setText('');
    load();
  };

  const onLongPress = (m: ChatMessage) => {
    const mine = m.user_id === profile?.id;
    Alert.alert(m.author_name, undefined, [
      ...(mine
        ? [{ text: 'Delete message', style: 'destructive' as const, onPress: async () => { await supabase.from('messages').delete().eq('id', m.id); load(); } }]
        : [
            { text: 'View profile', onPress: () => router.push(`/user/${m.user_id}`) },
            { text: 'Report message', style: 'destructive' as const, onPress: () => router.push({ pathname: '/report', params: { type: 'message', id: m.id } }) },
          ]),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <Stack.Screen options={{ title: name ?? 'Group chat' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          inverted
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12 }}
          ListFooterComponent={
            <View style={{ backgroundColor: colors.surface, padding: 12, borderRadius: radius.md, marginBottom: 12 }}>
              <Icon name="shield" size={18} color={colors.accent} style={{ alignSelf: 'center', marginBottom: 6 }} />
              <T dim size={13} style={{ textAlign: 'center' }}>
                Be kind. No sharing phone numbers, addresses or social handles. Long-press a message to report it.
              </T>
            </View>
          }
          renderItem={({ item: m }) => {
            const mine = m.user_id === profile?.id;
            return (
              <Pressable onLongPress={() => onLongPress(m)} style={{ flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-end', marginBottom: 10 }}>
                {!mine ? <Avatar emoji={m.author_avatar} size={30} premium={m.author_premium} /> : null}
                <View style={{ maxWidth: '78%', marginHorizontal: 8, backgroundColor: mine ? colors.accent : colors.surface, borderWidth: mine ? 0 : 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }}>
                  {!mine ? <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700', marginBottom: 2 }}>{m.author_name}</Text> : null}
                  <Text style={{ color: mine ? '#fff' : colors.text, fontSize: 15, lineHeight: 21 }}>{m.body}</Text>
                  <Text style={{ color: mine ? 'rgba(255,255,255,0.75)' : colors.textFaint, fontSize: 10, marginTop: 2, alignSelf: 'flex-end' }}>{timeAgo(m.created_at)}</Text>
                </View>
              </Pressable>
            );
          }}
        />
        <View style={{ flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, alignItems: 'flex-end' }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Say something kind…"
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={1000}
            style={{ flex: 1, color: colors.text, backgroundColor: colors.bg, borderRadius: 22, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, maxHeight: 120, fontSize: 15 }}
          />
          <Pressable onPress={send} disabled={sending || !text.trim()} style={{ marginLeft: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? colors.accent : colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="send" size={19} color={text.trim() ? '#fff' : colors.textFaint} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
