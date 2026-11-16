// 11. Create post  +  12. Anonymous post option
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { Glyph } from '../../components/Icon';
import { Btn, Card, Chip, Field, Screen, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { quickModerate } from '../../lib/format';
import { errMsg, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { Community } from '../../lib/types';

export default function CreatePost() {
  const { community } = useLocalSearchParams<{ community?: string }>();
  const { profile } = useAuth();
  const [mine, setMine] = useState<Community[]>([]);
  const [target, setTarget] = useState<string | null>(community ?? null);
  const [body, setBody] = useState('');
  const [anon, setAnon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase.from('community_members').select('communities(*)').eq('user_id', profile.id).then(({ data }) => {
      const cs = ((data ?? []).map((m) => m.communities).filter(Boolean) as unknown as Community[]);
      setMine(cs);
      if (!target && cs[0]) setTarget(cs[0].id);
    });
  }, [profile, target]);

  const submit = async () => {
    if (!profile || !target) return;
    const text = body.trim();
    if (!text) return setError('Write something first');
    const warn = quickModerate(text);
    if (warn) return setError(warn);
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.from('posts')
      .insert({ community_id: target, author_id: profile.id, body: text, is_anonymous: anon, mood_id: profile.current_mood })
      .select('id').single();
    setBusy(false);
    if (e) return setError(errMsg(e));
    router.replace(`/post/${data.id}`);
  };

  return (
    <Screen>
      <T dim size={13} bold style={{ marginBottom: 8 }}>POST IN</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        {mine.map((c) => <Chip key={c.id} label={c.name} iconValue={c.emoji} active={target === c.id} onPress={() => setTarget(c.id)} />)}
      </ScrollView>
      <Field
        multiline
        autoFocus
        placeholder="What's on your mind? Share as much or as little as you want…"
        value={body}
        onChangeText={setBody}
        maxLength={2000}
      />
      <T faint size={12} style={{ alignSelf: 'flex-end', marginTop: -8, marginBottom: 12 }}>{body.length}/2000</T>

      <Card style={anon ? { borderColor: colors.accent } : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Glyph value="mask" size={46} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <T bold>Post anonymously</T>
            <T dim size={13}>
              {anon
                ? 'Your nickname and avatar are hidden. Others see "Anonymous". Only you can see it was yours.'
                : `Posting as ${profile?.username}`}
            </T>
          </View>
          <Switch value={anon} onValueChange={setAnon} trackColor={{ true: colors.accent, false: colors.lavender }} thumbColor="#fff" />
        </View>
      </Card>

      {error ? <T style={{ color: colors.danger, marginBottom: 12 }}>{error}</T> : null}
      <Btn title={anon ? 'Post anonymously' : 'Post'} loading={busy} disabled={!target || !body.trim()} onPress={submit} />
      <T faint size={12} style={{ textAlign: 'center', marginTop: 12 }}>
        If you're in crisis or thinking about harming yourself, please see Help & Safety for helplines.
      </T>
    </Screen>
  );
}
