'use client';
import { useEffect, useState } from 'react';
import { publicApi, PublicStatusResponse } from '@/lib/api';
import { useTranslation } from '@/lib/i18n-context';

// Colors / geometry only — labels come from i18n
const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  operational: { color: '#00e5a0', bg: 'rgba(0, 229, 160, 0.06)', border: 'rgba(0, 229, 160, 0.25)' },
  degraded:    { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.06)', border: 'rgba(245, 158, 11, 0.25)' },
  outage:      { color: '#ff4d6d', bg: 'rgba(255, 77, 109, 0.06)', border: 'rgba(255, 77, 109, 0.25)' },
  unknown:     { color: '#71717a', bg: 'rgba(113, 113, 122, 0.06)', border: 'rgba(113, 113, 122, 0.25)' },
};

const MONITOR_COLORS: Record<string, string> = {
  operational: '#00e5a0',
  degraded:    '#f59e0b',
  outage:      '#ff4d6d',
  unknown:     '#52525b',
};

const INCIDENT_STATUS: Record<string, { bg: string; color: string }> = {
  investigating: { bg: 'rgba(255,77,109,0.1)', color: '#ff4d6d' },
  identified:    { bg: 'rgba(249,115,22,0.1)',  color: '#f97316' },
  monitoring:    { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b' },
  resolved:      { bg: 'rgba(0,229,160,0.1)',   color: '#00e5a0' },
};

function UptimeBars({ checks }: { checks: { success: boolean; latencyMs: number; checkedAt: string }[] }) {
  if (checks.length === 0) return null;
  // API returns newest-first; show oldest→newest left→right
  const sorted = [...checks].reverse();
  return (
    <div className="mt-2 flex gap-px" style={{ height: 20 }}>
      {sorted.map((c, i) => (
        <div
          key={i}
          title={`${new Date(c.checkedAt).toLocaleString()} — ${c.latencyMs}ms`}
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
  );
}

export default function StatusPageClient({ params }: { params: { slug: string } }) {
  const { t } = useTranslation();
  const [data, setData] = useState<PublicStatusResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [resolvedSlug, setResolvedSlug] = useState(params.slug);

  // Computed once per render from current language
  const STATUS_LABELS: Record<string, string> = {
    operational: t('status.allOperational'),
    degraded:    t('status.partialOutage'),
    outage:      t('status.majorOutage'),
    unknown:     t('status.statusUnknown'),
  };
  const MONITOR_LABELS: Record<string, string> = {
    operational: t('status.operational'),
    degraded:    t('status.degraded'),
    outage:      t('status.outage'),
    unknown:     t('status.unknown'),
  };

  useEffect(() => {
    // useParams() and params.slug both return '__placeholder__' in a static export
    // because Next.js router state is hydrated from the pre-built HTML, not from
    // the actual browser URL. Read the real slug directly from window.location.
    const parts = window.location.pathname.split('/').filter(Boolean);
    const slug = (parts[0] === 'status' && parts[1]) ? parts[1] : params.slug;
    setResolvedSlug(slug);

    async function load() {
      try {
        const result = await publicApi.getStatus(slug);
        setData(result);
        setLastUpdated(new Date());
      } catch {
        setError('not-found');
      } finally {
        setLoading(false);
      }
    }
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingState />;
  if (error || !data) return <NotFoundState slug={resolvedSlug} />;

  const { org, overallStatus, monitors, activeIncidents } = data;
  const statusConf = STATUS_CONFIG[overallStatus] ?? STATUS_CONFIG.unknown;
  const statusLabel = STATUS_LABELS[overallStatus] ?? STATUS_LABELS.unknown;

  return (
    <div className="min-h-screen">
      {/* Top accent bar */}
      <div className="h-0.5 w-full" style={{ backgroundColor: statusConf.color }} />

      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full status-dot-pulse"
              style={{ backgroundColor: statusConf.color }}
            />
            <span className="text-lg font-bold text-zinc-100">{org.name}</span>
          </div>
          <span className="font-mono text-xs text-zinc-600">{org.slug}</span>
        </div>

        {/* Overall status banner */}
        <div
          className="mb-8 flex items-center gap-4 rounded-xl border p-5"
          style={{ backgroundColor: statusConf.bg, borderColor: statusConf.border }}
        >
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${statusConf.color}20` }}
          >
            <span
              className="h-3 w-3 rounded-full status-dot-pulse"
              style={{ backgroundColor: statusConf.color }}
            />
          </div>
          <div>
            <p className="text-lg font-semibold" style={{ color: statusConf.color }}>
              {statusLabel}
            </p>
            {lastUpdated && (
              <p className="text-xs text-zinc-600">
                {t('status.lastUpdated')}: {lastUpdated.toLocaleTimeString()} · {t('status.autoRefresh')}
              </p>
            )}
          </div>
        </div>

        {/* Active incidents */}
        {activeIncidents.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {t('status.activeIncidents')}
            </h2>
            <div className="space-y-2">
              {activeIncidents.map((incident) => {
                const incStyle = INCIDENT_STATUS[incident.status] ?? INCIDENT_STATUS.investigating;
                return (
                  <div
                    key={incident.incidentId}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-zinc-100">{incident.title}</p>
                      <span
                        className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: incStyle.bg, color: incStyle.color }}
                      >
                        {incident.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">
                      {new Date(incident.createdAt).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Services */}
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t('status.services')}
          </h2>
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            {monitors.map((monitor, idx) => {
              const color = MONITOR_COLORS[monitor.currentStatus] ?? MONITOR_COLORS.unknown;
              const label = MONITOR_LABELS[monitor.currentStatus] ?? MONITOR_LABELS.unknown;
              return (
                <div
                  key={monitor.monitorId}
                  className="px-5 py-4 transition-colors hover:bg-zinc-900/50"
                  style={{ borderBottom: idx < monitors.length - 1 ? '1px solid #27272a' : 'none' }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-100">{monitor.name}</p>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs" style={{ color }}>{label}</span>
                      <span
                        className="h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}
                      />
                    </div>
                  </div>
                  {monitor.recentChecks.length > 0 && (
                    <UptimeBars checks={monitor.recentChecks} />
                  )}
                  {monitor.uptimePercent !== null && (
                    <p className="mt-1 text-xs text-zinc-600">
                      {monitor.uptimePercent}% {t('status.uptime')}
                    </p>
                  )}
                </div>
              );
            })}
            {monitors.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-zinc-600">
                {t('dashboard.noMonitorsYet')}
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <div className="flex flex-col items-center gap-1">
          <a href="/" className="transition-opacity hover:opacity-70">
            <img
              src="/logo_vigilo.png"
              alt="Vigilo"
              style={{ height: '44px', width: 'auto' }}
            />
          </a>
          <p className="text-xs text-zinc-700">{t('status.poweredBy')} {t('status.statusPageSaas')}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-800"
        style={{ borderTopColor: '#00e5a0' }}
      />
    </div>
  );
}

function NotFoundState({ slug }: { slug: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center text-center px-4"
    >
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800"
        style={{ backgroundColor: '#111' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="1.75">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-zinc-100">{t('status.notFound')}</h1>
      <p className="mt-2 text-sm text-zinc-600">
        {t('status.notFoundDesc')}{' '}
        <span className="font-mono text-zinc-400">{slug}</span>
      </p>
      <a
        href="/"
        className="mt-6 text-sm transition-colors hover:opacity-80"
        style={{ color: 'var(--accent)' }}
      >
        ← Vigilo
      </a>
    </div>
  );
}
