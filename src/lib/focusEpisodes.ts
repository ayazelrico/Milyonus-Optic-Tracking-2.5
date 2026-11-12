import type { GazeDirection } from "@/lib/focusTracking";

export interface FocusEpisodeFrame {
  active: boolean;
  startedAt: number | null;
  durationMs: number | null;
  completedDurationMs: number | null;
}

interface EpisodeState {
  startedAt: number | null;
}

/** Tracks contiguous committed center-gaze episodes without retaining raw landmarks. */
export class FocusEpisodeTracker {
  private tracks = new Map<number, EpisodeState>();

  update(trackId: number, gaze: GazeDirection, at: number): FocusEpisodeFrame {
    const state = this.tracks.get(trackId) ?? { startedAt: null };
    this.tracks.set(trackId, state);

    if (gaze === "center") {
      if (state.startedAt == null) state.startedAt = at;
      return {
        active: true,
        startedAt: state.startedAt,
        durationMs: Math.max(0, at - state.startedAt),
        completedDurationMs: null,
      };
    }

    const completedDurationMs = state.startedAt == null ? null : Math.max(0, at - state.startedAt);
    state.startedAt = null;
    return {
      active: false,
      startedAt: null,
      durationMs: null,
      completedDurationMs,
    };
  }

  observeMissing(activeTrackIds: ReadonlySet<number>): void {
    for (const trackId of this.tracks.keys()) {
      if (!activeTrackIds.has(trackId)) this.tracks.delete(trackId);
    }
  }

  reset(): void {
    this.tracks.clear();
  }
}
