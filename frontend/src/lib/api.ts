import { getIdToken } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = await getIdToken();
    if (!token) throw new Error('Not authenticated');
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────
export const publicApi = {
  getStatus: (slug: string) =>
    request<PublicStatusResponse>(`/public/status/${slug}`),
  getHistory: (slug: string) =>
    request<{ incidents: Incident[] }>(`/public/status/${slug}/history`),
};

// ─── Admin API ────────────────────────────────────────────────────────────
export const adminApi = {
  // Org
  getOrg: () => request<{ org: Org }>('/admin/org', {}, true),
  createOrg: (data: CreateOrgInput) =>
    request<{ org: Org }>('/admin/org', { method: 'POST', body: JSON.stringify(data) }, true),
  updateOrg: (data: UpdateOrgInput) =>
    request<{ org: Org }>('/admin/org', { method: 'PUT', body: JSON.stringify(data) }, true),

  // Monitors
  listMonitors: () => request<{ monitors: Monitor[] }>('/admin/monitors', {}, true),
  createMonitor: (data: CreateMonitorInput) =>
    request<{ monitor: Monitor }>('/admin/monitors', { method: 'POST', body: JSON.stringify(data) }, true),
  updateMonitor: (id: string, data: Partial<CreateMonitorInput> & { enabled?: boolean }) =>
    request<{ monitor: Monitor }>(`/admin/monitors/${id}`, { method: 'PUT', body: JSON.stringify(data) }, true),
  deleteMonitor: (id: string) =>
    request<void>(`/admin/monitors/${id}`, { method: 'DELETE' }, true),
  getMonitorChecks: (id: string) =>
    request<{ checks: CheckResult[] }>(`/admin/monitors/${id}/checks`, {}, true),
  getMonitorUptime: (id: string, days = 30) =>
    request<{ days: DayUptime[]; overall: OverallUptime }>(`/admin/monitors/${id}/uptime?days=${days}`, {}, true),

  // Incidents
  listIncidents: (status?: 'open' | 'all') =>
    request<{ incidents: Incident[] }>(`/admin/incidents${status === 'open' ? '?status=open' : ''}`, {}, true),
  createIncident: (data: CreateIncidentInput) =>
    request<{ incident: Incident }>('/admin/incidents', { method: 'POST', body: JSON.stringify(data) }, true),
  updateIncident: (id: string, data: UpdateIncidentInput) =>
    request<{ incident: Incident }>(`/admin/incidents/${id}`, { method: 'PUT', body: JSON.stringify(data) }, true),
  getIncident: (id: string) =>
    request<{ incident: Incident; updates: IncidentUpdate[] }>(`/admin/incidents/${id}`, {}, true),
  deleteIncident: (id: string) =>
    request<void>(`/admin/incidents/${id}`, { method: 'DELETE' }, true),
};

// ─── Types ────────────────────────────────────────────────────────────────
export interface Org {
  tenantId: string;
  slug: string;
  name: string;
  notifyEmail: string;
  createdAt: string;
  snsSubscriptionConfirmed: boolean;
}

export interface Monitor {
  monitorId: string;
  name: string;
  url: string;
  method: string;
  expectedStatus: number;
  timeoutMs: number;
  currentStatus: string;
  lastCheckedAt: string | null;
  enabled: boolean;
}

export interface Incident {
  incidentId: string;
  title: string;
  status: string;
  impact: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface IncidentUpdate {
  updateId: string;
  message: string;
  status: string;
  createdAt: string;
}

export interface DayUptime {
  date: string;
  checks: number;
  successes: number;
  uptime: number | null;
  avgLatency: number | null;
}

export interface OverallUptime {
  uptime: number | null;
  avgLatency: number | null;
  totalChecks: number;
}

export interface CheckResult {
  checkedAt: string;
  success: boolean;
  latencyMs: number;
  statusCode: number | null;
}

export interface PublicStatusResponse {
  org: { name: string; slug: string };
  overallStatus: string;
  monitors: PublicMonitor[];
  activeIncidents: Incident[];
}

export interface PublicMonitor {
  monitorId: string;
  name: string;
  url: string;
  currentStatus: string;
  lastCheckedAt: string | null;
  uptimePercent: number | null;
  recentChecks: { checkedAt: string; success: boolean; latencyMs: number }[];
}

export type CreateOrgInput = { name: string; slug: string; notifyEmail: string };
export type UpdateOrgInput = { name?: string; notifyEmail?: string };
export type CreateMonitorInput = { name: string; url: string; method?: string; expectedStatus?: number; timeoutMs?: number };
export type CreateIncidentInput = { title: string; status: string; impact: string; monitorId?: string; message: string };
export type UpdateIncidentInput = { title?: string; status?: string; impact?: string; message: string };
