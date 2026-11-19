import { createTranslator, isLocale, type MessageKey } from '@netboxplus/i18n';
import { notFound } from 'next/navigation';

/** The texts of a page's language, from its route parameters; any other language is a 404. */
export async function translatorFor(params: Promise<{ lang: string }>): Promise<(key: MessageKey) => string> {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }
  return createTranslator(lang);
}

export async function pageTitle(params: Promise<{ lang: string }>, key: MessageKey): Promise<string> {
  return (await translatorFor(params))(key);
}
