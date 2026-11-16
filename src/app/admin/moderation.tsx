// Admin 7. Moderation queue (auto-flagged content) + bad-word list
import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { AdminContentList } from '../../components/AdminContentList';
import { Btn, Card, Chip, Field, T } from '../../components/ui';
import { errMsg, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

type Word = { word: string; severity: 'block' | 'flag' };

function WordList() {
  const [words, setWords] = useState<Word[]>([]);
  const [w, setW] = useState('');
  const [sev, setSev] = useState<'block' | 'flag'>('block');

  const load = () => supabase.from('banned_words').select('*').order('word').then(({ data }) => setWords((data as Word[]) ?? []));
  useEffect(() => { load(); }, []);

  const add = async () => {
    const word = w.trim().toLowerCase();
    if (!word) return;
    const { error } = await supabase.from('banned_words').upsert({ word, severity: sev });
    if (error) return Alert.alert('Error', errMsg(error));
    setW('');
    load();
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <T dim size={13} style={{ marginBottom: 10 }}>
          "Block" words stop the message from being sent. "Flag" words let it through but put it in the moderation queue.
        </T>
        <Field placeholder="Add a word or phrase" value={w} onChangeText={setW} autoCapitalize="none" />
        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
          <Chip label="Block" active={sev === 'block'} onPress={() => setSev('block')} color={colors.danger} />
          <Chip label="Flag" active={sev === 'flag'} onPress={() => setSev('flag')} color={colors.gold} />
        </View>
        <Btn small title="Add" onPress={add} />
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {words.map((x) => (
          <Chip
            key={x.word}
            label={x.word}
            icon={x.severity === 'block' ? 'octagon' : 'alert'}
            color={x.severity === 'block' ? colors.danger : colors.gold}
            onPress={() => Alert.alert(`Remove "${x.word}"?`, undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: async () => { await supabase.from('banned_words').delete().eq('word', x.word); load(); } },
            ])}
          />
        ))}
      </View>
    </ScrollView>
  );
}

export default function Moderation() {
  const [tab, setTab] = useState<'post' | 'comment' | 'message' | 'words'>('post');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView horizontal style={{ flexGrow: 0, paddingHorizontal: 16, paddingTop: 10 }} showsHorizontalScrollIndicator={false}>
        <Chip label="Flagged posts" active={tab === 'post'} onPress={() => setTab('post')} />
        <Chip label="Flagged comments" active={tab === 'comment'} onPress={() => setTab('comment')} />
        <Chip label="Flagged chat" active={tab === 'message'} onPress={() => setTab('message')} />
        <Chip label="Word filter" active={tab === 'words'} onPress={() => setTab('words')} />
      </ScrollView>
      <View style={{ flex: 1 }}>
        {tab === 'words' ? <WordList /> : <AdminContentList key={tab} type={tab} flaggedOnly />}
      </View>
    </View>
  );
}
