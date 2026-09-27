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
