# Daily Development Log

## Day 1 — Baseline

- **Date:** 2026-09-27
- **Feature:** Reproducible baseline report for Milyonus Optic Tracking 2.5
- **Problem:** The project had a benchmark harness, but no committed Day 1 baseline artifact documenting the current state of the 2.5 codebase.
- **Change:** Ran the baseline harness against the current `main` commit and committed the resulting JSON report as `artifacts/baseline-v2.5.json`. The report captures the production build result and preserves unavailable camera metrics as explicit missing data.
- **Expected improvement:** Establish a versioned reference point for future performance comparisons without introducing synthetic measurements.
- **Actual result:** The production build passed. Build duration was `977.77 ms` in this sandbox run. No real-camera session CSV was available, so face detection rate, FPS, inference latency, confidence, focus, gaze, track continuity, CPU, and memory metrics remain unmeasured.
- **Metric:** `build.status = passed`; `build.duration_ms = 977.77`; `session.sample_count = 0`.
- **Regression:** No regression observed in the production build. Real-camera behavior remains unverified and requires manual validation.
- **Next action:** Run the browser with a real camera for each controlled scenario, export the session CSV, and rerun the baseline harness to populate runtime metrics. Then proceed to Day 2: landmark quality and jitter measurement.

## Day 2 — Landmark Quality

- **Date:** 2026-09-28
- **Feature:** Frame-to-frame landmark jitter measurement
- **Problem:** The baseline report measured session-level signals but could not quantify whether the 478 landmarks were unnecessarily moving while a subject remained still.
- **Change:** Extended `scripts/baseline.mjs` with an optional `--landmarks <json>` input. For each stable `track_id`, corresponding landmarks are compared across adjacent frames using normalized 3D Euclidean displacement; mean, p95, and maximum displacement are reported.
- **Expected improvement:** Establish an objective landmark-stability metric that can be compared before and after smoothing or other measurement changes.
- **Actual result:** The new analysis path passed deterministic fixture validation. No real-camera landmark frame capture was available in this run, so production jitter remains unmeasured.
- **Metric:** Fixture path reported the expected displacement values; production `mean_displacement`, `p95_displacement`, and `max_displacement` require a stationary-subject landmark JSON export.
- **Regression:** The production build and baseline CLI remained functional. No camera regression assessment was possible.
- **Next action:** Capture at least 60 seconds of stationary-subject landmark frames under controlled lighting and record the resulting jitter metrics before proceeding to temporal smoothing.

## Day 3 — Temporal Smoothing

- **Date:** 2026-09-29
- **Feature:** Raw and EMA-smoothed head-pose signals
- **Problem:** The existing EMA path smoothed landmark-derived boxes, but pose values used by focus and expression logic were still represented only as raw values. Stability and responsiveness could not be compared explicitly.
- **Change:** Added per-track pose EMA smoothing with the existing default alpha of `0.3`. Each `FaceReading` now retains `rawPose` and exposes the smoothed pose as `pose`; the smoother also resets pose state together with landmark state.
- **Expected improvement:** Reduce frame-to-frame yaw, pitch, roll, and distance noise while preserving raw values for responsiveness and regression analysis.
- **Actual result:** The implementation compiled successfully in the production build. No real-camera motion sequence was available, so numerical stability gain and lag remain unmeasured.
- **Metric:** Runtime alpha is `0.3`; raw-versus-smoothed pose deltas require a real-camera CSV or telemetry capture.
- **Regression:** The build remained successful. Camera responsiveness, focus classification, and pose lag require manual validation.
- **Next action:** Run a controlled slow-motion and fast-motion camera session, compare raw and smoothed pose traces, then tune only if stability improves without unacceptable lag. Proceed to Day 4 adaptive smoothing afterward.

## Day 4 — Adaptive Smoothing

- **Date:** 2026-09-30
- **Feature:** Motion-adaptive pose EMA
- **Problem:** A fixed pose alpha applies the same amount of smoothing to stationary and fast-moving subjects, forcing a trade-off between stability and responsiveness.
- **Change:** Pose EMA now derives alpha from frame-to-frame yaw, pitch, and roll motion. Slow movement uses a `0.15` smoothing floor; faster movement increases alpha up to `0.7`. Each `FaceReading` records the applied `smoothingAlpha`.
- **Expected improvement:** Suppress stationary noise more strongly while reducing lag during rapid head movement.
- **Actual result:** The adaptive path compiled successfully in the production build. No real-camera motion sequence was available, so stability improvement and responsiveness change remain unmeasured.
- **Metric:** `MIN_POSE_ALPHA = 0.15`; `MAX_POSE_ALPHA = 0.7`; `MOTION_ALPHA_GAIN = 0.025`; runtime alpha is exposed per reading.
- **Regression:** Production build passed. Camera motion behavior, focus transitions, and alpha distribution require manual validation.
- **Next action:** Capture stationary, slow-turn, and fast-turn sessions; compare jitter, raw-to-smoothed lag, focus transitions, and observed alpha values before changing the bounds. Proceed to Day 5 confidence filtering afterward.

## Day 5 — Confidence Filtering

- **Date:** 2026-10-01
- **Feature:** Confidence-weighted pose, gaze, focus, and expression measurements
- **Problem:** Detector confidence was displayed and recorded but did not reduce the influence of uncertain detections on downstream attention and expression metrics.
- **Change:** Added a confidence weight: detections below `0.30` are rejected from gaze and focus calculations; `0.30–0.75` detections are pulled toward neutral and receive proportional expression suppression; `>=0.75` detections receive full weight. Raw smoothed pose remains available for diagnostics.
- **Expected improvement:** Reduce false gaze transitions, unstable focus scores, and overconfident expression labels when the detector is uncertain.
- **Actual result:** The confidence-filtered path compiled successfully in the production build. No real-camera low-confidence sequence was available, so behavior under occlusion or poor lighting remains unmeasured.
- **Metric:** `LOW_CONFIDENCE_CUTOFF = 0.30`; `FULL_CONFIDENCE_THRESHOLD = 0.75`; intermediate pose and expression weight is linearly scaled.
- **Regression:** Production build passed. Manual validation is still required for partial occlusion, low light, glasses, and face-at-edge scenarios.
- **Next action:** Run controlled low-confidence camera scenarios and compare rejected frames, gaze switching, focus stability, and expression false positives. Proceed to Day 6 face-detection stability afterward.
