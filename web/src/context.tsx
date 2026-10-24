import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { parseLanguage, type Language } from '../../shared/schemas.ts';
import { translate, type MessageKey } from '../../shared/i18n/index.ts';

const LANG_KEY = 'hc_lang';

// localStorage is a per-device convenience only, always wrapped in try/catch (CLAUDE.md).
function readStoredLanguage(): Language | null {
  try {
    return parseLanguage(window.localStorage.getItem(LANG_KEY));
  } catch {
    return null;
  }
}
function storeLanguage(lang: Language): void {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* private mode or blocked storage: the choice just won't persist */
  }
}

export interface Ui {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: MessageKey, params?: Record<string, string>) => string;
  toast: (message: string) => void;
  toastMessage: string;
}

const UiContext = createContext<Ui | null>(null);

export function UiProvider({ children }: { children: ComponentChildren }) {
  const [lang, setLangState] = useState<Language>(() => readStoredLanguage() ?? parseLanguage(navigator.language) ?? 'en');
  const [toastMessage, setToastMessage] = useState('');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const toast = useCallback((message: string) => {
    setToastMessage(message);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastMessage(''), 4000);
  }, []);

  const setLang = useCallback((next: Language) => {
    storeLanguage(next);
    setLangState(next);
  }, []);

  const ui = useMemo<Ui>(
    () => ({ lang, setLang, toast, toastMessage, t: (key, params) => translate(lang, key, params) }),
    [lang, setLang, toast, toastMessage],
  );
  return <UiContext.Provider value={ui}>{children}</UiContext.Provider>;
}

export function useUi(): Ui {
  const ui = useContext(UiContext);
  if (!ui) throw new Error('useUi outside UiProvider');
  return ui;
}

/** A live region that announces toasts. It is always in the DOM so screen readers register it. */
export function ToastRegion({ message }: { message: string }) {
  return (
    <output class="toast-region" aria-live="polite" aria-atomic="true">
      {message ? <div class="toast">{message}</div> : null}
    </output>
  );
}
