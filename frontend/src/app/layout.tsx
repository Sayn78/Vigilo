import type { Metadata, Viewport } from 'next';
import { Syne, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { LanguageProvider } from '@/lib/i18n-context';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Vigilo',
  description: 'Multi-tenant status page monitoring powered by AWS',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
