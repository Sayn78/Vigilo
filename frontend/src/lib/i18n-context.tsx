'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { translations, Lang } from './i18n';

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (path: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  t: (path: string) => path,
});

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || typeof current !== 'object') return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : path;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr');

  useEffect(() => {
    const saved = localStorage.getItem('lang') as Lang | null;
    if (saved === 'fr' || saved === 'en') setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem('lang', l);
  }

  function t(path: string): string {
    return getNestedValue(translations[lang] as Record<string, unknown>, path);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
