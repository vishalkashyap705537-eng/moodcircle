import { useAuth } from '../lib/auth';
import { Btn, Empty, Screen } from '../components/ui';

export default function Banned() {
  const { signOut } = useAuth();
  return (
    <Screen edges={['top', 'bottom']}>
      <Empty icon="octagon" title="Your account has been banned" sub="This account broke the MoodCircle community rules. If you think this is a mistake, contact support from the email you signed up with.">
        <Btn title="Log out" kind="secondary" onPress={signOut} />
      </Empty>
    </Screen>
  );
}
