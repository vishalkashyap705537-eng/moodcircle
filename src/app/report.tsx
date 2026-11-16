// 23. Report
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Btn, Chip, Field, Screen, T, Title } from '../components/ui';
import { useAuth } from '../lib/auth';
import { errMsg, supabase } from '../lib/supabase';
import { REPORT_REASONS } from '../lib/theme';

const LABEL: Record<string, string> = { post: 'post', comment: 'comment', message: 'message', dm: 'conversation', user: 'user' };

export default function Report() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const { profile } = useAuth();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!profile || !reason) return;
    setBusy(true);
    const { error } = await supabase.from('reports').insert({ reporter_id: profile.id, target_type: type, target_id: id, reason, details: details.trim() });
    setBusy(false);
    if (error) return Alert.alert('Error', errMsg(error));
    Alert.alert('Thanks for reporting', 'Our moderators will review it. You can also block this person from their profile.');
    router.back();
  };

  return (
    <Screen>
      <Title sub="Reports are anonymous — the person won't know who reported them.">{`Report this ${LABEL[type] ?? 'item'}`}</Title>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
        {REPORT_REASONS.map((r) => <Chip key={r} label={r} active={reason === r} onPress={() => setReason(r)} />)}
      </View>
      <Field label="Anything else? (optional)" multiline value={details} onChangeText={setDetails} maxLength={500} />
      {reason === 'Self-harm concern' ? (
        <T dim size={13} style={{ marginBottom: 12 }}>If someone is in immediate danger, please contact emergency services (112 in India).</T>
      ) : null}
      <Btn title="Submit report" kind="danger" disabled={!reason} loading={busy} onPress={submit} />
    </Screen>
  );
}
