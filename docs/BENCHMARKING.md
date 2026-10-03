# Baseline Benchmarking

The baseline harness records reproducible performance measurements without fabricating unavailable data.

## 1. Install dependencies and build

```sh
npm install
npm run build
```

The build duration and pass/fail status are recorded whenever the baseline script runs.

## 2. Run a real-camera session

1. Start the application with `npm run dev`.
2. Open the local URL in a supported browser.
3. Run a controlled scenario, such as normal lighting, for at least 60 seconds.
4. Export the session CSV from the application.

Recommended first scenarios are:

- `normal-light`
- `low-light`
- `bright-light`
- `glasses`
- `different-distance`
- `head-movement`
- `fast-movement`
- `multi-face`

## 3. Generate the baseline report

```sh
npm run baseline -- \
  --input artifacts/normal-light.csv \
  --output artifacts/baseline-v2.5.json \
  --scenario normal-light
```

The report contains only measurements available in the CSV. Missing fields remain `null`; the script never substitutes synthetic values.

## 4. Measure landmark jitter

For a stationary subject, export consecutive landmark frames as a JSON array and pass the file to the same harness:

```sh
npm run baseline -- \
  --landmarks artifacts/stationary-face-landmarks.json \
  --output artifacts/baseline-v2.5.json \
  --scenario stationary-face
```

Each frame must contain a `landmarks` array with normalized MediaPipe points (`x`, `y`, and optional `z`). Frames with the same `track_id` are compared point by point. The report includes mean, p95, and maximum Euclidean frame-to-frame displacement. A smaller displacement indicates less landmark jitter, but comparisons are valid only when camera, subject, distance, lighting, and frame rate are held constant.

## 5. Temporal pose smoothing

The runtime preserves both `rawPose` and EMA-smoothed `pose` values for each face reading. Pose smoothing is adaptive: stationary frames use a stronger smoothing floor of `0.15`, while faster yaw/pitch/roll motion increases alpha up to `0.7` to reduce lag. Each reading exposes the applied `smoothingAlpha`. A real-camera motion scenario should compare raw and smoothed yaw, pitch, roll, distance, and alpha before changing these bounds.

## 6. Confidence filtering

Downstream measurements use detector confidence as an evidence weight. Confidence below `0.30` is rejected from gaze and focus calculations. Confidence from `0.30` through `0.75` pulls pose deviations toward neutral and proportionally suppresses expression scores. Confidence at or above `0.75` receives full weight. The raw smoothed pose remains available for diagnostics, while attention metrics use the confidence-filtered pose.

## 7. Face detection stability

High-resolution telemetry now records agreement between the landmark model and the independent face detector for every frame: landmark face count, detector face count, matched count, candidate detector misses, and candidate unmatched detections. These counters are diagnostic candidates rather than false-positive or false-negative ground truth. Run separate controlled sessions for edge-of-frame, turned-away, distant, and partially occluded faces, then compare the candidate miss rates under the same camera and lighting conditions.

## 8. Track-ID stability

The tracker records observed faces, retained matches, newly created tracks, unmatched previous tracks, and active tracks for every frame. Use these fields to calculate ID churn during fast head movement, two-person crossing, exit/re-entry, and face-intersection scenarios. A new track is an observable continuity break, not proof of an identity switch; identity claims require labeled video review.

## Metrics

When the exported CSV contains the relevant columns, the report calculates:

- FPS: mean and 5th percentile
- Inference latency: mean and 95th percentile
- Face detection rate
- Detection confidence: mean, median, and 95th percentile
- Focus score: mean and mean absolute change between samples
- Gaze switching frequency
- Track-ID continuity
- CPU usage: mean and 95th percentile
- Memory usage: mean and peak
- Production build duration and status
- Landmark jitter: mean, p95, and maximum normalized displacement
- Candidate detector misses and unmatched detections per frame
- Retained, new, unmatched-previous, and active track counts per frame

The current application export is expected to provide fields such as `second`, `timestamp`, `has_face`, `confidence`, `yaw_deg`, `pitch_deg`, `gaze`, and `focus_score`. Runtime instrumentation fields such as `fps`, `inference_latency_ms`, `cpu_percent`, `memory_mb`, and `track_id` are consumed automatically when they are added to the export schema.

## Reproducibility requirements

Record the following with every baseline run:

- Browser and version
- Operating system
- CPU and GPU
- Camera model and resolution
- Lighting scenario
- Subject-to-camera distance
- GPU or CPU delegate
- Model and application commit SHA
- Test duration

A baseline is valid only when its environment and scenario are documented. Do not compare reports produced under materially different conditions without labeling the difference.
