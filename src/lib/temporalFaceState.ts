import type { HeadMovementFrame } from "@/lib/headMovement";

export type TemporalFaceState = "new" | "stable" | "moving" | "lost" | "recovered";

export interface TemporalFaceStateFrame {
  state: TemporalFaceState;
  previousState: TemporalFaceState | null;
  transition: boolean;
  observationCount: number;
}

interface TrackState {
  state: TemporalFaceState;
  observationCount: number;
  lastSeenAt: number;
}

const STABLE_OBSERVATIONS = 3;

/** Tracks the lifecycle state of each face ID without changing ID assignment. */
export class TemporalFaceStateTracker {
  private tracks = new Map<number, TrackState>();

  observe(
    trackId: number,
    at: number,
    headMovement: HeadMovementFrame,
    confidenceWeight: number,
  ): TemporalFaceStateFrame {
    const previous = this.tracks.get(trackId);
    if (confidenceWeight <= 0) {
      return {
        state: previous?.state ?? "new",
        previousState: null,
        transition: false,
        observationCount: previous?.observationCount ?? 0,
      };
    }

    const previousState = previous?.state ?? null;
    const wasLost = previous?.state === "lost";
    const observationCount = (previous?.observationCount ?? 0) + 1;
    let state: TemporalFaceState;
    if (!previous) {
      state = "new";
    } else if (wasLost) {
      state = "recovered";
    } else if ((headMovement.intensity ?? 0) >= 0.25) {
      state = "moving";
    } else if (observationCount >= STABLE_OBSERVATIONS) {
      state = "stable";
    } else {
      state = "new";
    }

    this.tracks.set(trackId, { state, observationCount, lastSeenAt: at });
    return {
      state,
      previousState,
      transition: previousState !== state,
      observationCount,
    };
  }

  markMissing(activeTrackIds: ReadonlySet<number>, at: number) {
    for (const [trackId, track] of this.tracks) {
      if (!activeTrackIds.has(trackId) && track.state !== "lost") {
        track.state = "lost";
        track.lastSeenAt = at;
      }
    }
  }

  reset() {
    this.tracks.clear();
  }
}
