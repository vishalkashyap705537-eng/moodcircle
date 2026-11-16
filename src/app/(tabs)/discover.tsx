// 8. Community discovery
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { Card, Chip, Empty, Field, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { Community } from '../../lib/types';
import { Glyph } from '../../components/Icon';

export default function Discover() {
  const { profile, moods } = useAuth();
  const [mood, setMood] = useState<string | null>(profile?.current_mood ?? null);
  const [q, setQ] = useState('');
  const [list, setList] = useState<Community[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    let query = supabase.from('communities').select('*').eq('is_active', true).order('member_count', { ascending: false }).limit(100);
    if (mood) query = query.eq('mood_id', mood);
    if (q.trim()) query = query.ilike('name', `%${q.trim()}%`);
    const [{ data }, { data: mem }] = await Promise.all([
      query,
      supabase.from('community_members').select('community_id').eq('user_id', profile?.id ?? ''),
    ]);
    setList((data as Community[]) ?? []);
    setJoined(new Set((mem ?? []).map((m) => m.community_id)));
  }, [mood, q, profile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      data={list}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={
        <View>
          <Field placeholder="Search circles" icon="search" value={q} onChangeText={setQ} onSubmitEditing={load} returnKeyType="search" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <Chip label="All moods" active={!mood} onPress={() => setMood(null)} />
            {moods.map((m) => (
              <Chip key={m.id} label={m.label} iconValue={m.emoji} active={mood === m.id} color={m.color} onPress={() => setMood(m.id)} />
            ))}
          </ScrollView>
        </View>
      }
      renderItem={({ item: c }) => {
        const m = moods.find((x) => x.id === c.mood_id);
        return (
          <Card onPress={() => router.push(`/community/${c.id}`)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Glyph value={c.emoji} size={52} rounded="square" color={m?.color ?? colors.accent} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <T bold size={16}>{c.name}</T>
                <T dim size={13} numberOfLines={2}>{c.description}</T>
                <T faint size={12} style={{ marginTop: 4 }}>
                  {m ? `${m.label} · ` : ''}{c.member_count} members{joined.has(c.id) ? ' · Joined' : ''}
                </T>
              </View>
            </View>
          </Card>
        );
      }}
      ListEmptyComponent={<Empty icon="telescope" title="No circles found" sub="Try another mood or search." />}
    />
  );
}
