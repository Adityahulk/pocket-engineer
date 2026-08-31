import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { api } from '@/lib/api';
import { useLiveInterval } from '@/lib/live';
import { fonts, palette } from '@/lib/theme';

/**
 * The product loop is estate → in-flight work → decisions, so all three stay
 * one tap apart. Detail screens are pushed by the root stack and deliberately
 * cover this bar: reviewing a patch should not compete with navigation.
 */
export default function TabsLayout() {
  const center = useQuery({
    queryKey: ['command-center'],
    queryFn: api.commandCenter,
    refetchInterval: useLiveInterval(4_000),
  });
  const waiting = center.data?.approval_count ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.ink },
        tabBarActiveTintColor: palette.citron,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: palette.inkSunken,
          borderTopColor: palette.line,
          borderTopWidth: 1,
          height: Platform.OS === 'web' ? 64 : undefined,
        },
        tabBarLabelStyle: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.3, marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 6 },
        tabBarBadgeStyle: {
          backgroundColor: palette.citron,
          color: palette.ink,
          fontFamily: fonts.mono,
          fontSize: 10,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'ESTATE',
          tabBarIcon: ({ color }) => <Icon name="activity" size={19} color={color} />,
          tabBarAccessibilityLabel: 'Your software estate',
        }}
      />
      <Tabs.Screen
        name="missions"
        options={{
          title: 'MISSIONS',
          tabBarIcon: ({ color }) => <Icon name="git-branch" size={19} color={color} />,
          tabBarAccessibilityLabel: 'Active missions',
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'DECISIONS',
          tabBarIcon: ({ color }) => <Icon name="inbox" size={19} color={color} />,
          tabBarBadge: waiting > 0 ? waiting : undefined,
          tabBarAccessibilityLabel: waiting > 0
            ? `Decisions, ${waiting} waiting on you`
            : 'Decisions, nothing waiting',
        }}
      />
    </Tabs>
  );
}
