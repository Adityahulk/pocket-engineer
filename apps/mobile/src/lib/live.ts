import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Interval for a React Query `refetchInterval` that stops while the screen is
 * covered or the app is backgrounded. Mission Control polls several endpoints
 * every few seconds, which is not worth doing on a phone nobody is looking at.
 */
export function useLiveInterval(interval: number): number | false {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(() => AppState.currentState !== 'background');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  return focused && foreground ? interval : false;
}

/**
 * Pull-to-refresh state that only spins for a refresh the user asked for.
 * Binding the spinner to React Query's `isFetching` makes it blink on every
 * background poll.
 */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refetch().finally(() => setRefreshing(false));
  }, [refetch]);

  return { refreshing, onRefresh };
}
