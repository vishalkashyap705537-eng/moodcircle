// 3. Age / DOB — the app is 18+ only. The server also re-checks this at sign-up.
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Btn, Card, Empty, Screen, T, Title } from '../../components/ui';
import { ageFrom, isoDate } from '../../lib/format';
import { colors } from '../../lib/theme';

export default function Age() {
  const [dob, setDob] = useState<Date | null>(null);
  const [show, setShow] = useState(Platform.OS === 'ios');
  const [blocked, setBlocked] = useState(false);
  const max = new Date();

  if (blocked) {
    return (
      <Screen edges={['bottom']}>
        <Empty icon="lock" title="MoodCircle is for adults (18+)" sub="We're working on a safe version for younger users. Please come back when you're 18." >
          <Btn title="Back to start" kind="secondary" onPress={() => router.replace('/welcome')} />
        </Empty>
      </Screen>
    );
  }

  const next = () => {
    if (!dob) return;
    if (ageFrom(dob) < 18) {
      setBlocked(true);
      return;
    }
    router.push({ pathname: '/signup', params: { dob: isoDate(dob) } });
  };

  return (
    <Screen>
      <Title sub="We only use this to confirm you're 18 or older. It is never shown on your profile.">
        When were you born?
      </Title>
      <Card style={{ alignItems: 'center' }}>
        {Platform.OS !== 'ios' ? (
          <Btn
            title={dob ? dob.toDateString() : 'Choose your date of birth'}
            kind="secondary"
            style={{ alignSelf: 'stretch' }}
            onPress={() => setShow(true)}
          />
        ) : null}
        {show ? (
          <DateTimePicker
            value={dob ?? new Date(2000, 0, 1)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={max}
            themeVariant="light"
            textColor={colors.text}
            onChange={(_e, d) => {
              if (Platform.OS !== 'ios') setShow(false);
              if (d) setDob(d);
            }}
          />
        ) : null}
      </Card>
      <View style={{ height: 12 }} />
      <Btn title="Continue" disabled={!dob} onPress={next} />
      <T faint size={12} style={{ textAlign: 'center', marginTop: 14 }}>
        Giving a false age breaks our Terms and may get your account removed.
      </T>
    </Screen>
  );
}
