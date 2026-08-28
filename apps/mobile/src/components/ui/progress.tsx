import { StyleSheet, Text, View } from 'react-native';

import { LiveDot } from '@/components/ui/badge';
import { MISSION_STAGES, MISSION_STOPPED, missionStage, missionStageLabel } from '@/lib/mission';
import { palette, radius, type } from '@/lib/theme';

/** Segmented view of where a mission is in the observe → verify → review loop. */
export function MissionProgress({ state, compact = false }: { state: string; compact?: boolean }) {
  const stage = missionStage(state);
  const stopped = MISSION_STOPPED.has(state);
  const done = state === 'completed';
  const accent = stopped ? palette.red : done ? palette.citron : palette.amber;

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <LiveDot color={accent} pulse={!stopped && !done} size={6} />
        <Text style={[styles.stage, { color: accent }]}>{missionStageLabel(state)}</Text>
        <Text style={styles.counter}>
          {stopped ? 'STOPPED' : `${Math.min(stage + 1, MISSION_STAGES.length)}/${MISSION_STAGES.length}`}
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
                filled && { backgroundColor: done ? palette.citron : palette.citronDeep },
                active && { backgroundColor: palette.amber },
                stopped && index === stage && { backgroundColor: palette.red },
              ]}
            />
          );
        })}
      </View>
      {compact ? null : (
        <View style={styles.legend}>
          {MISSION_STAGES.map((label, index) => (
            <Text
              key={label}
              style={[styles.legendText, index === stage && !stopped && !done && { color: palette.muted }]}
              numberOfLines={1}>
              {label.slice(0, 3)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stage: { ...type.label, fontSize: 9 },
  counter: { ...type.label, color: palette.mutedDeep, fontSize: 9, marginLeft: 'auto' },
  track: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 3, borderRadius: radius.pill, backgroundColor: palette.line },
  legend: { flexDirection: 'row', gap: 4 },
  legendText: { ...type.label, color: '#3C4149', fontSize: 7, flex: 1, textAlign: 'center' },
});
