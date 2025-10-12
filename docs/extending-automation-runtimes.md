<!-- docs/extending-automation-runtimes.md Purpose: Document strategies for supporting automation frameworks beyond Playwright. -->

# Extending Automation Runtimes Beyond Playwright

## Why expand beyond Playwright?

Playwright is a strong default for browser-centric flows, but some hiring workflows need richer environments:

- **Native desktop or mobile apps** require automation frameworks like Appium or Selenium Grid.
- **Specialized headless APIs** (e.g., job board partner APIs, applicant tracking systems) can be more stable than DOM scraping.
- **General-purpose scripting** (resume tailoring, PDF edits, CLI tools) benefits from shell or Python runtimes with access to local files.

Extending the automation surface gives Claude more specialized “hands” for jobs that Playwright alone cannot accomplish.

## High-level architecture additions

1. **Create a new service container** for each runtime (e.g., `automation-runner`). Mirror the existing `browser-service` pattern: Express (or Fastify) HTTP API, API key auth, health checks, and streaming-friendly JSON responses.
2. **Package runtime dependencies** in the Dockerfile. For Python tooling, include `poetry`/`pip`, `opencv`, etc. For Appium, install Node + Java + Android SDK layers. Keep the base image Ubuntu/Debian for parity with the Playwright container.
3. **Expose dedicated endpoints** for each capability—e.g., `/api/run-script`, `/api/apply/linkedin`, `/api/pdf/fill`. Ensure each endpoint validates input payloads and caps execution time.
4. **Mount persistent volumes** when state is required (e.g., cached resumes, job submission logs) and isolate secrets via environment variables, never hard-coded.
5. **Integrate with Claude tools** by adding new entries to `lib/browser-tools.ts` (or creating a new `lib/runtime-tools.ts`) that proxy requests to the new service. Update `lib/claude-agent.ts` to map tool invocations to HTTP calls.

## Suggested runtime expansions

### 1. Script Runner (Node + Python)
- Dockerfile installs Node 20, Python 3.11, `pipx`, and job-specific CLIs.
- API accepts a script reference (stored in Git or S3), input parameters, and optional secrets.
- Use Firecracker/`node:child_process` sandboxes or `docker run` sub-containers for untrusted code.
- Return stdout/stderr logs and artifacts via signed URLs.

### 2. App Automation (Appium/Selenium)
- Base image extends the Playwright container with Java 17, Android SDK, and iOS simulators (if macOS runners available).
- API exposes endpoints like `/api/mobile/launch`, `/api/mobile/tap`, `/api/mobile/screenshot`.
- Reuse the tool invocation loop so Claude can chain `launch → tap → fill → submit` on native apps.

### 3. Headless API Integrator
- Lightweight Node service that brokers OAuth tokens and REST/GraphQL calls to partner job boards or ATS APIs.
- Provides idempotent endpoints (`/api/ats/applications`) with rate limiting and auditing.
- Offloads credential storage to a managed secrets vault (Railway variables, AWS Secrets Manager, etc.).

### 4. Document Processing Worker
- Python-focused container with libraries like `pdfplumber`, `docx`, `pandas`, `spacy`.
- Accepts requests to tailor resumes, extract structured data, or generate cover letters.
- Uses object storage (S3, GCS) for large artifacts; responses contain references Claude can surface to the user.

## Operational considerations

- **Queueing & orchestration**: For longer jobs, put a queue (BullMQ, RabbitMQ, Temporal) between the Next.js app and the worker. Return a job ID immediately, then stream progress updates to the UI via Supabase realtime or Pusher.
- **Observability**: Standardize logging/metrics with OpenTelemetry and aggregate in Grafana/Prometheus. Include job IDs in logs so Claude can request transcripts when debugging.
- **Security**: Enforce API keys, mTLS, or private networking between Vercel and the worker containers. Sanitize all user inputs before passing to shell/script runners. Avoid `eval`/`exec` on raw user text.
- **Resource limits**: Configure per-endpoint timeouts and memory/CPU ceilings. Use Kubernetes HPA or Railway autoscaling to spin up workers on demand.

## Updating the Claude agent toolchain

1. Add new tool definitions (`type`, `description`, `input_schema`) describing the runtime’s capabilities.
2. Update `lib/claude-agent.ts` so the tool execution loop can dispatch to the new service and stream intermediate status messages back into the chat.
3. Teach the system prompt to describe when each tool should be used. Provide clear affordances like “Use `document_tailor` for resume edits; fall back to browser navigation otherwise.”
4. Include regression tests (Vitest or integration scripts) covering the tool invocation path to avoid breaking existing Playwright flows.

## Deployment strategy

- Build each service as its own Docker image and publish to a registry (GHCR, ECR, Railway).
- Use infrastructure-as-code (Terraform, Pulumi) or Railway templates to provision environments consistently.
- Wire environment variables (`SCRIPT_RUNNER_URL`, `DOCUMENT_WORKER_URL`) into Vercel so the Next.js app can reach new services.
- Document the deployment playbook alongside `RAILWAY_DEPLOYMENT.md`, including scaling knobs and rollback steps.

By following the existing browser service pattern, you can layer additional specialized automation runtimes without overloading Vercel serverless functions, giving Claude a toolbox that spans browsers, native apps, APIs, and heavy compute workflows.
