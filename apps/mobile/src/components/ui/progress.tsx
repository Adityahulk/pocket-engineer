import { StyleSheet, Text, View } from 'react-native';

import { LiveDot } from '@/components/ui/badge';
import { MISSION_STAGES, MISSION_STOPPED, missionStage, missionStageLabel } from '@/lib/mission';
import { palette, radius, type } from '@/lib/theme';

/** Segmented view of where a mission is in the observe → verify → review loop. */
export function MissionProgress({ state }: { state: string }) {
  const stage = missionStage(state);
  const stopped = MISSION_STOPPED.has(state);
  const done = state === 'completed';
  const accent = stopped ? palette.red : done ? palette.mint : palette.amber;

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <LiveDot color={accent} pulse={!stopped && !done} size={7} />
        <Text style={[styles.stage, { color: accent }]}>{missionStageLabel(state)}</Text>
        <Text style={styles.counter}>
          {stopped ? 'STOPPED' : `STEP ${Math.min(stage + 1, MISSION_STAGES.length)} OF ${MISSION_STAGES.length}`}
        </Text>
      </View>
      <View style={styles.track}>
        {MISSION_STAGES.map((label, index) => {
          const filled = index < stage;
          const active = index === stage && !stopped && !done;
          return (
            <View
              key={label}
              style={[
                styles.segment,
                filled && { backgroundColor: done ? palette.mint : palette.mintDark },
                active && { backgroundColor: palette.amber },
                stopped && index === stage && { backgroundColor: palette.red },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stage: { ...type.label, fontSize: 9 },
  counter: { ...type.label, color: palette.mutedDeep, fontSize: 8, marginLeft: 'auto' },
  track: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: palette.line },
});
