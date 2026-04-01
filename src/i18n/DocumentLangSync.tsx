import { onMount, onCleanup } from 'solid-js';
import { useTransContext } from '@mbarzda/solid-i18next';
import { applyDocumentLangDir } from './config';

export function DocumentLangSync() {
  const [, { getI18next }] = useTransContext();

  onMount(() => {
    const i18n = getI18next();
    applyDocumentLangDir(i18n.language);
    const handler = (lng: string) => applyDocumentLangDir(lng);
    i18n.on('languageChanged', handler);
    onCleanup(() => i18n.off('languageChanged', handler));
  });

  return null;
}
