import { Badge, type BadgeTone } from '@/components/ui/badge';
import { humanState } from '@/lib/mission';

const success = new Set(['ready', 'ready_for_review', 'completed']);
const danger = new Set(['failed', 'cancelled']);

export function StatePill({ state }: { state: string }) {
  const tone: BadgeTone = danger.has(state) ? 'red' : success.has(state) ? 'mint' : 'amber';
  const inFlight = !success.has(state) && !danger.has(state) && state !== 'ready';
  return <Badge label={humanState(state)} tone={tone} pulse={inFlight} />;
}
