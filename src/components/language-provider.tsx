"use client";

import * as React from "react";

import { type Locale, getDict } from "@/i18n";

const STORAGE_KEY = "pianomind:lang";
const LANG_EVENT = "pianomind:langchange";

type LanguageContextValue = {
  locale: Locale;
  dict: ReturnType<typeof getDict>;
  setLocale: (l: Locale) => void;
  toggle: () => void;
};

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

function readStoredLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "th") return saved;
    const nav = window.navigator.language?.toLowerCase() ?? "";
    if (nav.startsWith("th")) return "th";
  } catch {
    /* ignore storage errors (private mode etc.) */
  }
  return "en";
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LANG_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LANG_EVENT, onStoreChange);
  };
}

function getServerSnapshot(): Locale {
  return "th";
}

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // useSyncExternalStore keeps locale in sync with localStorage AND stays
  // hydration-safe (server snapshot = "th").
  const locale = React.useSyncExternalStore(
    subscribe,
    readStoredLocale,
    getServerSnapshot,
  );

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = React.useMemo<LanguageContextValue>(() => {
    const setLocale = (l: Locale) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, l);
      } catch {
        /* ignore */
      }
      // Notify other hooks/components on this tab.
      window.dispatchEvent(new Event(LANG_EVENT));
    };
    return {
      locale,
      dict: getDict(locale),
      setLocale,
      toggle: () => setLocale(locale === "th" ? "en" : "th"),
    };
  }, [locale]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a <LanguageProvider>");
  }
  return ctx;
}

export { STORAGE_KEY };
