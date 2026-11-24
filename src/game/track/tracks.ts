import type { Track, TrackId } from '../types';
import { TELUK_SORE } from './telukSore';
import { MATA_AIR } from './mataAir';

export const TRACKS: Record<TrackId, Track> = {
  'teluk-sore': TELUK_SORE,
  'mata-air': MATA_AIR,
};

export const TRACK_ORDER: TrackId[] = ['teluk-sore', 'mata-air'];

export function getTrack(id: TrackId): Track {
  return TRACKS[id];
}
