# CLAUDE.md — NetBoxPlus-Frontend

NetBoxPlus'ın frontend monorepo'su: müşteri sitesi (`apps/web`, Next.js) ve admin paneli (`apps/admin`, Vite + React).
İkisi de sadece backend'in gateway'iyle konuşur. Backend ayrı repoda: `NetBoxPlus-Backend` (branch `master`).
Her geliştirmeden sonra bu dosya ve ilgili doküman güncellenir.

- Kararlar ve gerekçeleri: backend reposundaki `docs/ARCHITECTURE.md` §13 (özellikle §13.2 İstemciler)
- Aktif faz ve iş dökümü: backend reposundaki `docs/PHASE-8.md`

Bu dokümanlar **sadece lokalde** durur (backend'de `.gitignore`'da), GitHub'da yokturlar; commit'lenen hiçbir dosya
onlara link vermez. Orada karara bağlanmış bir konuyu yeniden tartışmaya açma; kararın yanlış olduğunu düşünüyorsan
gerekçesiyle söyle, karar değişirse önce dokümanı güncelle.

## Branch'ler

| Ref                   | Ne                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `master`              | Varsayılan branch. Doğrudan commit yok: her iş kendi branch'inde (`phase8/<grup>-<konu>`) ve PR ile, CI yeşilken merge edilir; merge edilen branch silinir. |
| `v1-graduation` (tag) | Eski bitirme projesinin (CRA, JavaScript) son hali. Sadece referans.                                                                                        |

## Yapı

```
apps/web          Next.js (App Router): katalog sayfaları sunucuda, kişisel her şey tarayıcıdan gateway'e
apps/admin        Vite + React SPA: girişin arkasında, statik dosya olarak sunulur
packages/api      Backend'in OpenAPI dokümanlarından üretilen tipler ve gateway client'ları
packages/core     İki uygulamanın ortak veri katmanı: gateway, oturum ve 401, sorgu/mutation hook'ları, hata metinleri
packages/ui       Tasarım token'ları (Tailwind v4 @theme) ve temel bileşenler
packages/i18n     tr/en metinler; anahtarlar derleme zamanında kontrol edilir
packages/config   Ortak tsconfig'ler ve Vitest kurulumu
```

`packages/core` `packages/api`'nin üstünde, iş kuralı içermez; sırada oynatma oturumu ve yükleme var.

Paketler derlenmez; uygulamalar TypeScript kaynağını doğrudan alır (`transpilePackages` / Vite).

## API client — `packages/api`

- **Kaynak:** `packages/api/openapi/*.json` backend'in `docs/openapi`'sinin bir commit'teki kopyası; commit
  `openapi/source.json`'da. Elle düzenlenmez. Güncellemek: `pnpm api:sync <commit|branch>` (GitHub'dan; branch
  commit'e çevrilir). Henüz push edilmemiş bir API değişikliğini denemek: `pnpm api:sync --from <backend checkout>`
  (`docs/openapi`'de commit'lenmemiş değişiklik varsa `--allow-dirty` ister ve `<commit>+local` yazar; bu hâliyle
  commit'lenmez, `--check` reddeder). `pnpm --filter @netboxplus/api sync --check`: kopya, kayıtlı commit'teki GitHub
  hâliyle aynı mı (CI).
- **Tipler** `pnpm generate` ile `src/generated/`'a (git'te yok); Turborepo `dev`, `build`, `lint`, `typecheck` ve
  `test`'ten önce kendisi çalıştırır. Elle yazılmış API tipi yok: şemalar `CatalogSchemas['PublishedMovie']` gibi
  `@netboxplus/api`'den.
- **İki yarı:** her servisin dokümanı ikiye bölünür (`scripts/split.ts`). Public yarı gateway'de `/<servis>/...`,
  admin yarı `/admin/<servis>/...` altında ve yolları `/admin`'siz (`/admin/users` → admin client'ta `/users`).
  `createPublicClients` (web) admin yollarını tipinde bile görmez, `createAdminClients` (admin) servislerin admin
  gruplarını ve `/admin/session`'ı verir. Gateway'in kendi dokümanı (`gateway.json`) oturum uçlarıdır, prefix'i yok.
- **Auth'un tarayıcıya açık yolları** `src/services.ts`'te (`/profiles`, `/email-verification`, `/email-change`);
  gateway'in proxy'lemediği token uçları (`/sign-in`, `/refresh`, `/me`...) hiç üretilmez. Gateway'e yeni bir Auth
  route'u açılırsa bu liste de güncellenir.
- **İstek:** `credentials: 'include'` varsayılan (cookie gateway'in host'unda); sunucu tarafı anonim çağrılar `omit`.
  `csrfToken` verilirse GET/HEAD/OPTIONS dışındaki her isteğe `X-CSRF-Token` eklenir (istek anında okunur).
- **Sunucudan gateway'e** (`apps/web/src/server/gateway.ts`): sayfa render ederken `gatewayForVisitor()` (ziyaretçinin isteği) veya
  `gatewayForServer()` (önceden render). İstekler `GATEWAY_INTERNAL_URL`'e, `X-NetBoxPlus-Server-Key` (`GATEWAY_SERVER_KEY`, backend'in
  `deploy/.env`'indeki değer) ve ziyaretçinin IP'siyle (`X-Forwarded-For`) gider; gateway rate limit'i ziyaretçi başına ve web
  sunucusunun toplamına sayar. IP sadece `TRUSTED_PROXY_HOPS` ≥ 1 ise, `x-forwarded-for`'un sağdan o sıradaki girdisinden alınır:
  Next header'ı sadece yoksa yazar, önünde proxy yokken (varsayılan 0) tarayıcı onu uydurabilir. Ayarlar `apps/web/.env.example`'da;
  `NEXT_PUBLIC_` öneki yok, tarayıcıya girmez. Anahtarsız istekte `X-Forwarded-For` gönderilmez.
- **Hatalar:** `unwrap(client.GET(...))` başarıda veriyi döner, hata durumunda `ApiError` atar: `status`, `code`
  (ör. `User.EmailTaken`), alan başına `fieldErrors`/`fieldErrorCodes`. Kullanıcıya `code`'a göre çevrilmiş metin
  gösterilir, backend'in `detail`'i geliştirici içindir. Ağ hatası olduğu gibi geçer.

## Komutlar

Node 26 LTS (`.node-version`) ve pnpm (`packageManager`'daki sürüm, corepack ile; Node 25'ten beri corepack Node'la gelmiyor:
`npm install --global corepack` ve `corepack enable`). Turborepo görevleri paketlere dağıtır.

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
- Turborepo ve Next.js anonim telemetri toplar; kapatmak için `TURBO_TELEMETRY_DISABLED=1` ve `NEXT_TELEMETRY_DISABLED=1`
  (CI'da ve image'larda set edilir).
- Testler Vitest + Testing Library; globals yok (`describe`/`it`/`expect` import edilir), DOM matcher'ları
  `@netboxplus/config/vitest/setup`'tan.

## CI ve image'lar

**CI** (`.github/workflows/ci.yml`, `master`'a push ve PR'larda): `pnpm install --frozen-lockfile` → OpenAPI kopyası
backend'in kayıtlı commit'iyle aynı mı (`sync --check`) → format → lint → typecheck → test → build →
`pnpm audit --audit-level moderate` (bilinen açık build'i kırar; çözüm güncelleme, istisna değil) → paralel olarak iki
image'ın build'i (push yok). Action'lar commit SHA'sıyla sabit. Dependabot (npm, actions, Docker) haftalık PR'ları
`master`'a açar, bir günlük beklemeyle (`cooldown`).

**Image'lar** repo kökünden build edilir:

```powershell
docker build --file apps/web/Dockerfile --tag netboxplus/web:local .
```

```powershell
docker build --file apps/admin/Dockerfile --tag netboxplus/admin:local .
```

- Build aşaması `node:<sürüm>-alpine`; paketler önce sadece lockfile'dan (`pnpm fetch`), sonra `--offline` kurulur.
- **web:** distroless Node 26 `nonroot` (shell yok, digest'le sabit), Next standalone, port 3000, `/health/live`.
- **admin:** `nginx-unprivileged` (uid 101), port 8080, `/health/live`. Hash'li dosyalar 1 yıl `immutable`,
  `index.html` `no-cache`, bilinmeyen yol `index.html`'e (istemci router'ı). Güvenlik header'ları
  `apps/admin/nginx/security-headers.conf`'ta ve her `location`'a `include` edilir (`location` içindeki `add_header`
  server'ınkileri siler). Source map yayınlanmaz.
- Base image sürümleri tam etiketle (`latest` yok) veya digest'le; Dependabot günceller.

## Çalışma kuralları

- **Dil:** kullanıcıyla sohbet ve md dosyaları Türkçe. Kod, identifier, yorum, log/hata mesajı, test adları ve
  verisi, konfigürasyon, commit mesajları **İngilizce**. Arayüz metinleri `packages/i18n`'de (tr varsayılan, en);
  bileşenlere düz metin yazılmaz.
- Kullanıcı tasarımı kod yazmadan önce netleştirmek istiyor. Büyük bir değişiklikten önce yaklaşımı anlat, onay al.
- **Commit'lenen md dosyaları sadece `CLAUDE.md` ve `README.md`** (`.gitignore` diğer bütün md'leri dışarıda tutar).
- **GitHub'da silinen tek şey merge edilmiş PR branch'leridir** (merge'den sonra, `gh pr merge --delete-branch`).
  Repo, tag, release, paket ve merge edilmemiş branch silinmez; gerekiyorsa kullanıcıya bırakılır. Force push yok.
- Repo public. Secret'lar repoya girmez; `.env*` ignore'da (`.env.example` hariç).
- Lisans: MIT. Yeni paket eklemeden önce lisansını kontrol et.
- **Kalite çıtası canlı ürün:** güvenlik, performans, erişilebilirlik, SEO. Proje yine canlıya alınmaz.

## Bağımlılıklar

- Sürümler **en güncel** ve tam sabit (`^`/`~` yok). Build araçlarında açıklar sık çıkıyor; güncel kalmak kural.
  En güncel sürüm bir uyumsuzluk yüzünden alınamıyorsa (ör. typescript-eslint henüz TypeScript 7'yi desteklemiyor,
  TypeScript 6.0'da) sebebi burada yazılır:
  - `typescript` 6.0: typescript-eslint `<6.1` istiyor ve openapi-typescript TypeScript 5/6 API'siyle çalışıyor (7'de
    JavaScript API'si yok). Dependabot TypeScript 7'yi önermez (`.github/dependabot.yml` `ignore`); ikisi de destekleyince kaldırılır.
  - `eslint-plugin-jsx-a11y` ESLint'i 9'a kadar beyan ediyor ama ESLint 10'da çalışıyor (kurallarının çalıştığı
    denendi).
  - `openapi-typescript` TypeScript 5 beyan ediyor ama 6'da aynı çıktıyı üretiyor (denendi).
  - İkisi de `pnpm-workspace.yaml`'daki `peerDependencyRules`'ta, gerekçesiyle; başka istisna yok.
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
  `packages/core`'da: `useSession()` `GET /session`'ı tutar (401 = `null`) ve CSRF token'ını gateway client'ına verir; giriş
  ve kayıt da token'ı yeniler, çıkış önbelleği boşaltır. Değişiklik yapan bir sayfa önce oturumun bilinmesini bekler (açık
  bir sekmede cookie gider, token'sız istek 403 `Csrf.Invalid` olur). Bir istek 401 `Session.Expired`/`Session.Required`
  alırsa (`createAppQueryClient`'ın `onSessionEnded`'ı) web önbelleği temizleyip `/<dil>/sign-in?next=<bulunduğu yer>`'e
  gider; `next` sadece site içi bir yolsa izlenir (`safeNextPath`). 4xx tekrar denenmez.
- **Hata metinleri:** `problemMessageKey(error)` backend'in `code`'una yazılmış metni (`error.User.EmailTaken`) yoksa
  hatanın türüne göre olanı verir; `fieldMessageKeys` alan başına (backend alanları kendi adıyla yazar: `NewPassword`;
  formlar büyük/küçük harfe bakmadan eşler). Backend'in `detail`'i gösterilmez. Hesabın varlığı belli olmaz (giriş hatası
  hep aynı, şifre sıfırlama hep "gönderdik").
- **Dil ve adresler:** her sayfa `/<dil>/...` altında (`tr`, `en`). Dilsiz bir adres (e-postadaki `/verify-email?token=…`
  linkleri dahil) `src/proxy.ts`'te query'siyle birlikte `nbp-lang` cookie'sine, yoksa `Accept-Language`'a göre, yoksa `tr`'ye
  yönlendirilir. Metinler `useLocale().t` (istemci) ve `translatorFor(params)` (sunucu).
- **Formlar:** react-hook-form + zod; kurallar mesaj anahtarı taşır (`validation.*`), istemci sadece önceden söylenebileni
  denetler (şifre 12–128, Auth'un `PasswordPolicy`'si), asıl kural backend'de. E-postadaki tek kullanımlık token'ı gönderen
  sayfa onu bir kez gönderir (strict mode'un çift effect'i dahil).
- **Testler:** Vitest + Testing Library + MSW (`msw` 3: `server.listen({ onUnhandledFrame: 'error' })`); web'in yardımcısı
  `apps/web/src/test/render.tsx` (sağlayıcılar, strict mode, `next/navigation` taklidi).
