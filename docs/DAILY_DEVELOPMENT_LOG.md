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
