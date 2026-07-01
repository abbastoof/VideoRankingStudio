/**
 * @vrs/sdk — typed client for the VideoRankingStudio API.
 *
 * Works in browser + Node. Cookies are forwarded automatically when running
 * in the browser; on the server pass a `cookie` header via `defaultHeaders`.
 */

import type {
  AiJob,
  Asset,
  AuthSession,
  CreateClip,
  CreateProject,
  CreateTrack,
  EnqueueJobResponse,
  ErrorCode,
  GenerateHighlights,
  GenerateImageInput,
  GenerateScript,
  GenerateThumbnail,
  GenerateVideo,
  GenerateVoiceover,
  ImportUrl,
  Invoice,
  MoveClip,
  OtpRequest,
  OtpRequestResponse,
  OtpVerify,
  Plan,
  ProjectListQuery,
  ProjectSummary,
  ReorderClips,
  RequestExport,
  RequestTranscription,
  RewriteScript,
  Subscription,
  Template,
  Timeline,
  UpdateClip,
  UpdateProfile,
  UpdateProject,
  UpdateTrack,
  UploadInit,
  UploadInitResponse,
  UsageSummary,
  UserProfile,
} from '@vrs/types';

type CompleteUploadInput = { assetId: string; sha256?: string };
type StartCheckout = {
  planCode: 'CREATOR' | 'BUSINESS';
  interval: 'MONTH' | 'YEAR';
  successUrl: string;
  cancelUrl: string;
};

export class SdkError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode | string,
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'SdkError';
  }
}

export interface SdkOptions {
  baseUrl: string;
  fetchFn?: typeof fetch;
  defaultHeaders?: Record<string, string>;
  onUnauthorized?: () => void;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ExportSummary {
  id: string;
  format: string;
  resolutionW: number;
  resolutionH: number;
  fps: number;
  durationMs: number | null;
  sizeBytes: number | null;
  status: string;
  progress: number;
  watermark: boolean;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ExportDetail extends ExportSummary {
  projectId: string;
  downloadUrl: string | null;
  expiresAt: string | null;
}

export class VrsClient {
  constructor(private readonly opts: SdkOptions) {}

  // ────── Auth ──────
  authOtpRequest(body: OtpRequest) {
    return this.request<OtpRequestResponse>('POST', '/v1/auth/otp/request', { body });
  }
  authOtpVerify(body: OtpVerify) {
    return this.request<AuthSession>('POST', '/v1/auth/otp/verify', { body });
  }
  authRefresh() {
    return this.request<{ expiresAt: string }>('POST', '/v1/auth/refresh');
  }
  authSignOut() {
    return this.request<{ ok: true }>('POST', '/v1/auth/signout');
  }
  session() {
    return this.request<AuthSession>('GET', '/v1/auth/session');
  }

  // ────── Users ──────
  getMe() {
    return this.request<UserProfile>('GET', '/v1/users/me');
  }
  updateMe(body: UpdateProfile) {
    return this.request<UserProfile>('PATCH', '/v1/users/me', { body });
  }
  listSessions() {
    return this.request<Page<{ id: string; userAgent: string | null; ip: string | null; createdAt: string; lastUsedAt: string; expiresAt: string; current: boolean }>>('GET', '/v1/users/me/sessions');
  }
  revokeSession(id: string) {
    return this.request<void>('DELETE', `/v1/users/me/sessions/${id}`);
  }
  revokeAllSessions() {
    return this.request<{ ok: true }>('POST', '/v1/users/me/sessions/revoke-all');
  }
  deleteAccount() {
    return this.request<void>('DELETE', '/v1/users/me');
  }

  // ────── Projects ──────
  listProjects(query?: Partial<ProjectListQuery>) {
    return this.request<Page<ProjectSummary>>('GET', '/v1/projects', { query });
  }
  createProject(body: CreateProject) {
    return this.request<ProjectSummary>('POST', '/v1/projects', { body });
  }
  getProject(id: string) {
    return this.request<ProjectSummary & { description: string | null; scriptText: string | null; settingsJson: Record<string, unknown>; templateId: string | null; updatedAt: string }>('GET', `/v1/projects/${id}`);
  }
  updateProject(id: string, body: UpdateProject) {
    return this.request('PATCH', `/v1/projects/${id}`, { body });
  }
  deleteProject(id: string) {
    return this.request<void>('DELETE', `/v1/projects/${id}`);
  }
  duplicateProject(id: string) {
    return this.request<ProjectSummary>('POST', `/v1/projects/${id}/duplicate`);
  }

  // ────── Timeline ──────
  getTimeline(id: string) {
    return this.request<Timeline & { tracks: Array<{ clips: Array<Record<string, unknown>> }> }>(
      'GET',
      `/v1/projects/${id}/timeline`,
    );
  }
  createTrack(id: string, body: CreateTrack) {
    return this.request('POST', `/v1/projects/${id}/tracks`, { body });
  }
  updateTrack(id: string, trackId: string, body: UpdateTrack) {
    return this.request('PATCH', `/v1/projects/${id}/tracks/${trackId}`, { body });
  }
  deleteTrack(id: string, trackId: string) {
    return this.request<void>('DELETE', `/v1/projects/${id}/tracks/${trackId}`);
  }
  createClip(id: string, body: CreateClip) {
    return this.request('POST', `/v1/projects/${id}/clips`, { body });
  }
  updateClip(id: string, clipId: string, body: UpdateClip) {
    return this.request('PATCH', `/v1/projects/${id}/clips/${clipId}`, { body });
  }
  moveClip(id: string, clipId: string, body: MoveClip) {
    return this.request('POST', `/v1/projects/${id}/clips/${clipId}/move`, { body });
  }
  splitClip(id: string, clipId: string, atMs: number) {
    return this.request('POST', `/v1/projects/${id}/clips/${clipId}/split`, { body: { atMs } });
  }
  deleteClip(id: string, clipId: string) {
    return this.request<void>('DELETE', `/v1/projects/${id}/clips/${clipId}`);
  }
  reorderClips(id: string, body: ReorderClips) {
    return this.request('POST', `/v1/projects/${id}/clips/reorder`, { body });
  }

  // ────── AI generation ──────
  generateHighlights(id: string, body: GenerateHighlights) {
    return this.request<EnqueueJobResponse>('POST', `/v1/projects/${id}/generate/highlights`, { body });
  }
  generateTranscription(id: string, body: RequestTranscription) {
    return this.request<{ transcriptId: string; jobId: string }>('POST', `/v1/projects/${id}/generate/transcribe`, { body });
  }
  generateVoiceover(id: string, body: GenerateVoiceover) {
    return this.request<{ voiceoverId: string; jobId: string }>('POST', `/v1/projects/${id}/generate/voice`, { body });
  }
  generateScript(id: string, body: GenerateScript) {
    return this.request<EnqueueJobResponse>('POST', `/v1/projects/${id}/generate/script`, { body });
  }
  rewriteScript(id: string, body: RewriteScript) {
    return this.request<EnqueueJobResponse>('POST', `/v1/projects/${id}/generate/rewrite`, { body });
  }
  generateImage(id: string, body: GenerateImageInput) {
    return this.request<EnqueueJobResponse>('POST', `/v1/projects/${id}/generate/image`, { body });
  }
  generateVideo(id: string, body: GenerateVideo) {
    return this.request<EnqueueJobResponse>('POST', `/v1/projects/${id}/generate/video`, { body });
  }
  generateThumbnail(id: string, body: GenerateThumbnail) {
    return this.request<{ jobId: string; thumbnailKey: string }>('POST', `/v1/projects/${id}/generate/thumbnail`, { body });
  }
  requestExport(id: string, body: RequestExport) {
    return this.request<{ exportId: string; jobId: string; title: string }>('POST', `/v1/projects/${id}/export`, { body });
  }
  listExports(projectId: string) {
    return this.request<Page<ExportSummary>>('GET', `/v1/projects/${projectId}/exports`);
  }
  getExport(exportId: string) {
    return this.request<ExportDetail>('GET', `/v1/exports/${exportId}`);
  }

  // ────── Jobs ──────
  getJob(jobId: string) {
    return this.request<AiJob>('GET', `/v1/jobs/${jobId}`);
  }
  cancelJob(jobId: string) {
    return this.request<{ ok: true }>('POST', `/v1/jobs/${jobId}/cancel`);
  }
  retryJob(jobId: string) {
    return this.request<EnqueueJobResponse>('POST', `/v1/jobs/${jobId}/retry`);
  }

  // ────── Uploads & assets ──────
  initUpload(body: UploadInit) {
    return this.request<UploadInitResponse>('POST', '/v1/uploads/init', { body });
  }
  completeUpload(body: CompleteUploadInput) {
    return this.request<Asset>('POST', '/v1/uploads/complete', { body });
  }
  importFromUrl(body: ImportUrl) {
    return this.request<{ assetId: string; jobId: string }>('POST', '/v1/uploads/import', { body });
  }
  listAssets(query?: { projectId?: string; cursor?: string; limit?: number }) {
    return this.request<Page<Asset>>('GET', '/v1/assets', { query });
  }
  getAsset(id: string) {
    return this.request<Asset>('GET', `/v1/assets/${id}`);
  }

  // ────── Templates ──────
  listTemplates(query?: {
    category?: string;
    cursor?: string;
    limit?: number;
    sortBy?: 'popularity' | 'createdAt';
  }) {
    return this.request<Page<Template>>('GET', '/v1/templates', { query });
  }
  getTemplate(slug: string) {
    return this.request<Template & { blueprintJson: Record<string, unknown> }>('GET', `/v1/templates/${slug}`);
  }

  // ────── Billing ──────
  listPlans() {
    return this.request<Page<Plan>>('GET', '/v1/billing/plans');
  }
  getSubscription() {
    return this.request<Subscription | null>('GET', '/v1/billing/subscription');
  }
  getUsage() {
    return this.request<Page<UsageSummary>>('GET', '/v1/billing/usage');
  }
  listInvoices() {
    return this.request<Page<Invoice>>('GET', '/v1/billing/invoices');
  }
  startCheckout(body: StartCheckout) {
    return this.request<{ checkoutUrl: string }>('POST', '/v1/billing/checkout', { body });
  }
  openPortal(body?: { returnUrl?: string }) {
    return this.request<{ portalUrl: string }>('POST', '/v1/billing/portal', { body });
  }
  cancelSubscription(body: { reason?: string; immediate?: boolean }) {
    return this.request<{ ok: true }>('POST', '/v1/billing/cancel', { body });
  }

  // Generic request handler.
  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, unknown> | undefined;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    } = {},
  ): Promise<T> {
    const fetchFn = this.opts.fetchFn ?? fetch;
    const url = new URL(path, this.opts.baseUrl);
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...this.opts.defaultHeaders,
      ...options.headers,
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetchFn(url.toString(), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
      signal: options.signal,
    });

    if (res.status === 204) return undefined as T;
    const contentType = res.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json') ? await res.json() : null;

    if (!res.ok) {
      if (res.status === 401) this.opts.onUnauthorized?.();
      const err = (payload as {
        error?: { code?: string; message?: string; requestId?: string; details?: unknown };
      })?.error;
      throw new SdkError(
        res.status,
        err?.code ?? 'UNKNOWN_ERROR',
        err?.message ?? `Request failed with ${res.status}`,
        err?.details,
        err?.requestId,
      );
    }
    return payload as T;
  }
}

export function createClient(opts: SdkOptions): VrsClient {
  return new VrsClient(opts);
}
