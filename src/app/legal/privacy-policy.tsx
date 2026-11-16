// 28. Privacy policy
import { Screen, T, Title } from '../../components/ui';

const SECTIONS: [string, string][] = [
  ['What we collect', 'Email address and password (for login), date of birth (only to confirm you are 18+), your nickname, avatar, bio, current mood, the circles you join, and the posts, comments and messages you send. If you subscribe, the app store tells us your subscription status — we never receive card or bank details.'],
  ['What others can see', 'Only your nickname, avatar, bio, and — if you allow it — your current mood and circles. Your email, date of birth, age and any other account details are never shown. Anonymous posts and comments show "Anonymous" to everyone except you.'],
  ['What we don’t collect', 'We do not ask for your real name, phone number, contacts, photos or precise location, and we do not sell your data.'],
  ['How we use it', 'To run the app, show you relevant circles, deliver messages, keep the community safe (automatic language filtering and review of reports), prevent abuse, and manage your subscription.'],
  ['Who we share with', 'Our hosting and database provider (Supabase), our payment providers (Razorpay, PayPal, Google Play / Apple, and RevenueCat for store subscriptions). Payment details such as card or bank information are entered directly with the payment provider; MoodCircle never receives them. We may disclose information if required by law or to protect someone’s safety.'],
  ['Storage & security', 'Data is stored on secured servers with encryption in transit. Access is restricted by strict database rules so users can only read what they are allowed to.'],
  ['How long we keep it', 'Until you delete it or delete your account. Deleting your account from Settings permanently removes your profile, posts, comments and messages. Reports and legally required records may be kept for a limited time.'],
  ['Your rights', 'You can view and edit your profile, change privacy settings, delete content, and delete your account at any time. Under India’s Digital Personal Data Protection Act and similar laws you can also request access, correction or erasure by emailing us.'],
  ['Age', 'MoodCircle is only for people 18 and over. We do not knowingly collect data from anyone under 18 and will delete such accounts when found.'],
  ['Contact / Grievance officer', 'support@moodcircle.app'],
];

export default function PrivacyPolicy() {
  return (
    <Screen>
      <Title sub="Last updated: November 2026">Privacy Policy</Title>
      {SECTIONS.map(([h, b]) => (
        <T key={h} style={{ marginBottom: 16 }}>
          <T bold>{h}{'\n'}</T>
          <T dim>{b}</T>
        </T>
      ))}
    </Screen>
  );
}
