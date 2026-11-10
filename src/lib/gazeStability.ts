import type { GazeDirection } from "@/lib/focusTracking";

const REQUIRED_CONFIRMATIONS = 3;

interface GazeCandidate {
  direction: GazeDirection;
  confirmations: number;
}

/** Debounces transient gaze classification flips without changing pose thresholds. */
export class GazeStabilityTracker {
  private current = new Map<number, GazeDirection>();
  private candidates = new Map<number, GazeCandidate>();

  update(trackId: number, candidate: GazeDirection): GazeDirection {
    const current = this.current.get(trackId) ?? "none";
    if (candidate === current) {
      this.candidates.delete(trackId);
      return current;
    }

    const previousCandidate = this.candidates.get(trackId);
    const confirmations =
      previousCandidate?.direction === candidate ? previousCandidate.confirmations + 1 : 1;
    this.candidates.set(trackId, { direction: candidate, confirmations });

    if (confirmations >= REQUIRED_CONFIRMATIONS) {
      this.current.set(trackId, candidate);
      this.candidates.delete(trackId);
      return candidate;
    }
    return current;
  }

  reset(): void {
    this.current.clear();
    this.candidates.clear();
  }
}
