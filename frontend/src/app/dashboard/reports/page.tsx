'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import type { Monitor, DayUptime, OverallUptime } from '@/lib/api';
import { useTranslation } from '@/lib/i18n-context';

type UptimeData = { days: DayUptime[]; overall: OverallUptime };

function uptimeColor(pct: number | null): string {
  if (pct === null) return 'text-zinc-500';
  if (pct >= 99.5) return 'text-[#00e5a0]';
  if (pct >= 95) return 'text-[#f59e0b]';
  return 'text-[#ff4d6d]';
}

function barColor(pct: number | null): string {
  if (pct === null) return 'bg-zinc-700/50';
  if (pct >= 95) return 'bg-[#00e5a0]';
  return 'bg-[#ff4d6d]';
}

function buildDayMap(data: DayUptime[], days: number): (DayUptime | null)[] {
  const map = new Map(data.map((d) => [d.date, d]));
  const result: (DayUptime | null)[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push(map.get(key) ?? null);
  }
  return result;
}

function MonitorUptimeCard({
  monitor,
  data,
  selectedDays,
  loading,
}: {
  monitor: Monitor;
  data: UptimeData | undefined;
  selectedDays: number;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const daySlots = data ? buildDayMap(data.days, selectedDays) : [];

  const statusColors: Record<string, string> = {
    operational: '#00e5a0',
    degraded: '#f59e0b',
    outage: '#ff4d6d',
    unknown: '#71717a',
  };
  const dotColor = statusColors[monitor.currentStatus] ?? '#71717a';

  return (
    <div className="card-hover card p-5">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{ backgroundColor: dotColor }}
            />
            <span className="truncate font-medium text-zinc-100">{monitor.name}</span>
          </div>
          <p className="mt-0.5 truncate pl-4 text-xs text-zinc-500">{monitor.url}</p>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="mb-4 flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-20 animate-pulse rounded bg-zinc-800" />
          ))}
        </div>
      ) : data ? (
        <div className="mb-4 flex flex-wrap gap-4">
          <div>
            <p className="text-xs text-zinc-500">{t('dashboard.reports.uptime')}</p>
            <p className={`text-2xl font-bold tabular-nums ${uptimeColor(data.overall.uptime)}`}>
              {data.overall.uptime !== null ? `${data.overall.uptime}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">{t('dashboard.reports.avgLatency')}</p>
            <p className="text-2xl font-bold tabular-nums text-zinc-200">
              {data.overall.avgLatency !== null ? `${data.overall.avgLatency}ms` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">{t('dashboard.reports.totalChecks')}</p>
            <p className="text-2xl font-bold tabular-nums text-zinc-200">
              {data.overall.totalChecks.toLocaleString()}
            </p>
          </div>
        </div>
      ) : (
        <p className="mb-4 text-sm text-zinc-500">{t('dashboard.reports.noData')}</p>
      )}

      {/* Day bars */}
      {!loading && data && (
        <div className="flex h-8 items-end gap-px overflow-hidden rounded">
          {daySlots.map((day, i) => (
            <div
              key={i}
              className={`flex-1 rounded-sm transition-opacity hover:opacity-80 ${barColor(day?.uptime ?? null)}`}
              style={{ height: day ? '100%' : '30%' }}
              title={
                day
                  ? `${day.date} — ${day.uptime !== null ? `${day.uptime}%` : t('dashboard.reports.noData')}`
                  : `${daySlots[i] === null ? '' : ''}`
              }
            />
          ))}
        </div>
      )}
      {!loading && data && (
        <div className="mt-1 flex justify-between text-xs text-zinc-600">
          <span>
            {selectedDays === 7 ? '7d ago' : '30d ago'}
          </span>
          <span>Today</span>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [uptimeMap, setUptimeMap] = useState<Record<string, UptimeData>>({});
  const [loadingMonitors, setLoadingMonitors] = useState(true);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [selectedDays, setSelectedDays] = useState<7 | 30>(30);

  useEffect(() => {
    adminApi.listMonitors().then((r) => {
      setMonitors(r.monitors);
      setLoadingMonitors(false);
      fetchUptime(r.monitors, selectedDays);
    });
  }, []);

  function fetchUptime(mons: Monitor[], days: number) {
    const ids = new Set(mons.map((m) => m.monitorId));
    setLoadingIds(ids);
    mons.forEach((m) => {
      adminApi
        .getMonitorUptime(m.monitorId, days)
        .then((data) => {
          setUptimeMap((prev) => ({ ...prev, [m.monitorId]: data }));
        })
        .finally(() => {
          setLoadingIds((prev) => {
            const next = new Set(prev);
            next.delete(m.monitorId);
            return next;
          });
        });
    });
  }

  function handleSelectDays(days: 7 | 30) {
    setSelectedDays(days);
    setUptimeMap({});
    fetchUptime(monitors, days);
  }

  if (loadingMonitors) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-[#00e5a0]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">{t('dashboard.reports.title')}</h1>
          <p className="mt-0.5 text-sm text-zinc-500">{t('dashboard.reports.subtitle')}</p>
        </div>
        {/* Day toggle */}
        <div className="flex rounded-lg border border-zinc-800 p-0.5 text-sm">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => handleSelectDays(d)}
              className={`rounded-md px-4 py-1.5 font-medium transition-colors ${
                selectedDays === d
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {d === 7 ? t('dashboard.reports.days7') : t('dashboard.reports.days30')}
            </button>
          ))}
        </div>
      </div>

      {/* Monitor cards */}
      {monitors.length === 0 ? (
        <p className="text-sm text-zinc-500">{t('dashboard.reports.noMonitors')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {monitors.map((m) => (
            <MonitorUptimeCard
              key={m.monitorId}
              monitor={m}
              data={uptimeMap[m.monitorId]}
              selectedDays={selectedDays}
              loading={loadingIds.has(m.monitorId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
