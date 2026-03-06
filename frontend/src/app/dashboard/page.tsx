'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, Org, Monitor, Incident } from '@/lib/api';
import { useTranslation } from '@/lib/i18n-context';

const STATUS_COLORS: Record<string, string> = {
  operational: '#00e5a0',
  degraded: '#f59e0b',
  outage: '#ff4d6d',
  unknown: '#52525b',
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const [org, setOrg] = useState<Org | null>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [noOrg, setNoOrg] = useState(false);

  useEffect(() => {
    Promise.all([
      adminApi.getOrg().then((r) => setOrg(r.org)).catch(() => setNoOrg(true)),
      adminApi.listMonitors().then((r) => setMonitors(r.monitors)).catch(() => {}),
      adminApi.listIncidents('open').then((r) => setIncidents(r.incidents)).catch(() => {}),
    ]);
  }, []);

  if (noOrg) return <SetupOrg />;

  const statusCounts = {
    operational: monitors.filter((m) => m.currentStatus === 'operational').length,
  };

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{org?.name ?? 'Dashboard'}</h1>
          {org && (
            <a
              href={`/status/${org.slug}`}
              target="_blank"
              className="mt-0.5 inline-flex items-center gap-1 text-sm text-accent hover:opacity-80"
              style={{ color: 'var(--accent)' }}
            >
              status/{org.slug}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t('dashboard.monitors')} value={monitors.length} />
        <StatCard
          label={t('dashboard.activeIncidents')}
          value={incidents.length}
          highlight={incidents.length > 0}
        />
        <StatCard label={t('dashboard.operational')} value={statusCounts.operational} accent />
      </div>

      {/* Monitors section */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            {t('dashboard.monitors')}
          </h2>
          <Link
            href="/dashboard/monitors"
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            {t('dashboard.manage')}
          </Link>
        </div>
        {monitors.length === 0 ? (
          <EmptyState
            label={t('dashboard.noMonitors')}
            action={{ href: '/dashboard/monitors', text: t('dashboard.addFirstMonitor') }}
          />
        ) : (
          <div className="space-y-2">
            {monitors.map((m) => (
              <MonitorRow key={m.monitorId} monitor={m} />
            ))}
          </div>
        )}
      </section>

      {/* Open incidents */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            {t('dashboard.openIncidents')}
          </h2>
          <Link
            href="/dashboard/incidents"
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            {t('dashboard.manage')}
          </Link>
        </div>
        {incidents.length === 0 ? (
          <p className="text-sm text-zinc-600">{t('dashboard.noIncidents')}</p>
        ) : (
          <div className="space-y-2">
            {incidents.map((i) => (
              <div key={i.incidentId} className="card-hover flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-100">{i.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {new Date(i.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: 'var(--danger-dim)', color: 'var(--danger)' }}
                >
                  {i.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MonitorRow({ monitor }: { monitor: Monitor }) {
  const color = STATUS_COLORS[monitor.currentStatus] ?? STATUS_COLORS.unknown;
  return (
    <div className="card-hover flex items-center justify-between px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-100">{monitor.name}</p>
        <p className="mt-0.5 truncate text-xs text-zinc-500">{monitor.url}</p>
      </div>
      <div className="ml-4 flex items-center gap-2.5">
        <span className="text-xs text-zinc-400">{monitor.currentStatus}</span>
        <span
          className="h-2.5 w-2.5 flex-shrink-0 rounded-full status-dot-pulse"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
  accent = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className="card p-5"
      style={highlight && value > 0 ? { borderColor: 'var(--danger)', borderWidth: '1px' } : {}}
    >
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p
        className="text-3xl font-bold"
        style={
          highlight && value > 0
            ? { color: 'var(--danger)' }
            : accent
            ? { color: 'var(--accent)' }
            : { color: '#f4f4f5' }
        }
      >
        {value}
      </p>
    </div>
  );
}

function EmptyState({ label, action }: { label: string; action: { href: string; text: string } }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center">
      <p className="text-sm text-zinc-500">{label}</p>
      <Link
        href={action.href}
        className="mt-2 inline-block text-xs underline underline-offset-2"
        style={{ color: 'var(--accent)' }}
      >
        {action.text}
      </Link>
    </div>
  );
}

function SetupOrg() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [notifyEmail, setNotifyEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await adminApi.createOrg({ name, slug, notifyEmail });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg animate-fade-up">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">{t('dashboard.setupTitle')}</h1>
      <p className="mb-8 text-sm text-zinc-500">{t('dashboard.setupSubtitle')}</p>

      {error && (
        <div className="mb-5 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="card p-6 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
              {t('dashboard.orgName')}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
              required
              className="input-dark"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
              {t('dashboard.slug')}
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-zinc-500">status/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="acme"
                required
                className="input-dark flex-1 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
              {t('dashboard.alertEmail')}
            </label>
            <input
              type="email"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              placeholder="alerts@acme.com"
              required
              className="input-dark"
            />
            <p className="mt-1.5 text-xs text-zinc-600">{t('dashboard.alertEmailHint')}</p>
          </div>
          <button type="submit" disabled={loading} className="btn-accent w-full">
            {loading ? t('dashboard.creating') : t('dashboard.createOrg')}
          </button>
        </form>
      </div>
    </div>
  );
}
