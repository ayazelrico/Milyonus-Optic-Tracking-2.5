export interface BlinkFrame {
  leftEAR: number;
  rightEAR: number;
  leftEyeOpen: number | null;
  rightEyeOpen: number | null;
  eyeOpenness: number | null;
  eyeSymmetryDifference: number | null;
  eyeSymmetryScore: number | null;
  confidenceWeight: number;
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
    const weight = Math.min(1, Math.max(0, confidenceWeight));
    const state = this.states.get(trackId) ?? { closedSince: null, blinkTimes: [], blinkCount: 0 };
    const meanEAR = (leftEAR + rightEAR) / 2;
    const eyeClosed = meanEAR < CLOSE_THRESHOLD;
    const eyeSymmetryDifference = weight > 0
      ? Math.min(1, Math.abs(leftEAR - rightEAR) / Math.max(meanEAR, 0.001))
      : null;
    let blinkDurationMs: number | null = null;
    let blinkStartedAt: number | null = state.closedSince;

    if (weight > 0 && eyeClosed && state.closedSince == null) {
      state.closedSince = now;
      blinkStartedAt = now;
    } else if (weight > 0 && state.closedSince != null && meanEAR > OPEN_THRESHOLD) {
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
      leftEyeOpen: weight > 0 ? leftEAR : null,
      rightEyeOpen: weight > 0 ? rightEAR : null,
      eyeOpenness: weight > 0 ? meanEAR : null,
      eyeSymmetryDifference,
      eyeSymmetryScore: eyeSymmetryDifference == null ? null : 1 - eyeSymmetryDifference,
      confidenceWeight: weight,
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
