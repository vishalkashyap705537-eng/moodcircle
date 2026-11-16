// 27. Terms
import { Screen, T, Title } from '../../components/ui';

const SECTIONS: [string, string][] = [
  ['1. Who can use MoodCircle', 'You must be at least 18 years old. By creating an account you confirm the date of birth you gave is true. Accounts found to belong to under-18 users will be removed.'],
  ['2. What MoodCircle is', 'MoodCircle is a peer-support community where people connect based on how they feel. It is not a medical, counselling or emergency service. If you are in crisis, contact local emergency services or a helpline listed in Help & Safety.'],
  ['3. Your account', 'Keep your login private. You are responsible for activity on your account. Choose a nickname that does not reveal your real identity and is not offensive.'],
  ['4. Community rules', 'Be kind. Do not harass, bully, threaten or hate on anyone. No sexual content, no nudity, no spam or scams, no selling, no sharing anyone’s personal information (including your own phone, address, school or social accounts), no encouraging self-harm, and no illegal activity. Do not use MoodCircle for dating or to solicit anyone.'],
  ['5. Anonymous posting', 'Anonymous posts hide your identity from other users but not from MoodCircle. Moderators can see who posted anything if it breaks these rules or the law, and we may share information with authorities when legally required or when someone’s safety is at risk.'],
  ['6. Moderation', 'We filter offensive language automatically and review reported content. We may remove content, suspend or ban accounts that break these rules, with or without notice.'],
  ['7. Direct messages', 'Private messages require the other person to accept your request. Free accounts have a daily request limit. Reported conversations may be reviewed by moderators.'],
  ['8. MoodCircle Plus', 'Plus is an auto-renewing subscription billed through Razorpay, PayPal, Google Play or the Apple App Store, depending on the payment method you choose. Prices are shown before purchase. It renews automatically each period until cancelled. Razorpay and PayPal subscriptions can be cancelled in Settings → Subscription & payment; store subscriptions in your store account settings. After cancelling you keep Plus until the end of the period you paid for. Refunds follow the policy of the payment provider you used and applicable law.'],
  ['9. Your content', 'You own what you post. You give MoodCircle a licence to display it in the app so others can see it. You can delete your posts or your whole account at any time from Settings.'],
  ['10. Liability', 'MoodCircle is provided "as is". We are not responsible for what other users say or do. To the extent permitted by law, our liability is limited to the amount you paid us in the last 12 months.'],
  ['11. Changes', 'We may update these terms. We will tell you in the app when we make important changes.'],
  ['12. Contact', 'Questions? Email support@moodcircle.app.'],
];

export default function Terms() {
  return (
    <Screen>
      <Title sub="Last updated: November 2026">Terms of Service</Title>
      {SECTIONS.map(([h, b]) => (
        <T key={h} style={{ marginBottom: 16 }}>
          <T bold>{h}{'\n'}</T>
          <T dim>{b}</T>
        </T>
      ))}
    </Screen>
  );
}
