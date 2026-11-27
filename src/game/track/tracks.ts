import type { Track, TrackId } from '../types';
import { TELUK_SORE } from './telukSore';
import { MATA_AIR } from './mataAir';
import { LERENG_KOPI } from './lerengKopi';
import { PELABUHAN } from './pelabuhan';
import { RIMBA_LUMPUR } from './rimbaLumpur';

export const TRACKS: Record<TrackId, Track> = {
  'teluk-sore': TELUK_SORE,
  'mata-air': MATA_AIR,
  'lereng-kopi': LERENG_KOPI,
  pelabuhan: PELABUHAN,
  'rimba-lumpur': RIMBA_LUMPUR,
};

export const TRACK_ORDER: TrackId[] = ['teluk-sore', 'mata-air', 'lereng-kopi', 'pelabuhan', 'rimba-lumpur'];

export function getTrack(id: TrackId): Track {
  return TRACKS[id];
}
