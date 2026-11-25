import type { Track, TrackId } from '../types';
import { TELUK_SORE } from './telukSore';
import { MATA_AIR } from './mataAir';
import { LERENG_KOPI } from './lerengKopi';
import { PELABUHAN } from './pelabuhan';

export const TRACKS: Record<TrackId, Track> = {
  'teluk-sore': TELUK_SORE,
  'mata-air': MATA_AIR,
  'lereng-kopi': LERENG_KOPI,
  pelabuhan: PELABUHAN,
};

export const TRACK_ORDER: TrackId[] = ['teluk-sore', 'mata-air', 'lereng-kopi', 'pelabuhan'];

export function getTrack(id: TrackId): Track {
  return TRACKS[id];
}
