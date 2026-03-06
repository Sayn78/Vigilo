'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { signIn } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from '@/lib/i18n-context';

function ConfirmedBanner() {
  const params = useSearchParams();
  const { t } = useTranslation();
  if (!params.get('confirmed')) return null;
  return (
    <div className="mb-5 rounded-lg border border-green-800 bg-green-950/50 px-4 py-3 text-sm text-green-400">
      {t('auth.emailConfirmed')}
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {error && (
        <div className="mb-5 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          placeholder={t('auth.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input-dark"
        />
        <input
          type="password"
          placeholder={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="input-dark"
        />
        <button type="submit" disabled={loading} className="btn-accent w-full">
          {loading ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>
    </>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center hero-bg px-4">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8">
          <Link href="/">
            <img
              src="/logo_vigilo.png"
              alt="Vigilo"
              style={{ width: '100%', height: 'auto' }}
            />
          </Link>
        </div>

        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          {t('auth.backHome')}
        </Link>

        <div className="card p-8">
          <h1 className="mb-1 text-2xl font-bold text-zinc-100">{t('auth.signIn')}</h1>
          <p className="mb-6 text-sm text-zinc-500">
            {t('auth.noAccount')}{' '}
            <Link href="/register" className="text-accent underline underline-offset-2 hover:opacity-80">
              {t('auth.createOne')}
            </Link>
          </p>
          <Suspense>
            <ConfirmedBanner />
          </Suspense>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
