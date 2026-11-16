// 21. Privacy
import { useState } from 'react';
import { Card, Group, Row, Screen, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export default function Privacy() {
  const { profile, refreshProfile } = useAuth();
  const [vals, setVals] = useState({
    show_mood: profile?.show_mood ?? true,
    show_communities: profile?.show_communities ?? true,
    allow_dm_requests: profile?.allow_dm_requests ?? true,
  });

  const set = async (k: keyof typeof vals, v: boolean) => {
    if (!profile) return;
    setVals((x) => ({ ...x, [k]: v }));
    await supabase.from('profiles').update({ [k]: v }).eq('id', profile.id);
    refreshProfile();
  };

  return (
    <Screen>
      <Group title="Who sees what">
        <Row label="Show my current mood" toggle={vals.show_mood} onToggle={(v) => set('show_mood', v)} />
        <Row label="Show circles I've joined" toggle={vals.show_communities} onToggle={(v) => set('show_communities', v)} />
        <Row label="Allow message requests" toggle={vals.allow_dm_requests} onToggle={(v) => set('allow_dm_requests', v)} />
      </Group>
      <Card>
        <T bold style={{ marginBottom: 6 }}>Always private</T>
        <T dim size={14}>
          Your email, date of birth and exact age are never shown to anyone. There are no real names, phone numbers,
          locations or photos on MoodCircle. Anonymous posts and comments never reveal who wrote them to other users.
        </T>
      </Card>
    </Screen>
  );
}
