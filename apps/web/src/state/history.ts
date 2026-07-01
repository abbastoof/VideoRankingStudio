/**
 * Command-history undo/redo for the timeline editor.
 *
 * A `Command` records an inverse operation. Executing a command pushes it
 * onto the undo stack and clears the redo stack. Undo pops from the undo
 * stack, applies the inverse, and pushes the inverse of the inverse onto
 * redo. Redo mirrors the reverse.
 *
 * We deliberately keep the command payloads plain data so the whole history
 * is JSON-serialisable — that lets us checkpoint an editing session to
 * localStorage or send it to server-side replay in the future.
 */

import type { EditorClip, EditorTrack } from './editor-store';

export type Command =
  | { type: 'MOVE_CLIP'; clipId: string; fromMs: number; toMs: number; fromTrackId?: string; toTrackId?: string }
  | { type: 'TRIM_CLIP'; clipId: string; edge: 'start' | 'end'; deltaMs: number }
  | { type: 'SPLIT_CLIP'; originalClipId: string; leftDurationMs: number; newClipId: string }
  | { type: 'CREATE_CLIP'; trackId: string; clip: EditorClip }
  | { type: 'DELETE_CLIP'; clip: EditorClip; trackId: string; index: number }
  | { type: 'CREATE_TRACK'; track: EditorTrack; index: number }
  | { type: 'DELETE_TRACK'; track: EditorTrack; index: number }
  | { type: 'UPDATE_CLIP'; clipId: string; before: Partial<EditorClip>; after: Partial<EditorClip> }
  | { type: 'UPDATE_TRACK'; trackId: string; before: Partial<EditorTrack>; after: Partial<EditorTrack> };

export interface History {
  past: Command[];
  future: Command[];
}

export const emptyHistory: History = { past: [], future: [] };

const HISTORY_LIMIT = 200;

export function push(history: History, cmd: Command): History {
  const past = [...history.past, cmd];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { past, future: [] };
}

export function undo(history: History): { history: History; cmd: Command | null } {
  const past = [...history.past];
  const cmd = past.pop() ?? null;
  if (!cmd) return { history, cmd: null };
  return { history: { past, future: [...history.future, cmd] }, cmd };
}

export function redo(history: History): { history: History; cmd: Command | null } {
  const future = [...history.future];
  const cmd = future.pop() ?? null;
  if (!cmd) return { history, cmd: null };
  return { history: { past: [...history.past, cmd], future }, cmd };
}

/** Compute the inverse of a command so undo replays cleanly. */
export function invert(cmd: Command): Command {
  switch (cmd.type) {
    case 'MOVE_CLIP':
      return {
        ...cmd,
        fromMs: cmd.toMs,
        toMs: cmd.fromMs,
        fromTrackId: cmd.toTrackId,
        toTrackId: cmd.fromTrackId,
      };
    case 'TRIM_CLIP':
      return { ...cmd, deltaMs: -cmd.deltaMs };
    case 'SPLIT_CLIP':
      // Undo of a split is a delete of the right half + restoration of the
      // original clip's duration. The store handles that via a compound
      // command applied atomically.
      return cmd;
    case 'CREATE_CLIP':
      return { type: 'DELETE_CLIP', clip: cmd.clip, trackId: cmd.trackId, index: -1 };
    case 'DELETE_CLIP':
      return { type: 'CREATE_CLIP', trackId: cmd.trackId, clip: cmd.clip };
    case 'CREATE_TRACK':
      return { type: 'DELETE_TRACK', track: cmd.track, index: cmd.index };
    case 'DELETE_TRACK':
      return { type: 'CREATE_TRACK', track: cmd.track, index: cmd.index };
    case 'UPDATE_CLIP':
      return { type: 'UPDATE_CLIP', clipId: cmd.clipId, before: cmd.after, after: cmd.before };
    case 'UPDATE_TRACK':
      return { type: 'UPDATE_TRACK', trackId: cmd.trackId, before: cmd.after, after: cmd.before };
  }
}
