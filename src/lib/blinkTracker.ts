export interface BlinkFrame {
  leftEAR: number;
  rightEAR: number;
  eyeClosed: boolean;
  blinkStartedAt: number | null;
  blinkDurationMs: number | null;
  blinkCount: number;
  blinkFrequencyPerMinute: number;
}

interface BlinkState {
  closedSince: number | null;
  blinkTimes: number[];
  blinkCount: number;
}

const CLOSE_THRESHOLD = 0.18;
const OPEN_THRESHOLD = 0.21;
const MIN_BLINK_DURATION_MS = 50;
const MAX_BLINK_DURATION_MS = 500;
const WINDOW_MS = 60_000;

/** Detects completed two-eye blinks independently for each tracked face. */
export class BlinkTracker {
  private states = new Map<number, BlinkState>();

  update(
    trackId: number,
    leftEAR: number,
    rightEAR: number,
    now: number,
    confidenceWeight: number,
  ): BlinkFrame {
    const state = this.states.get(trackId) ?? { closedSince: null, blinkTimes: [], blinkCount: 0 };
    const eyeClosed = (leftEAR + rightEAR) / 2 < CLOSE_THRESHOLD;
    const weight = Math.min(1, Math.max(0, confidenceWeight));
    let blinkDurationMs: number | null = null;
    let blinkStartedAt: number | null = state.closedSince;

    if (weight > 0 && eyeClosed && state.closedSince == null) {
      state.closedSince = now;
      blinkStartedAt = now;
    } else if (weight > 0 && state.closedSince != null && (leftEAR + rightEAR) / 2 > OPEN_THRESHOLD) {
      const duration = now - state.closedSince;
      blinkStartedAt = state.closedSince;
      if (duration >= MIN_BLINK_DURATION_MS && duration <= MAX_BLINK_DURATION_MS) {
        state.blinkCount += 1;
        state.blinkTimes.push(now);
        blinkDurationMs = duration;
      }
      state.closedSince = null;
      blinkStartedAt = null;
    }

    state.blinkTimes = state.blinkTimes.filter((at) => now - at <= WINDOW_MS);
    this.states.set(trackId, state);

    return {
      leftEAR,
      rightEAR,
      eyeClosed,
      blinkStartedAt,
      blinkDurationMs,
      blinkCount: state.blinkCount,
      blinkFrequencyPerMinute: state.blinkTimes.length,
    };
  }

  reset() {
    this.states.clear();
  }
}
