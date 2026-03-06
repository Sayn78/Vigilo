'use client';
import { useEffect, useState } from 'react';
import { adminApi, Incident, CreateIncidentInput } from '@/lib/api';
import { useTranslation } from '@/lib/i18n-context';

const IMPACT_COLORS: Record<string, { border: string; bg: string; color: string }> = {
  none: { border: '#3f3f46', bg: 'rgba(63,63,70,0.15)', color: '#71717a' },
  minor: { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)', color: '#f59e0b' },
  major: { border: '#f97316', bg: 'rgba(249,115,22,0.08)', color: '#f97316' },
  critical: { border: '#ff4d6d', bg: 'rgba(255,77,109,0.08)', color: '#ff4d6d' },
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  investigating: { bg: 'rgba(255,77,109,0.1)', color: '#ff4d6d' },
  identified: { bg: 'rgba(249,115,22,0.1)', color: '#f97316' },
  monitoring: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  resolved: { bg: 'rgba(0,229,160,0.1)', color: '#00e5a0' },
};

export default function IncidentsPage() {
  const { t } = useTranslation();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.listIncidents().then((r) => {
      setIncidents(r.incidents);
      setLoading(false);
    });
  }, []);

  async function handleCreate(data: CreateIncidentInput) {
    const r = await adminApi.createIncident(data);
    setIncidents((prev) => [r.incident, ...prev]);
    setShowForm(false);
  }

  async function handleResolve(id: string) {
    const r = await adminApi.updateIncident(id, { status: 'resolved', message: 'Issue has been resolved.' });
    setIncidents((prev) => prev.map((i) => (i.incidentId === id ? r.incident : i)));
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
        <h1 className="text-2xl font-bold text-zinc-100">{t('nav.incidents')}</h1>
        <button onClick={() => setShowForm(true)} className="btn-danger px-4 py-2">
          {t('dashboard.createIncident')}
        </button>
      </div>

      {showForm && <IncidentForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />}

      {incidents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <p className="text-sm text-zinc-500">{t('dashboard.noIncidentsRecorded')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => {
            const impactStyle = IMPACT_COLORS[incident.impact] ?? IMPACT_COLORS.none;
            return (
              <div
                key={incident.incidentId}
                className="relative overflow-hidden rounded-xl border px-5 py-4 transition-colors"
                style={{
                  borderColor: impactStyle.border,
                  backgroundColor: impactStyle.bg,
                }}
              >
                {/* Left accent bar */}
                <div
                  className="absolute left-0 top-0 h-full w-0.5"
                  style={{ backgroundColor: impactStyle.color }}
                />

                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-zinc-100">{incident.title}</p>
                      <IncidentStatusBadge status={incident.status} />
                      <ImpactBadge impact={incident.impact} />
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-600">
                      {t('dashboard.created')} {new Date(incident.createdAt).toLocaleString()}
                      {incident.resolvedAt &&
                        ` · ${t('dashboard.resolvedLabel')} ${new Date(incident.resolvedAt).toLocaleString()}`}
                    </p>
                  </div>

                  {incident.status !== 'resolved' && (
                    <button
                      onClick={() => handleResolve(incident.incidentId)}
                      className="flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: 'rgba(0,229,160,0.1)',
                        color: '#00e5a0',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(0,229,160,0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(0,229,160,0.1)';
                      }}
                    >
                      {t('dashboard.markResolved')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IncidentForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (d: CreateIncidentInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('investigating');
  const [impact, setImpact] = useState('minor');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit({ title, status, impact, message });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-6 p-6 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
        {t('nav.incidents')}
      </h2>
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('dashboard.incidentTitle')}
        required
        className="input-dark"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="select-dark">
          <option value="investigating">{t('dashboard.investigating')}</option>
          <option value="identified">{t('dashboard.identified')}</option>
          <option value="monitoring">{t('dashboard.monitoring')}</option>
          <option value="resolved">{t('dashboard.resolved')}</option>
        </select>
        <select value={impact} onChange={(e) => setImpact(e.target.value)} className="select-dark">
          <option value="none">{t('dashboard.none')}</option>
          <option value="minor">{t('dashboard.minor')}</option>
          <option value="major">{t('dashboard.major')}</option>
          <option value="critical">{t('dashboard.critical')}</option>
        </select>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t('dashboard.initialMessage')}
        required
        rows={3}
        className="input-dark resize-none"
      />
      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-danger">
          {loading ? t('dashboard.creating') : t('dashboard.createIncidentBtn')}
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

function IncidentStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { bg: 'rgba(82,82,91,0.2)', color: '#71717a' };
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {status}
    </span>
  );
}

function ImpactBadge({ impact }: { impact: string }) {
  const style = IMPACT_COLORS[impact] ?? IMPACT_COLORS.none;
  return (
    <span className="text-xs font-medium" style={{ color: style.color }}>
      {impact} impact
    </span>
  );
}
