'use client';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n-context';

export default function LandingPage() {
  const { t } = useTranslation();

  const features = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      accent: '#00e5a0',
      title: t('landing.features.monitoring.title'),
      description: t('landing.features.monitoring.desc'),
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" strokeLinecap="round" />
        </svg>
      ),
      accent: '#818cf8',
      title: t('landing.features.statusPage.title'),
      description: t('landing.features.statusPage.desc'),
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" />
        </svg>
      ),
      accent: '#fb923c',
      title: t('landing.features.multiTenant.title'),
      description: t('landing.features.multiTenant.desc'),
    },
  ];

  const tags = ['Multi-tenant', 'Multi-AZ HA', 'PITR Backup', 'Zero Cold Start', 'CDK IaC', 'OIDC CI/CD'];

  return (
    <main className="min-h-screen hero-bg">
      {/* Nav */}
      <nav className="border-b border-zinc-800/60 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <img
            src="/logo_vigilo.png"
            alt="Vigilo"
            style={{ height: '36px', width: 'auto' }}
          />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              {t('landing.signIn')}
            </Link>
            <Link href="/register" className="btn-accent px-4 py-2 text-sm">
              {t('landing.getStarted')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-24 pt-28">
        <div className="dot-grid absolute inset-0 opacity-30" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="animate-fade-up mb-8 flex justify-center">
            <img src="/logo_vigilo.png" alt="Vigilo" style={{ width: '72%', maxWidth: '420px', height: 'auto' }} />
          </div>
          <div className="animate-fade-up mb-6 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-1.5 text-xs text-zinc-400">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#00e5a0]" />
            <span>AWS Serverless · Lambda · DynamoDB · CloudFront</span>
          </div>

          <h1 className="animate-fade-up delay-100 mb-5 text-5xl font-bold leading-[1.1] tracking-tight text-zinc-100 md:text-6xl lg:text-7xl">
            {t('landing.heroTitle1')}
            <br />
            <span className="text-accent">{t('landing.heroTitle2')}</span>
          </h1>

          <p className="animate-fade-up delay-200 mb-10 text-lg leading-relaxed text-zinc-400 md:text-xl">
            {t('landing.heroSubtitle')}
          </p>

          <Link
            href="/register"
            className="animate-fade-up delay-300 btn-accent px-8 py-3.5 text-base"
          >
            {t('landing.heroCta')}
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`card p-6 animate-fade-up`}
              style={{
                borderTopColor: f.accent,
                borderTopWidth: '2px',
                animationDelay: `${(i + 1) * 0.1}s`,
              }}
            >
              <div
                className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${f.accent}18`, color: f.accent }}
              >
                {f.icon}
              </div>
              <h3 className="mb-2 text-base font-semibold text-zinc-100">{f.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture callout */}
      <section className="border-y border-zinc-800 bg-zinc-900/40 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-3 text-2xl font-bold text-zinc-100">{t('landing.builtOn')}</h2>
          <p className="mb-8 font-mono text-sm text-zinc-500">{t('landing.awsServices')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 font-mono text-xs text-zinc-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center">
        <p className="text-sm text-zinc-600">
          {t('landing.openSource')} ·{' '}
          <a
            href="https://github.com/Sayn78/vigilo"
            className="text-zinc-500 underline underline-offset-2 transition-colors hover:text-zinc-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('landing.viewOnGithub')}
          </a>
        </p>
      </footer>
    </main>
  );
}
