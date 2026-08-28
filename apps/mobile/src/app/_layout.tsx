import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthGate } from '@/lib/auth';
import { fonts, palette } from '@/lib/theme';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 2, staleTime: 1_500 }, mutations: { retry: 0 } },
  }));
  const [fontsLoaded, fontError] = useFonts({
    [fonts.regular]: require('../../assets/fonts/SpaceGrotesk-Regular.ttf'),
    [fonts.medium]: require('../../assets/fonts/SpaceGrotesk-Medium.ttf'),
    [fonts.display]: require('../../assets/fonts/SpaceGrotesk-Bold.ttf'),
    [fonts.mono]: require('../../assets/fonts/JetBrainsMono-Regular.ttf'),
  });

  // Render on font error too: system fallbacks are better than a stuck splash.
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: palette.ink }} />;

  return (
    <SafeAreaProvider>
      <AuthGate>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack screenOptions={{
            headerStyle: { backgroundColor: palette.ink }, headerTintColor: palette.paper,
            headerShadowVisible: false, contentStyle: { backgroundColor: palette.ink }, animation: 'slide_from_right',
            headerTitleStyle: { fontFamily: fonts.display, fontSize: 16 },
            headerBackButtonDisplayMode: 'minimal',
          }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="inbox" options={{ title: 'Decisions' }} />
            <Stack.Screen name="missions" options={{ title: 'Active missions' }} />
            <Stack.Screen name="project/[id]" options={{ title: 'Project' }} />
            <Stack.Screen name="task/[id]" options={{ title: 'Mission' }} />
            <Stack.Screen name="github" options={{ title: 'Choose repository' }} />
            <Stack.Screen name="voice" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          </Stack>
        </QueryClientProvider>
      </AuthGate>
    </SafeAreaProvider>
  );
}
