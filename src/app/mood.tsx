// 6. Mood selection  →  recommended communities  →  join
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../components/Text';
import { Glyph, Icon } from '../components/Icon';
import { Btn, Card, Screen, T, Title } from '../components/ui';
import { useAuth } from '../lib/auth';
import { errMsg, supabase } from '../lib/supabase';
import { colors, radius, shadow, tint } from '../lib/theme';
import type { Community } from '../lib/types';

export default function MoodSelect() {
  const { profile, moods, refreshProfile } = useAuth();
  const [picked, setPicked] = useState<string | null>(null);
  const [step, setStep] = useState<'mood' | 'communities'>('mood');
  const [list, setList] = useState<Community[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase.from('community_members').select('community_id').eq('user_id', profile.id)
      .then(({ data }) => setJoined(new Set((data ?? []).map((r) => r.community_id))));
  }, [profile]);

  const confirmMood = async () => {
    if (!picked || !profile) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.from('profiles').update({ current_mood: picked }).eq('id', profile.id);
    if (e) {
      setBusy(false);
      return setError(errMsg(e));
    }
    const { data } = await supabase.from('communities').select('*').eq('mood_id', picked).eq('is_active', true).order('member_count', { ascending: false });
    setList((data as Community[]) ?? []);
    setBusy(false);
    setStep('communities');
  };

  const toggleJoin = async (c: Community) => {
    if (!profile) return;
    const next = new Set(joined);
    if (joined.has(c.id)) {
      await supabase.from('community_members').delete().eq('community_id', c.id).eq('user_id', profile.id);
      next.delete(c.id);
    } else {
      const { error: e } = await supabase.from('community_members').insert({ community_id: c.id, user_id: profile.id });
      if (e) return setError(errMsg(e));
      next.add(c.id);
    }
    setJoined(next);
  };

  const finish = async () => {
    await refreshProfile();
    router.replace('/home');
  };

  if (step === 'communities') {
    const mood = moods.find((m) => m.id === picked);
    return (
      <Screen>
        <Title sub={`People feeling ${mood?.label.toLowerCase()} right now. Join one or more — it's free.`}>
          Your circles
        </Title>
        {list.map((c) => (
          <Card key={c.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Glyph value={c.emoji} size={52} rounded="square" color={mood?.color} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <T bold size={16}>{c.name}</T>
                <T dim size={13}>{c.description}</T>
                <T faint size={12} style={{ marginTop: 4 }}>{c.member_count} members</T>
              </View>
            </View>
            <Btn small title={joined.has(c.id) ? 'Joined' : 'Join'} icon={joined.has(c.id) ? 'check' : 'plus'} kind={joined.has(c.id) ? 'secondary' : 'primary'} style={{ marginTop: 12 }} onPress={() => toggleJoin(c)} />
          </Card>
        ))}
        {list.length === 0 ? <T dim>No circles for this mood yet — explore others from Discover.</T> : null}
        {error ? <T style={{ color: colors.danger, marginVertical: 8 }}>{error}</T> : null}
        <Btn title="Continue" style={{ marginTop: 8 }} onPress={finish} />
        <Btn title="Pick a different mood" kind="ghost" style={{ marginTop: 10 }} onPress={() => setStep('mood')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <T dim style={{ marginBottom: 16 }}>Be honest — there's no wrong answer. You can change it any time.</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {moods.map((m) => {
          const active = picked === m.id || (!picked && profile?.current_mood === m.id);
          return (
            <Pressable
              key={m.id}
              onPress={() => setPicked(m.id)}
              style={({ pressed }) => ({
                width: '48%', marginBottom: 12, padding: 18, borderRadius: radius.lg,
                backgroundColor: active ? tint(m.color, 0.14) : colors.surface,
                borderWidth: 1.5, borderColor: active ? m.color : colors.border,
                opacity: pressed ? 0.85 : 1,
                ...shadow.soft,
              })}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Glyph value={m.emoji} moodId={m.id} size={46} color={m.color} bg={active ? '#FFFFFF' : tint(m.color, 0.12)} />
                {active ? <Icon name="check-circle" size={20} color={m.color} /> : null}
              </View>
              <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '700', color: colors.text }}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <T style={{ color: colors.danger, marginVertical: 8 }}>{error}</T> : null}
      <Btn title="Find my people" disabled={!picked} loading={busy} style={{ marginTop: 8 }} onPress={confirmMood} />
    </Screen>
  );
}
