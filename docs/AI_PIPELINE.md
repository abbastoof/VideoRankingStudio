# AI worker pipeline

Long-running or provider-bound work runs out-of-process in the workers app
(`apps/workers`, Python + Celery). The API app enqueues jobs and receives
progress updates via signed internal callbacks and a Redis pubsub channel.

## Why a separate process

- FFmpeg, Whisper, and provider SDKs live in a different runtime (CPython
  with system codecs) than the Fastify API.
- Job durations range from seconds (thumbnail) to tens of minutes (voice
  cloning, high-resolution export). Blocking the API event loop for any of
  those is unacceptable.
- Horizontal scaling for AI capacity is independent of API traffic — the
  worker pool grows on inference load, the API pool on request rate.

## Broker

Celery uses the broker at `BROKER_URL` (RabbitMQ in production, Redis in
dev via `redis://…`). The result backend is the same Redis endpoint.

Config lives in `apps/workers/src/vrs_workers/celery_app.py`. Notable
choices:

- `task_acks_late = True` and `task_reject_on_worker_lost = True` — a
  worker crash returns the task to the queue instead of dropping it.
- `worker_prefetch_multiplier = 1` — fair distribution for uneven job
  durations; long tasks don't starve short ones on the same worker.
- `worker_max_tasks_per_child = 200` — cycles child processes to bound
  memory drift from long-lived FFmpeg/Whisper handles.

## Queues

One queue per task class so we can scale, prioritise, and cap capacity per
work type independently. All queues are declared in `celery_app.py` and
routed by task name:

| Queue | Tasks | Typical worker profile |
| --- | --- | --- |
| `default` | Catch-all | 1× |
| `transcription` | `vrs.transcribe` | GPU or CPU-Whisper node |
| `tts` | `vrs.tts.generate` | Provider I/O bound |
| `voice_clone` | `vrs.voice.clone` | GPU-bound; slow |
| `highlights` | `vrs.highlights.detect` | LLM I/O bound |
| `image_gen` | `vrs.image.generate` | Provider I/O bound |
| `video_gen` | `vrs.video.generate` | Provider I/O bound, may poll for hours |
| `script_gen` | `vrs.script.generate`, `vrs.script.rewrite` | LLM I/O bound |
| `import_url` | `vrs.import.url` | Network + FFmpeg heavy |
| `export` | `vrs.export.render` | CPU + FFmpeg heavy |
| `thumbnails` | `vrs.thumbnail.generate` | Fast; image gen or FFmpeg still |
| `publish` | `vrs.publish.youtube`, `vrs.publish.tiktok` | Provider I/O |

Promote a queue to its own worker deployment by pointing that deployment's
`celery worker` command at `-Q <name>` and scaling it independently.

## Job lifecycle

Every job flows through the same states, all authoritative via the
`AiJob` row in Postgres:

`QUEUED → RUNNING → SUCCEEDED | FAILED | CANCELLED`

The web app never watches the DB directly. It subscribes to a Redis pubsub
channel keyed by `jobId`. The worker publishes progress on state
transitions and periodically during long tasks. The channel lives in
`apps/workers/src/vrs_workers/progress.py` and the API bridges it to the
browser through `/v1/ws`.

Every task is wrapped in `job_lifecycle` (`tasks/_base.py`) which:

1. Publishes `RUNNING` to Redis and to the API.
2. Provides a `report(progress, message)` callback for the task body.
3. On raise: publishes `FAILED` with the error message and re-raises so
   Celery retries or dead-letters it.
4. On success: the task calls `succeed(job_id, result)` which publishes
   `SUCCEEDED` with the result payload.

## API ↔ worker communication

- **Enqueue**: The API imports Celery task signatures and calls
  `task.apply_async` with the job id. It never puts business logic in the
  enqueue call — the worker re-reads state from the DB before executing.
- **Read state**: Workers call the internal REST surface at
  `/v1/internal/…` with the `INTERNAL_SERVICE_TOKEN` header. Those routes
  are not accessible without the token and are excluded from OpenAPI.
- **Update job**: `api_client.update_job(job_id, status, progress, result,
  error)` — updates the `AiJob` row and any denormalised state on the
  parent entity (`Transcript.status`, `Voiceover.status`, etc.).
- **Progress events**: Redis pubsub, JSON messages on
  `jobs:<jobId>` and (for fan-out) `projects:<projectId>`.

## Provider swapping

Every AI capability has a provider abstraction. The concrete provider is
selected by env at boot:

- `LLM_PROVIDER` — `anthropic` (default), `openai`, or `local`.
- `TTS_PROVIDER` — `elevenlabs`, `azure`, `polly`, `coqui`.
- `STT_PROVIDER` — `openai_whisper`, `local_whisper`, `google`, `deepgram`.
- `IMAGE_PROVIDER` — `stability`, `openai`, `replicate`, `local_sd`.
- `VIDEO_GEN_PROVIDER` — `runway`, `pika`, `replicate`, `disabled`.

Fallbacks live inside each provider module, not in the callers. A new
provider is one file plus one entry in the switch — no worker code changes.

## Retry, backoff, and dead-lettering

- Provider I/O failures raise a typed `AiProviderDown` and let Celery's
  retry policy handle backoff (exponential with jitter, capped at 5 tries).
- Non-retryable failures (bad input, quota exceeded) short-circuit to
  `FAILED` immediately.
- After max retries a job stays `FAILED` with the last error. There is no
  automatic re-enqueue — a human decides whether to retry from the admin
  console.

## Observability

- Every task emits structured logs (`vrs_workers.logging`) with `job_id`,
  `task`, and provider tags.
- Sentry captures unhandled exceptions with Celery integration.
- OTel spans wrap task execution when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

## Adding a new task

1. Create a task module under `apps/workers/src/vrs_workers/tasks/` that
   defines a Celery task under the `vrs.` namespace.
2. Wrap the body in `with job_lifecycle(job_id, kind) as report:` and call
   `report(progress)` at meaningful checkpoints.
3. Register the queue and route in `celery_app.py`.
4. Add the enqueue call in `apps/api/src/routes/generation.routes.ts` (or
   the relevant route).
5. Write an integration test with a stubbed provider under
   `apps/workers/tests/`.
