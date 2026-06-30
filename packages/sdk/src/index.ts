/**
 * @vrs/sdk — typed client for the VideoRankingStudio API.
 *
 * Works in browser + Node. Cookies are forwarded automatically when running
 * in the browser; on the server pass a `cookie` header via `defaultHeaders`.
 */

import type {
  Asset,
  AuthSession,
  CompleteUploadInput,
  CreateProject,
  ErrorCode,
  Export,
  GenerateScript,
  GenerateVoiceover,
  ImportUrl,
  Invoice,
  OtpRequest,
  OtpRequestResponse,
  OtpVerify,
  Plan,
  ProjectListQuery,
  ProjectSummary,
  RequestExport,
  RequestTranscription,
  StartCheckout,
  StartCheckoutResponse,
  Subscription,
  Template,
  Transcript,
  UploadInit,
  UploadInitResponse,
  UpdateProject,
  UsageSummary,
  Voice,
  Voiceover,
} from '@vrs/types';

// Some of the above are aliases not re-exported individually; locally redefine for
// clarity. Keep these in sync with @vrs/types when fields change.
type CompleteUploadInput = { assetId: string; sha256?: string };
type GenerateScript = { topic: string; tone?: string; durationMs?: number; format?: string; language?: string };
type StartCheckout = { planCode: 'CREATOR' | 'BUSINESS'; interval: 'MONTH' | 'YEAR'; successUrl: string; cancelUrl: string };

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

  // ────── Projects ──────
  listProjects(query?: Partial<ProjectListQuery>) {
    return this.request<Page<ProjectSummary>>('GET', '/v1/projects', { query });
  }
  createProject(body: CreateProject) {
    return this.request<ProjectSummary>('POST', '/v1/projects', { body });
  }
  getProject(id: string) {
    return this.request('GET', `/v1/projects/${id}`);
  }
  updateProject(id: string, body: UpdateProject) {
    return this.request('PATCH', `/v1/projects/${id}`, { body });
  }
  deleteProject(id: string) {
    return this.request('DELETE', `/v1/projects/${id}`);
  }
  duplicateProject(id: string) {
    return this.request<ProjectSummary>('POST', `/v1/projects/${id}/duplicate`);
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
  listTemplates(query?: { category?: string; cursor?: string; limit?: number; sortBy?: 'popularity' | 'createdAt' }) {
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
    return this.request<StartCheckoutResponse>('POST', '/v1/billing/checkout', { body });
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
      const err = (payload as { error?: { code?: string; message?: string; requestId?: string; details?: unknown } })?.error;
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
