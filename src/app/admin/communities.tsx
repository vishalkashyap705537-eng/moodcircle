// Admin 3. Communities
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, View } from 'react-native';
import { COMMUNITY_ICONS, Glyph } from '../../components/Icon';
import { Btn, Card, Chip, Field, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errMsg, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { Community } from '../../lib/types';

// `emoji` column now stores an icon key (legacy emoji values still display correctly)
const blank = { id: '', name: '', description: '', emoji: 'message', mood_id: '' };

export default function Communities() {
  const { moods } = useAuth();
  const [items, setItems] = useState<Community[]>([]);
  const [form, setForm] = useState<typeof blank | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('communities').select('*').order('created_at', { ascending: false });
    setItems((data as Community[]) ?? []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (!form) return;
    if (form.name.trim().length < 3 || !form.mood_id) return Alert.alert('Missing info', 'Name (3+ chars) and mood are required.');
    const row = { name: form.name.trim(), description: form.description.trim(), emoji: form.emoji || 'message', mood_id: form.mood_id };
    const { error } = form.id
      ? await supabase.from('communities').update(row).eq('id', form.id)
      : await supabase.from('communities').insert(row);
    if (error) return Alert.alert('Error', errMsg(error));
    setForm(null);
    load();
  };

  const toggleActive = async (c: Community) => {
    await supabase.from('communities').update({ is_active: !c.is_active }).eq('id', c.id);
    load();
  };

  const remove = (c: Community) => {
    Alert.alert(`Delete ${c.name}?`, 'All posts and chat messages in it will be deleted permanently.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('communities').delete().eq('id', c.id); load(); } },
    ]);
  };

  if (form) {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
        <T bold size={20} style={{ marginBottom: 14 }}>{form.id ? 'Edit community' : 'New community'}</T>
        <T dim size={13} bold style={{ marginBottom: 8 }}>ICON</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }}>
          {COMMUNITY_ICONS.map((ic) => (
            <Pressable key={ic} onPress={() => setForm({ ...form, emoji: ic })} style={{ margin: 4, borderRadius: 16, borderWidth: 2, borderColor: form.emoji === ic ? colors.accent : 'transparent' }}>
              <Glyph value={ic} size={44} rounded="square" />
            </Pressable>
          ))}
        </View>
        <Field label="Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} maxLength={40} />
        <Field label="Description" multiline value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} />
        <T dim size={13} bold style={{ marginBottom: 8 }}>MOOD</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
          {moods.map((m) => <Chip key={m.id} label={m.label} iconValue={m.emoji} color={m.color} active={form.mood_id === m.id} onPress={() => setForm({ ...form, mood_id: m.id })} />)}
        </View>
        <Btn title="Save" onPress={save} />
        <Btn title="Cancel" kind="ghost" style={{ marginTop: 10 }} onPress={() => setForm(null)} />
      </ScrollView>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={items}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={<Btn title="New community" icon="plus" onPress={() => setForm({ ...blank, mood_id: moods[0]?.id ?? '' })} style={{ marginBottom: 14 }} />}
      renderItem={({ item: c }) => (
        <Card style={!c.is_active ? { opacity: 0.6 } : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Glyph value={c.emoji} size={44} rounded="square" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <T bold>{c.name}{!c.is_active ? ' (hidden)' : ''}</T>
              <T faint size={12}>{moods.find((m) => m.id === c.mood_id)?.label} · {c.member_count} members</T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <Btn small kind="secondary" title="Edit" style={{ flex: 1 }} onPress={() => setForm({ id: c.id, name: c.name, description: c.description, emoji: c.emoji, mood_id: c.mood_id })} />
            <View style={{ width: 6 }} />
            <Btn small kind="secondary" title={c.is_active ? 'Hide' : 'Show'} style={{ flex: 1 }} onPress={() => toggleActive(c)} />
            <View style={{ width: 6 }} />
            <Btn small kind="danger" title="Delete" style={{ flex: 1 }} onPress={() => remove(c)} />
          </View>
        </Card>
      )}
    />
  );
}
