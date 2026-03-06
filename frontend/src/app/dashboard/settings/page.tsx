'use client';
import { useEffect, useState } from 'react';
import { adminApi, Org } from '@/lib/api';
import { useTranslation } from '@/lib/i18n-context';
import type { Lang } from '@/lib/i18n';

export default function SettingsPage() {
  const { t, lang, setLang } = useTranslation();
  const [org, setOrg] = useState<Org | null>(null);
  const [name, setName] = useState('');
  const [notifyEmail, setNotifyEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getOrg().then((r) => {
      setOrg(r.org);
      setName(r.org.name);
      setNotifyEmail(r.org.notifyEmail);
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const r = await adminApi.updateOrg({ name, notifyEmail });
      setOrg(r.org);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!org)
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
        {t('dashboard.loading')}
      </div>
    );

  return (
    <div className="animate-fade-up max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">{t('dashboard.settingsTitle')}</h1>

      {/* Status page URL */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {t('dashboard.statusPageUrl')}
        </p>
        <a
          href={`/status/${org.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all font-mono text-sm transition-colors hover:opacity-80"
          style={{ color: 'var(--accent)' }}
        >
          /status/{org.slug}
        </a>
      </div>

      {/* Feedback banners */}
      {success && (
        <div className="mb-5 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-400">
          {t('dashboard.settingsSaved')}
        </div>
      )}
      {error && (
        <div className="mb-5 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Settings form */}
      <form onSubmit={handleSave} className="card p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t('dashboard.orgName')}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input-dark"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t('dashboard.alertEmail')}
          </label>
          <input
            type="email"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
            required
            className="input-dark"
          />
          <p className="text-xs text-zinc-600">{t('dashboard.alertEmailDesc')}</p>
        </div>

        <button type="submit" disabled={saving} className="btn-accent">
          {saving ? t('dashboard.saving') : t('dashboard.saveSettings')}
        </button>
      </form>

      {/* Language toggle */}
      <div className="mt-6 card p-6">
        <div className="space-y-1.5 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t('dashboard.language')}
          </p>
          <p className="text-xs text-zinc-600">{t('dashboard.languageDesc')}</p>
        </div>

        <div className="flex gap-2">
          {(['en', 'fr'] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className="rounded-lg border px-5 py-2.5 text-sm font-medium transition-all duration-150"
              style={
                lang === l
                  ? {
                      borderColor: 'var(--accent)',
                      backgroundColor: 'var(--accent-dim)',
                      color: 'var(--accent)',
                    }
                  : {
                      borderColor: '#3f3f46',
                      backgroundColor: 'transparent',
                      color: '#71717a',
                    }
              }
            >
              {l === 'en' ? 'English' : 'Français'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
