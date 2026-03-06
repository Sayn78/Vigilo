'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { getSession, signOut } from '@/lib/auth';
import { adminApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n-context';

function NavIcon({ path }: { path: string }) {
  if (path === '/dashboard')
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  if (path === '/dashboard/monitors')
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (path === '/dashboard/incidents')
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" />
        <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  if (path === '/dashboard/reports')
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    );
  if (path === '/dashboard/settings')
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [snsConfirmed, setSnsConfirmed] = useState<boolean | null>(null);
  const [snsPopupDismissed, setSnsPopupDismissed] = useState(false);

  useEffect(() => {
    getSession().then((session) => {
      if (!session) router.replace('/login');
      else setChecking(false);
    });
  }, [router]);

  // After auth resolves, check SNS subscription status
  useEffect(() => {
    if (checking) return;
    adminApi.getOrg()
      .then((r) => setSnsConfirmed(r.org.snsSubscriptionConfirmed))
      .catch(() => {}); // No org yet — don't show popup
  }, [checking]);

  // Close sidebar when navigating
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-[#00e5a0]" />
      </div>
    );
  }

  const nav = [
    { href: '/dashboard', label: t('nav.overview') },
    { href: '/dashboard/monitors', label: t('nav.monitors') },
    { href: '/dashboard/incidents', label: t('nav.incidents') },
    { href: '/dashboard/reports', label: t('nav.reports') },
    { href: '/dashboard/settings', label: t('nav.settings') },
  ];

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="border-b border-zinc-800 px-4 py-3">
        <Link href="/">
          <img
            src="/logo_vigilo.png"
            alt="Vigilo"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </Link>
      </div>

      {/* Nav */}
      <nav className="mt-3 flex-1 px-2 space-y-0.5">
        {nav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'nav-active'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'
              }`}
            >
              <span className={isActive ? 'text-accent' : ''} style={isActive ? { color: 'var(--accent)' } : {}}>
                <NavIcon path={item.href} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t border-zinc-800 p-2">
        <button
          onClick={async () => {
            await signOut();
            router.push('/login');
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-zinc-300"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" />
            <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" />
          </svg>
          {t('nav.signOut')}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex w-56 flex-shrink-0 flex-col border-r border-zinc-800"
        style={{ backgroundColor: 'rgba(7, 14, 10, 0.75)' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile: backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile: slide-in sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-800 transition-transform duration-300 md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: 'rgba(7, 14, 10, 0.92)' }}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar with hamburger */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3 md:hidden" style={{ backgroundColor: 'rgba(7, 14, 10, 0.92)' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <img src="/logo_vigilo.png" alt="Vigilo" style={{ height: '28px', width: 'auto' }} />
        </div>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8">{children}</main>
      </div>

      {/* SNS subscription confirmation popup */}
      {snsConfirmed === false && !snsPopupDismissed && (
        <SnsConfirmationBanner onDismiss={() => setSnsPopupDismissed(true)} />
      )}
    </div>
  );
}

function SnsConfirmationBanner({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-full max-w-sm rounded-xl border p-4 shadow-2xl md:bottom-6 md:right-6"
      style={{
        backgroundColor: 'rgba(12, 20, 15, 0.97)',
        borderColor: '#f59e0b',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Envelope icon */}
        <div className="mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
            {t('dashboard.snsPopup.title')}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            {t('dashboard.snsPopup.message')}
          </p>
          <p className="mt-1.5 text-xs text-zinc-500">
            {t('dashboard.snsPopup.checkSpam')}
          </p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="ml-1 flex-shrink-0 rounded p-0.5 text-zinc-500 transition-colors hover:text-zinc-300"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <button
        onClick={onDismiss}
        className="mt-3 w-full rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}
      >
        {t('dashboard.snsPopup.dismiss')}
      </button>
    </div>
  );
}
