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

The runtime preserves both `rawPose` and EMA-smoothed `pose` values for each face reading. The current default alpha is `0.3`: lower values increase stability but can reduce responsiveness, while higher values track motion more quickly with less smoothing. A real-camera motion scenario should compare raw and smoothed yaw, pitch, roll, and distance before changing this parameter.

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
