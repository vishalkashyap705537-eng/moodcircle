// 26. Help & safety
import { Linking, View } from 'react-native';
import { Card, Group, Row, Screen, T, Title } from '../../components/ui';
import { colors } from '../../lib/theme';
import { Icon } from '../../components/Icon';

const SUPPORT_EMAIL = 'support@moodcircle.app';

const HELPLINES = [
  { name: 'Tele-MANAS (India, 24×7, free)', phone: '14416' },
  { name: 'KIRAN Mental Health (India)', phone: '18005990019' },
  { name: 'Emergency (India)', phone: '112' },
  { name: 'Find a helpline in your country', url: 'https://findahelpline.com' },
];

export default function Help() {
  return (
    <Screen>
      <Title sub="MoodCircle is peer support, not a replacement for professional help.">Help & safety</Title>
      <Card style={{ borderColor: colors.danger }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}><Icon name="lifebuoy" size={20} color={colors.danger} style={{ marginRight: 8 }} /><T bold>If you're in crisis</T></View>
        <T dim size={14}>If you are thinking about harming yourself or are in danger, please contact a helpline or emergency services now. You deserve support.</T>
      </Card>
      <Group title="Talk to someone now">
        {HELPLINES.map((h) => (
          <Row key={h.name} icon={h.url ? 'globe' : 'phone'} label={h.name} value={h.phone} onPress={() => Linking.openURL(h.url ?? `tel:${h.phone}`)} />
        ))}
      </Group>
      <Group title="Staying safe on MoodCircle">
        <Row icon="mask" label="Never share your real name, phone, address or school" />
        <Row icon="ban" label="Block anyone who makes you uncomfortable" />
        <Row icon="flag" label="Report posts, comments, chats or users" />
        <Row icon="banknote" label="Never send money or personal photos" />
      </Group>
      <Group title="Contact us">
        <Row icon="mail" label="Email support" value={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
      </Group>
    </Screen>
  );
}
