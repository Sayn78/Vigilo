export type MonitorStatus = 'operational' | 'degraded' | 'outage' | 'unknown';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type IncidentImpact = 'none' | 'minor' | 'major' | 'critical';

export interface Org {
  tenantId: string;
  slug: string;
  name: string;
  ownerEmail: string;
  notifyEmail: string;
  snsTopicArn: string;
  snsConfirmedAt?: string; // ISO timestamp cached when SNS email subscription is confirmed
  createdAt: string;
  updatedAt: string;
}

export interface Monitor {
  monitorId: string;
  tenantId: string;
  name: string;
  url: string;
  method: 'GET' | 'HEAD' | 'POST';
  expectedStatus: number;
  timeoutMs: number;
  currentStatus: MonitorStatus;
  lastCheckedAt: string | null;
  createdAt: string;
  enabled: string; // 'true' | 'false' (string for GSI sort key compatibility)
  entityType: 'MONITOR'; // constant for EnabledMonitorsIndex GSI
}

export interface Incident {
  incidentId: string;
  tenantId: string;
  title: string;
  status: IncidentStatus;
  impact: IncidentImpact;
  monitorId?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface IncidentUpdate {
  updateId: string;
  incidentId: string;
  tenantId: string;
  message: string;
  status: IncidentStatus;
  createdAt: string;
  createdBy: string;
}

export interface CheckResult {
  monitorId: string;
  tenantId: string;
  checkedAt: string;
  statusCode: number | null;
  latencyMs: number;
  success: boolean;
  error?: string;
  ttl: number;
}
