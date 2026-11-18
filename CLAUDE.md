# CLAUDE.md — NetBoxPlus-Frontend (v2)

NetBoxPlus'ın frontend monorepo'su: müşteri sitesi (`apps/web`, Next.js) ve admin paneli (`apps/admin`, Vite + React).
İkisi de sadece backend'in gateway'iyle konuşur. Backend ayrı repoda: `NetBoxPlus-Backend` (branch `v2`).
Her geliştirmeden sonra bu dosya ve ilgili doküman güncellenir.

- Kararlar ve gerekçeleri: backend reposundaki `docs/ARCHITECTURE.md` §13 (özellikle §13.2 İstemciler)
- Aktif faz ve iş dökümü: backend reposundaki `docs/PHASE-8.md`

Bu dokümanlar **sadece lokalde** durur (backend'de `.gitignore`'da), GitHub'da yokturlar; commit'lenen hiçbir dosya
onlara link vermez. Orada karara bağlanmış bir konuyu yeniden tartışmaya açma; kararın yanlış olduğunu düşünüyorsan
gerekçesiyle söyle, karar değişirse önce dokümanı güncelle.

## Branch'ler

| Ref                   | Ne                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `master`              | Varsayılan branch, v2. Doğrudan commit yok: her iş kendi branch'inde (`phase8/<grup>-<konu>`) ve PR ile merge edilir. |
| `v1-graduation` (tag) | Eski bitirme projesinin (CRA, JavaScript) son hali. Sadece referans.                                                  |

## Yapı

```
apps/web          Next.js (App Router): katalog sayfaları sunucuda, kişisel her şey tarayıcıdan gateway'e
apps/admin        Vite + React SPA: girişin arkasında, statik dosya olarak sunulur
packages/ui       Tasarım token'ları (Tailwind v4 @theme) ve temel bileşenler
packages/i18n     tr/en metinler; anahtarlar derleme zamanında kontrol edilir
packages/config   Ortak tsconfig'ler ve Vitest kurulumu
```

Sıradaki paketler (Faz 8 A2): `packages/api` (OpenAPI'den üretilen tipler + client) ve `packages/core` (iki uygulamanın
ortak veri katmanı: gateway client'ları, oturum/CSRF, hata modeli, sorgu tanımları, oynatma oturumu, yükleme).

Paketler derlenmez; uygulamalar TypeScript kaynağını doğrudan alır (`transpilePackages` / Vite).

## Komutlar

Node 24 (`.node-version`) ve pnpm (`packageManager`'daki sürüm, corepack ile). Turborepo görevleri paketlere dağıtır.

```powershell
pnpm install
```

```powershell
pnpm dev
```

```powershell
pnpm build
```

```powershell
pnpm lint
```

```powershell
pnpm typecheck
```

```powershell
pnpm test
```

```powershell
pnpm format:check
```

- `pnpm dev`: web `http://localhost:5173`, admin `http://localhost:5174`. Portlar sabit: gateway'in CORS listesi
  (`Cors:PublicOrigins`/`AdminOrigins`), Billing'in Stripe dönüş adresleri ve e-posta linkleri bunlara göre.
- Turborepo anonim telemetri toplar; kapatmak için `TURBO_TELEMETRY_DISABLED=1` (CI'da set edilir).
- Testler Vitest + Testing Library; globals yok (`describe`/`it`/`expect` import edilir), DOM matcher'ları
  `@netboxplus/config/vitest/setup`'tan.

## Çalışma kuralları

- **Dil:** kullanıcıyla sohbet ve md dosyaları Türkçe. Kod, identifier, yorum, log/hata mesajı, test adları ve
  verisi, konfigürasyon, commit mesajları **İngilizce**. Arayüz metinleri `packages/i18n`'de (tr varsayılan, en);
  bileşenlere düz metin yazılmaz.
- Kullanıcı tasarımı kod yazmadan önce netleştirmek istiyor. Büyük bir değişiklikten önce yaklaşımı anlat, onay al.
- **Commit'lenen md dosyaları sadece `CLAUDE.md` ve `README.md`** (`.gitignore` diğer bütün md'leri dışarıda tutar).
- **GitHub'da hiçbir şey silinmez** (repo, branch, tag, release). Force push yok.
- Repo public. Secret'lar repoya girmez; `.env*` ignore'da (`.env.example` hariç).
- Lisans: MIT. Yeni paket eklemeden önce lisansını kontrol et.
- **Kalite çıtası canlı ürün:** güvenlik, performans, erişilebilirlik, SEO. Proje yine canlıya alınmaz.

## Bağımlılıklar

- Sürümler **en güncel** ve tam sabit (`^`/`~` yok). Build araçlarında açıklar sık çıkıyor; güncel kalmak kural.
  En güncel sürüm bir uyumsuzluk yüzünden alınamıyorsa (ör. typescript-eslint henüz TypeScript 7'yi desteklemiyor,
  TypeScript 6.0'da) sebebi burada yazılır:
  - `typescript` 6.0: typescript-eslint `<6.1` istiyor.
  - `eslint-plugin-jsx-a11y` ESLint'i 9'a kadar beyan ediyor ama ESLint 10'da çalışıyor (kurallarının çalıştığı
    denendi); `pnpm-workspace.yaml`'daki `peerDependencyRules` bu tek istisnayı kabul eder.
- `minimumReleaseAge: 1440`: bir günden yeni sürüm kurulmaz (ele geçirilmiş bir sürüm çoğunlukla saatler içinde fark
  edilir). Acil bir güvenlik yaması için bekleme süresi kısaltılmaz, ilgili paket `minimumReleaseAgeExclude`'a eklenir.
- Paket eklemek: `pnpm --filter <paket> add -E <ad>` (kök için `pnpm add -w -D -E <ad>`).

## Temel kurallar

- **TypeScript strict** (`noUncheckedIndexedAccess`, `verbatimModuleSyntax` dahil). Uyarıyı susturma, düzelt.
- **ESLint:** typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`, react-hooks, jsx-a11y `strict`, web'de
  Next `core-web-vitals`. Erişilebilirlik kuralları hata seviyesinde.
- **Erişilebilirlik:** gerçek `<button>`/`<a href>`/`<input>` + `<label>`; ikon düğmelerinde `aria-label`; görünür
  odak (`focus-visible` → `outline-focus`); metin kontrastı en az 4.5:1 (token'lar buna göre seçildi); "hareketi
  azalt" ayarında otomatik oynatma yok.
- **Tasarım token'ları** `packages/ui/src/theme.css`'te: renkler `canvas`, `surface`, `surface-raised`, `line`, `ink`,
  `ink-strong`, `ink-muted`, `brand`, `brand-strong`, `focus`; fontlar `font-sans` (Inter), `font-display`
  (Montserrat). Uygulamalarda ham hex yazılmaz.
- **Fontlar:** web `next/font/google` (build'de indirilip kendi sunucusundan servis edilir), admin `@fontsource`;
  ikisinde de sadece `latin` + `latin-ext` (Türkçe harfler).
- **Web güvenlik header'ları** `apps/web/next.config.ts`'te (`nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`,
  `Permissions-Policy`; `X-Powered-By` kapalı). Content-Security-Policy veri yükleyen ilk sayfalarla gelir.
- **Web build'i** `output: 'standalone'` (container image için).
- **Oturum:** token tarayıcıya hiç inmez; gateway'in `__Host-` cookie'si ve `X-CSRF-Token` (ARCHITECTURE §13.3).
