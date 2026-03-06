'use client';
import { useEffect, useState } from 'react';
import { adminApi, Monitor, CreateMonitorInput, CheckResult } from '@/lib/api';
import { useTranslation } from '@/lib/i18n-context';

const STATUS_COLORS: Record<string, string> = {
  operational: '#00e5a0',
  degraded: '#f59e0b',
  outage: '#ff4d6d',
  unknown: '#52525b',
};

export default function MonitorsPage() {
  const { t } = useTranslation();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null);
  const [loading, setLoading] = useState(true);

  // History
  const [showHistoryId, setShowHistoryId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<Record<string, CheckResult[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  useEffect(() => {
    adminApi.listMonitors().then((r) => {
      setMonitors(r.monitors);
      setLoading(false);
    });
  }, []);

  async function handleCreate(data: CreateMonitorInput) {
    const r = await adminApi.createMonitor(data);
    setMonitors((prev) => [...prev, r.monitor]);
    setShowForm(false);
  }

  async function handleUpdate(id: string, data: CreateMonitorInput) {
    const r = await adminApi.updateMonitor(id, data);
    setMonitors((prev) => prev.map((m) => (m.monitorId === id ? r.monitor : m)));
    setEditingMonitor(null);
  }

  async function handleDelete(id: string) {
    if (!confirm(t('dashboard.deleteConfirm'))) return;
    await adminApi.deleteMonitor(id);
    setMonitors((prev) => prev.filter((m) => m.monitorId !== id));
  }

  async function handleToggle(monitor: Monitor) {
    const r = await adminApi.updateMonitor(monitor.monitorId, { enabled: !monitor.enabled });
    setMonitors((prev) => prev.map((m) => (m.monitorId === monitor.monitorId ? r.monitor : m)));
  }

  async function handleShowHistory(id: string) {
    if (showHistoryId === id) {
      setShowHistoryId(null);
      return;
    }
    setShowHistoryId(id);
    if (!historyData[id]) {
      setHistoryLoading(id);
      try {
        const r = await adminApi.getMonitorChecks(id);
        setHistoryData((prev) => ({ ...prev, [id]: r.checks }));
      } finally {
        setHistoryLoading(null);
      }
    }
  }

  if (loading)
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
        {t('dashboard.loading')}
      </div>
    );

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">{t('nav.monitors')}</h1>
        <button
          onClick={() => { setShowForm(true); setEditingMonitor(null); }}
          className="btn-accent px-4 py-2"
        >
          {t('dashboard.addMonitor')}
        </button>
      </div>

      {showForm && (
        <MonitorForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}

      {monitors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <p className="text-sm text-zinc-500">{t('dashboard.noMonitorsYet')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {monitors.map((m) => {
            const color = STATUS_COLORS[m.currentStatus] ?? STATUS_COLORS.unknown;
            const isEditing = editingMonitor?.monitorId === m.monitorId;
            const isShowingHistory = showHistoryId === m.monitorId;
            return (
              <div key={m.monitorId}>
                <div className="card-hover px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}
                        />
                        <p className="font-medium text-zinc-100">{m.name}</p>
                        <StatusBadge status={m.currentStatus} />
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-zinc-500">{m.url}</p>
                      <p className="mt-0.5 text-xs text-zinc-600">
                        {m.method} · {m.expectedStatus} · {m.timeoutMs}ms
                        {m.lastCheckedAt && ` · ${new Date(m.lastCheckedAt).toLocaleTimeString()}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleToggle(m)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          m.enabled
                            ? 'hover:opacity-80'
                            : 'border border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                        }`}
                        style={
                          m.enabled
                            ? { backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }
                            : {}
                        }
                      >
                        {m.enabled ? t('dashboard.enabled') : t('dashboard.disabled')}
                      </button>
                      <button
                        onClick={() => handleShowHistory(m.monitorId)}
                        className={`text-xs transition-colors ${
                          isShowingHistory ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-100'
                        }`}
                      >
                        {t('dashboard.viewHistory')}
                      </button>
                      <button
                        onClick={() => {
                          setEditingMonitor(isEditing ? null : m);
                          setShowForm(false);
                        }}
                        className="text-xs text-zinc-500 transition-colors hover:text-zinc-100"
                      >
                        {t('dashboard.edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(m.monitorId)}
                        className="text-xs text-zinc-600 transition-colors hover:text-red-400"
                      >
                        {t('dashboard.delete')}
                      </button>
                    </div>
                  </div>
                </div>

                {isShowingHistory && (
                  <div className="mb-1 ml-4 border-l-2 border-zinc-800 pl-4">
                    <div className="card mt-1 p-4">
                      <MonitorHistoryPanel
                        monitorId={m.monitorId}
                        checks={historyData[m.monitorId] ?? []}
                        loading={historyLoading === m.monitorId}
                      />
                    </div>
                  </div>
                )}

                {isEditing && (
                  <div className="mb-2 ml-4 border-l-2 border-zinc-800 pl-4">
                    <MonitorForm
                      initial={m}
                      onSubmit={(data) => handleUpdate(m.monitorId, data)}
                      onCancel={() => setEditingMonitor(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MonitorHistoryPanel({
  monitorId,
  checks,
  loading,
}: {
  monitorId: string;
  checks: CheckResult[];
  loading: boolean;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
        {t('dashboard.loading')}
      </div>
    );
  }

  if (checks.length === 0) {
    return <p className="py-3 text-sm text-zinc-600">{t('dashboard.noChecksYet')}</p>;
  }

  // API returns newest-first; display oldest→newest left→right
  const sorted = [...checks].reverse();
  const successCount = sorted.filter((c) => c.success).length;
  const uptimePct = Math.round((successCount / sorted.length) * 1000) / 10;
  const validLatencies = sorted.filter((c) => c.success && c.latencyMs > 0);
  const avgLatency =
    validLatencies.length > 0
      ? Math.round(validLatencies.reduce((s, c) => s + c.latencyMs, 0) / validLatencies.length)
      : 0;

  // SVG latency chart
  const W = 600;
  const H = 56;
  const maxLat = Math.max(...validLatencies.map((c) => c.latencyMs), 1);
  const chartPoints = sorted.map((c, i) => {
    const x = sorted.length === 1 ? W / 2 : (i / (sorted.length - 1)) * W;
    const y =
      c.success && c.latencyMs > 0
        ? H - (c.latencyMs / maxLat) * (H - 8) - 2
        : H - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polylinePoints = chartPoints.join(' ');
  const areaPoints = `0,${H} ${polylinePoints} ${W},${H}`;
  const gradId = `latgrad-${monitorId.replace(/-/g, '')}`;
  const uptimeColor = uptimePct >= 99 ? '#00e5a0' : uptimePct >= 95 ? '#f59e0b' : '#ff4d6d';

  return (
    <div className="space-y-3">
      {/* Uptime bars strip */}
      <div className="flex gap-px" style={{ height: 20 }}>
        {sorted.map((c, i) => (
          <div
            key={i}
            title={`${new Date(c.checkedAt).toLocaleString()}${c.latencyMs ? ` — ${c.latencyMs}ms` : ''}`}
            style={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              backgroundColor: c.success ? '#00e5a0' : '#ff4d6d',
              borderRadius: 2,
              opacity: c.success ? 0.6 : 0.9,
            }}
          />
        ))}
      </div>

      {/* Stats */}
      <div className="flex gap-5 text-xs">
        <span style={{ color: uptimeColor }}>
          {uptimePct}% {t('status.uptime')}
        </span>
        <span className="text-zinc-500">
          {t('dashboard.avgLatency')}: {avgLatency}ms
        </span>
        <span className="text-zinc-600">
          {sorted.length} {t('dashboard.checksCount')}
        </span>
      </div>

      {/* Latency sparkline */}
      {sorted.length >= 2 && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full rounded"
          style={{ height: 56, display: 'block' }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00e5a0" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#00e5a0" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* mid grid line */}
          <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#27272a" strokeWidth="1" />
          {/* area fill */}
          <polygon points={areaPoints} fill={`url(#${gradId})`} />
          {/* line */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#00e5a0"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* max latency label */}
          <text x="4" y="12" fill="#52525b" fontSize="10" fontFamily="monospace">
            {maxLat}ms
          </text>
        </svg>
      )}
    </div>
  );
}

function MonitorForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Monitor;
  onSubmit: (d: CreateMonitorInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [url, setUrl] = useState(initial?.url ?? 'https://');
  const [method, setMethod] = useState(initial?.method ?? 'GET');
  const [expectedStatus, setExpectedStatus] = useState(initial?.expectedStatus ?? 200);
  const [timeoutMs, setTimeoutMs] = useState(initial?.timeoutMs ?? 10000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!initial;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit({ name, url, method: method as 'GET' | 'HEAD' | 'POST', expectedStatus, timeoutMs });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-2 mt-2 p-6 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
        {isEditing ? t('dashboard.edit') : t('dashboard.newMonitor')}
      </h2>
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('dashboard.displayName')}
          required
          className="input-dark"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('dashboard.urlPlaceholder')}
          required
          className="input-dark font-mono"
        />
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="select-dark"
        >
          <option>GET</option>
          <option>HEAD</option>
          <option>POST</option>
        </select>
        <input
          type="number"
          value={expectedStatus}
          onChange={(e) => setExpectedStatus(Number(e.target.value))}
          placeholder={t('dashboard.expectedStatus')}
          className="input-dark"
        />
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-accent">
          {loading
            ? t('dashboard.adding')
            : isEditing
            ? t('dashboard.saveChanges')
            : t('dashboard.addMonitorBtn')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          {t('dashboard.cancel')}
        </button>
      </div>
    </form>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    operational: { bg: 'rgba(0, 229, 160, 0.1)', color: '#00e5a0' },
    degraded: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' },
    outage: { bg: 'rgba(255, 77, 109, 0.1)', color: '#ff4d6d' },
    unknown: { bg: 'rgba(82, 82, 91, 0.2)', color: '#71717a' },
  };
  const style = styles[status] ?? styles.unknown;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {status}
    </span>
  );
}
