/** Turkish is the default language; every other locale must define the same keys. */
export const tr = {
  'brand.name': 'NetBoxPlus',
  'web.comingSoon.title': 'Çok yakında',
  'web.comingSoon.body': 'NetBoxPlus yeniden yapılıyor. Filmler ve diziler çok yakında burada.',
  'admin.title': 'NetBoxPlus Yönetim',
  'admin.comingSoon': 'Yönetim paneli hazırlanıyor.',
} as const;

export type MessageKey = keyof typeof tr;
export type Messages = Readonly<Record<MessageKey, string>>;
