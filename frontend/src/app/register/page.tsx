'use client';
import { useState } from 'react';
import Link from 'next/link';
import { signUp, confirmSignUp } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n-context';

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [step, setStep] = useState<'signup' | 'confirm' | 'tutorial'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp(email, password);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await confirmSignUp(email, code);
      setStep('tutorial');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  }

  const tutorialSteps = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" strokeLinecap="round" />
        </svg>
      ),
      title: t('auth.tutorial.step1Title'),
      desc: t('auth.tutorial.step1Desc'),
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: t('auth.tutorial.step2Title'),
      desc: t('auth.tutorial.step2Desc'),
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" strokeLinecap="round" />
        </svg>
      ),
      title: t('auth.tutorial.step3Title'),
      desc: t('auth.tutorial.step3Desc'),
    },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center hero-bg px-4 py-8">
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

        {step === 'tutorial' ? (
          <div className="card p-8">
            {/* Progress: 3/3 */}
            <div className="mb-6 flex items-center gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-1.5 flex-1 rounded-full"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
              ))}
            </div>

            <h1 className="mb-1 text-2xl font-bold text-zinc-100">{t('auth.tutorial.title')}</h1>
            <p className="mb-6 text-sm text-zinc-500">{t('auth.tutorial.subtitle')}</p>

            <div className="mb-6 space-y-3">
              {tutorialSteps.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-800/40 px-4 py-3"
                >
                  <div
                    className="mt-0.5 flex-shrink-0 rounded-lg p-1.5"
                    style={{ backgroundColor: 'rgba(0,229,160,0.1)', color: 'var(--accent)' }}
                  >
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{s.title}</p>
                    <p className="text-xs leading-relaxed text-zinc-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push('/login?confirmed=true')}
              className="btn-accent w-full"
            >
              {t('auth.tutorial.cta')}
            </button>
          </div>
        ) : (
          <div className="card p-8">
            {/* Step indicator */}
            <div className="mb-6 flex items-center gap-2">
              <div
                className="h-1.5 flex-1 rounded-full"
                style={{ backgroundColor: 'var(--accent)' }}
              />
              <div
                className="h-1.5 flex-1 rounded-full transition-colors duration-500"
                style={step === 'confirm' ? { backgroundColor: 'var(--accent)' } : { backgroundColor: '#27272a' }}
              />
              <div className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: '#27272a' }} />
            </div>

            <h1 className="mb-1 text-2xl font-bold text-zinc-100">{t('auth.createAccount')}</h1>
            <p className="mb-6 text-sm text-zinc-500">
              {step === 'signup' ? (
                <>
                  {t('auth.alreadyHaveAccount')}{' '}
                  <Link href="/login" className="text-accent underline underline-offset-2 hover:opacity-80">
                    {t('auth.signIn')}
                  </Link>
                </>
              ) : (
                t('auth.enterCode')
              )}
            </p>

            {error && (
              <div className="mb-5 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {step === 'signup' ? (
              <form onSubmit={handleSignUp} className="space-y-4">
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
                  placeholder={t('auth.minPassword')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="input-dark"
                />
                <button type="submit" disabled={loading} className="btn-accent w-full">
                  {loading ? t('auth.creatingAccount') : t('auth.createAccountBtn')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirm} className="space-y-4">
                <p className="rounded-lg border border-zinc-800 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-400">
                  {t('auth.weSent')}{' '}
                  <span className="font-medium text-zinc-200">{email}</span>
                </p>
                <input
                  type="text"
                  placeholder={t('auth.verificationCode')}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="input-dark font-mono tracking-widest"
                />
                <button type="submit" disabled={loading} className="btn-accent w-full">
                  {loading ? t('auth.confirming') : t('auth.confirmEmail')}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
