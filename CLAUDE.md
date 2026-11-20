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

`packages/core` `packages/api`'nin üstünde, iş kuralı içermez; sırada oynatma oturumu ve yükleme var. React'siz kısmı (katalog
okumaları `readTitles`/`readGenres`, `ageRatings`) ayrıca `@netboxplus/core/reads`'ten: sunucu bileşenleri ve route handler'lar
sadece onu import eder, ana giriş React context'i (`gateway.tsx`) getirir ve sunucu render'ını kırar.

Paketler derlenmez; uygulamalar TypeScript kaynağını doğrudan alır (`transpilePackages` / Vite).

## API client — `packages/api`

- **Kaynak:** `packages/api/openapi/*.json` backend'in `docs/openapi`'sinin bir commit'teki kopyası; commit
  `openapi/source.json`'da. Elle düzenlenmez. Güncellemek: `pnpm api:sync <commit|branch>` (GitHub'dan; branch
  commit'e çevrilir). Henüz push edilmemiş bir API değişikliğini denemek: `pnpm api:sync --from <backend checkout>`
  (`docs/openapi`'de commit'lenmemiş değişiklik varsa `--allow-dirty` ister ve `<commit>+local` yazar; bu hâliyle
  commit'lenmez, `--check` reddeder). `pnpm --filter @netboxplus/api sync --check`: kopya, kayıtlı commit'teki GitHub
  hâliyle aynı mı (CI).
- **Tipler** `pnpm generate` ile `src/generated/`'a (git'te yok; `immutable` değil: openapi-fetch'in `Readable<T>`'ı `readonly T[]`'i tanımıyor, yanıtlardaki dizileri metotsuz bir nesneye çeviriyordu); Turborepo `dev`, `build`, `lint`, `typecheck` ve
  `test`'ten önce kendisi çalıştırır. Elle yazılmış API tipi yok: şemalar `CatalogSchemas['PublishedMovie']` gibi
  `@netboxplus/api`'den. ASP.NET Core sayıları `integer | string` (rakam deseniyle) belgeler, string'den okumaya da izin verdiği
  için; hep sayı yazar. Üretici bunları `number` yapar (`scripts/numbers.ts`).
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
- **Sunucu tarafı önbellek** (`apps/web/src/server/catalog.ts`): katalog okumaları `unstable_cache` ile 60 sn, anahtar sadece
  yol + filtre + sayfa. Next'in fetch önbelleği header'ları da anahtara katıyor; her istekte farklı `X-Forwarded-For` ziyaretçi
  başına ayrı kopya demekti. Önbellekte olmayan istek yine ziyaretçinin limitine sayılır. Sitemap'in listesi `gatewayForServer()` ile
  saatte bir.
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
  `Permissions-Policy`; `X-Powered-By` kapalı). **Content-Security-Policy** `src/proxy.ts`'te sayfa başına yeni nonce'la
  (`src/content-security-policy.ts`): script'ler nonce + `'strict-dynamic'` (geliştirmede `'unsafe-eval'`), veri sadece site,
  gateway (`NEXT_PUBLIC_GATEWAY_URL`) ve storage (`STORAGE_ORIGINS`, boşlukla ayrılmış; lokalde `http://127.0.0.1:10000`).
  Nonce yüzünden her sayfa istek başına render edilir (layout `connection()`); statik sayfa nonce'suz kalıp script'leri bloklanırdı.
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
- **Profiller** (`apps/web/src/profiles`): girişten ve kayıttan sonra "Kim izliyor?" (`/<dil>/profiles?next=`); seçim web'in
  kendi host'unda `nbp-profile` cookie'si (`<id>.<maxAgeRating>`, bir yıl, `SameSite=Lax`; gizli değil, sınır değil: D'deki SSR
  sayfaları çocuk profiline `maxAgeRating` filtresini bununla uygular). `useProfileSelection()` cookie'yi `useSyncExternalStore` ile
  okur (sunucuda boş, hydration uyumlu). Profiller gelince silinmiş ya da yaşı değişmiş bir seçim düşer ve hesap sayfası değilse
  "Kim izliyor?"a gidilir; çıkış seçimi siler. En fazla 5 profil (Auth), ad 32 karakter; silme önce onay ister (Radix Dialog),
  son profilin silinemeyişini backend söyler.
- **Katalog sayfaları** (D): ana sayfa (billboard = popülerin görselli ilki, Top 10, Yeni, türe göre; ilk iki tür satırı SSR,
  kalanlar ekrana yaklaşınca `useTitleRow`), `/<dil>/movies` ve `/<dil>/series` (`?genre=<uuid>&sort=Newest&page=N`; tanınmayan
  değer filtresiz ilk sayfaya düşer; ızgara sonu yaklaşınca sonraki sayfayı yükler, "Daha fazla göster" JS'siz de `?page=`'e gider).
  Liste filtreleri sunucuda `nbp-profile` cookie'sindeki yaşla (`viewerAgeLimit()`). Görseller `next/image` `unoptimized` (Catalog
  tek boy saklıyor; compose'da Next sunucusu storage'ın tarayıcı adresine ulaşamaz). Kart önizlemesi CSS: fareli cihazda 500 ms
  sonra ya da klavye odağında büyür ("hareketi azalt"ta büyümez); ekran okuyucu önce başlığı okur (DOM'da önde, `order` ile altta).
  Girişli ama profil seçmemiş ziyaretçi hesap sayfaları dışında "Kim izliyor?"a gider. Mobilde menü alt sekme çubuğunda.
  SEO: sayfa başına canonical + `hreflang` (`metadataBase` = `SITE_URL`), `robots.txt`, `sitemap.xml` (yayındaki başlıklar, en
  fazla 10.000). Bilinmeyen adres `[...unknown]` ile sitenin kendi 404'ü; render hatası `error.tsx`.
- **Detay sayfaları** (D2): `/<dil>/movies/[id]`, `/<dil>/series/[id]`, `/<dil>/people/[id]` SSR; Catalog 404'ü ve uuid olmayan id
  sayfa 404'ü (`loadMovie`/`loadSeries`/`loadPerson` 404'te `null`). Hero: "yıl · yaş · süre/sezon", türler, özet, ses ve altyazı
  dilleri (`formatLanguages`: bölge sadece aynı dilin iki çeşidi varsa). Dizide sezon seçici (native select) ve bölümler; ekip
  rolüne göre, oyuncular `order`'a göre, kişi sayfasına link; benzerler = ilk türün aynı türden popülerleri, kendisi hariç (en fazla
  12). Meta: başlık, özetten açıklama, OG (`video.movie`/`video.tv_show`/`profile`, görsel), canonical + hreflang.
- **Fragman** (`TrailerBackdrop`, billboard ve detay hero'su): 2 sn sonra Streaming'e sorulur (`useTrailer`; 404 = yok), playlist
  Streaming'in gateway'deki köküne göre çözülür (yanıt göreli). hls.js dinamik import, Safari'de kendi HLS'i. **Hep sessiz, ses
  düğmesi yok**: fragmanların altyazısı yok (Streaming sadece orijinal sesi verir), sesli hâli WCAG 1.2.2'ye takılırdı. "Hareketi
  azalt"ta istenmez; yaşı seçili profilin sınırını aşan oynamaz (`isWithinAgeLimit`; profilsiz oynar). Ekran dışında ve gizli
  sekmede durur; bitince, hata verince ya da autoplay reddedilince görsele döner.
- **Arama** (`/<dil>/search?q=`, D3, `noindex`): kutu yazdıkça 300 ms sonra `?q=`'yu `router.replace` ile günceller (geçmişe kayıt
  eklemez), sonuçlar sayfa sayfa; `q` varsa ilk sayfa SSR (`loadSearch`, 503'te `unavailable`). Öneriler ARIA combobox (`/search/suggest`,
  en fazla 10; oklar, Enter başlığa gider, Esc kapatır, seçenek `onMouseDown` + `preventDefault` ile odak kutuda kalır). Boşken tür
  kısayolları. Backend araması tam kelime eşler, öneri önek. Kutu 200 karakterde durur.
- **Tür sayfası** (`/<dil>/genres/[id]`): türün film ve dizileri tek ızgarada; tek tür okuma ucu yok, ad `/genres` listesinden (yayında
  içeriği olmayan tür 404).
- **Kişisel veri** (`useWatchingProfile()`: oturum + seçili profil): sorgular profil id'siyle anahtarlı (`personalKeys`), profilsizken
  istek yok. İzlemeye devam et (en fazla 20) ve Listem satırları ana sayfada; Streaming sadece id verdiği için başlıklar
  `useTitlesByIds` ile (`/titles?ids=`, 100'lük parçalar, Streaming'in sırası). Dizide hangi bölüm olduğu yazmaz (dizi başına detay
  isteği gerekirdi); başlanmamış sıradaki bölüm "Sıradaki bölüm". Listem düğmesi (`MyListButton`) kartta bağlantının yanında (iç içe
  etkileşimli öğe yok), sadece profil varken; detayda etiketli, oturumsuz ziyaretçiyi girişe gönderir. Değişiklik iyimser, hata
  gelirse geri alınır ve hata kodundan metin gösterilir. `/<dil>/my-list` istemcide, `noindex`. Detayda filmde "x kaldı", dizide
  bölüm başına ilerleme çubuğu.
- **Planlar** (`/<dil>/plans`, E1): planlar SSR (`loadPlans`, 60 sn paylaşımlı önbellek; sitemap'te), fiyat kuruştan
  `formatPrice` ile (para biriminin ondalığına göre), kalite SD 480p / HD 1080p, ekran sayısı. Düğme ziyaretçiye göre tarayıcıda:
  oturumsuz → `/sign-up?next=/<dil>/plans` (kayıt ve giriş `next`'i birbirine ve profil seçimine taşır); e-posta doğrulanmamış →
  düğmeler kapalı + uyarı (yeniden gönderme üstteki şeritte); canlı abonelik (`isLive`: `Canceled` dışı, Billing'in kuralı) →
  planı işaretli, "Üyeliğini yönet" hesap sayfasına; aksi halde `POST /checkout-sessions` → Stripe'a gidilir (`leaveSiteFor`,
  testte taklit). Ödeme isteklerinin her denemesi yeni `Idempotency-Key` taşır. Ret gelirse metin + abonelik/doğrulama yeniden sorulur.
- **Hesap** (`/<dil>/account`, istemcide, `noindex`, profil gerekmez): üyelik (plan, durum, sonraki ödeme / sona erecek / sona erdi,
  başlangıç; PastDue/Incomplete uyarısı; bitmişse "Yeniden abone ol"), Stripe portalı düğmesi, faturalar tablosu (10'ar, "daha fazla",
  kart "Visa •••• 4242"). Billing'in dönüş adresi `/account/subscription` → `/<dil>/account` (query korunur); `?checkout=success`'te
  abonelik `Active` olana kadar 2 sn'de bir, en fazla 30 sn sorulur (webhook gecikmesi), sonra "birkaç dakika içinde" mesajı.
- **Hesap ayarları** (F, `/<dil>/account`): sıra giriş bilgileri, üyelik, faturalar, profiller, hesabı sil. Giriş bilgileri: adres
  (gateway oturumundaki access token'dan; e-posta değişikliği onaylansa da token yenilenene kadar, en fazla 15 dk, eskisi görünür),
  doğrulama rozeti ve gerekirse yeniden gönder; "E-postayı değiştir" / "Şifreyi değiştir" formları sayfa içinde, biri açıkken öteki
  kapalı, açılınca ilk alana odak. `showProblem`'in `byCode`'u alan bilgisi olmayan kodları alana koyar (`User.PasswordIncorrect`,
  `User.EmailTaken`, `User.EmailUnchanged`). Şifre değişince bu oturum sürer, diğerleri kapanır. Silme: Radix Dialog, şifre, canlı
  üyelikte "hemen ve iadesiz iptal" uyarısı; başarıda pencere "Hesabın silindi" der (`useDeleteAccount` sadece CSRF'i siler, oturumu
  silmez: sayfa ziyaretçiyi önce girişe atardı); "Ana sayfaya dön" ya da pencereyi kapatmak oturumu `null` yapar, diğer sorguları
  kaldırır (`clear()` değil: gözlemciler eski sorguda kalırdı), profil cookie'sini siler ve ana sayfaya gider; hesap sayfası bu sırada
  (`onLeave`) girişe yönlendirmez.
- **Oynatıcı** (`/<dil>/watch/[titleId]`, E2a, `noindex`; dizide `?episode=`, baştan `?from=start`): başlık SSR (adreste bölüm varsa
  önce dizi sorulur; bölümsüz dizi 404), oynatma istemcide, sayfanın üstünde `fixed` katman. Bölümsüz dizi profilin ilerlemesinden
  devam eder (`chooseEpisode`: son güncellenen; bittiyse sonraki, son bölüm bittiyse baştan). Oturum `usePlaybackSession`: başlatma
  bir sonraki turda (strict mode'un geri alınan mount'u istek atmaz), `heartbeatSeconds`'ta bir konum, duraklatma/atlamada en fazla
  5 sn'de bir ek heartbeat, kapanışta `DELETE ?positionSeconds=` ve ardından profilin kişisel sorguları yeniden sorulur; sekme
  kapanırken `keepalive` (CSRF header'ıyla ön kontrollü, Chromium'da çalışıyor; düşerse Streaming 2 dk sonra kapatır), geçmişten
  dönünce yeni oturum. Yeni oturum, hangi oynatıcının olursa olsun, öncekinin bitmesini bekler (modül düzeyinde `lastEnding`):
  tek ekranlı plan aksi halde 409 verirdi. Oynatıcının hiç göstermediği oturum kendi `resumeFromSeconds`'ıyla biter (konumu
  silmesin); konum video öğesinden değil son okunan değerden (öğe kapanışta yok). hls.js `startPosition`; medya hatası bir kez
  `recoverMediaError`, sonra pencere. Hata penceresi koda göre: üyelik → Planlar, yaş/profil → profil seçimi (`next` ile), ekran
  sınırı → Tekrar dene + Hesap, izlenemez → sadece Geri; kapatmak başlığa döner. Detayda "Oynat" / "Devam et · S1:B2" + "Baştan izle",
  bölüm listesinde oynat bağlantısı, İzlemeye devam et kartı oynatıcıya gider (`CardProgress.href`).
- **Oynatıcı ayarları** (E2b): tek menü (Radix Dropdown, radyo grupları) ses, altyazı ve kalite; seçeneği olmayan grup yok, hiç yoksa
  düğme yok (Safari'nin kendi HLS'inde menü yok). Adlar grup içinde `languageNames` ile (bölge sadece grupta aynı dilden iki varsa).
  Ses ve altyazı seçimi profile kaydedilir (`PUT /profiles/{id}/playback-preferences`, ikisi birlikte, açık kod); sonraki oturum onlarla
  başlar (master'da `DEFAULT=YES`). Kalite kaydedilmez (`currentLevel`, -1 otomatik; "Otomatik (720p)"). Menü ve hata penceresi
  oynatıcının içine açılır (tam ekranda görünsün). Kısayollar: Space/K, ←/→ 10 sn, ↑/↓ ses, M, F, C (altyazı aç/kapa, son seçilene);
  slider okları, odaklı düğmenin Space/Enter'ı, bağlantılar, menü/pencere içi ve Ctrl/Alt/Meta'lı tuşlar oynatıcının değil. Oynarken
  3 sn hareketsizlikte kontroller ve imleç gizlenir (`useIdle`; duraklatınca, menü açıkken, hata varken gizlenmez); gizliyken de
  tıklanabilir, fare hareketi/tuş/odak geri getirir, dokunmada video tıklaması kontrolleri açar. Sonraki bölüm: son 10 sn'de kart
  ("Şimdi oynat"/"Kapat"), bitince `router.replace` ile sonrakine (`from=start` düşer); kapatıldıysa başlığa dönülür.
  Testte hls.js taklidi ve yardımcıları `src/test/player.tsx` (`FakeHls.parse` izleri/seviyeleri verir, `setUpPlayerTests`).
- **Menü:** üstte Ana Sayfa, Diziler, Filmler, Listem ve arama ikonu; avatar menüsünde Profil değiştir, Hesap, Çıkış; mobil alt çubukta Ana Sayfa, Diziler, Filmler, Arama, Listem.
- **Admin paneli** (`apps/admin`, G1): Vite SPA, react-router (`createBrowserRouter`, sayfalar `src/routes.tsx`'te `RouteObject[]`),
  TanStack Query, react-hook-form + zod, Radix Dialog. Gateway'in admin oturumu (`/admin/session/...`, kendi cookie'si):
  `useAdminSession()` (401 = `null`, CSRF token'ını client'a verir); `src/data/gateway.tsx` client'ları ve dosya yüklemeyi
  (`upload`, testte taklit) sağlar. Oturumsuz her sayfa `/sign-in?next=<yer>`'e gider; çıkış düz `/sign-in`'e. Menü ve sayfalar
  permission'a göre (`can(session, 'catalog:genres:write')`, `src/paths.ts`'teki `sections`): görünmeyen bölümün adresi "yetkin yok"
  der, okuma izniyle form salt okunur (`fieldset disabled`), ana sayfa izinli ilk bölüme gider. Dil `tr`/`en` düğmeleri, seçim
  `localStorage`'da (`nbp-admin-lang`; erişilemezse sadece o sekme). Ortak form bileşenleri (`TextField`, `TextAreaField`,
  `SelectField`, `FormAlert`) `packages/ui`'da. Türler tek listede, ekleme/düzenleme pencerede (Türkçe ad zorunlu, boş çeviri
  gönderilmez); kişiler `?search=` (300 ms) ve `?page=` ile adreste, 20'şer. Kişi sayfasında kaydedilmemiş değişiklik varken başka
  sayfaya geçmek sorar (`useBlocker`). Görsel yükleme: tür ve boyut (JPEG/PNG/WebP, Catalog'un `maxBytes`'ı) önce tarayıcıda,
  sonra `POST /images/uploads` → imzalı adrese XHR `PUT` (`x-ms-blob-type: BlockBlob`, ilerleme yüzdesi) → `PUT .../photo`
  (`uploadId`); piksel ve oran Catalog'da. Silmeler onay penceresinde, ret (ör. `Genre.InUse`) pencerede gösterilir.
  Görsel yuvası ortak (`components/image-slot.tsx`), liste aramaları `useAddressSearch` (`?search=`, sayfa sıfırlanır, diğer
  filtreler kalır).
- **Admin filmleri** (G2): liste `?search=&status=&genreId=&page=`; film sayfası metinler (Türkçe zorunlu, İngilizce ya ikisi ya
  hiç), bilgiler, türler, ekip (sıra listedeki yer; karakter sadece oyuncuda; kişi arama penceresinden, aynı kişi aynı rolde bir
  kez; film rolleri Yönetmen/Senarist/Oyuncu, eski veride başka rol varsa seçilebilir kalır), afiş (2:3) ve arka plan (16:9),
  yayın ve silme. Dizilerle ortak form parçaları `catalog/content-form.tsx` (`FormProvider` + `useFormContext`); form alan adları
  backend'inkiyle aynı (`translations.tr.title`, `releaseYear`) ki doğrulama hataları alanlarına düşsün. **`Version`:** editör
  yüklediği sürümle çalışır; kendi kaydı ve görsel değişiklikleri (sürümü gönderir) onu bir artırır; yayınla/kaldır sürüm almaz,
  sonrasında film yeniden okunur ve yeni sürüm tam bir fazlaysa benimsenir (değilse arada başkası değiştirmiştir, kayıt çakışır).
  `Content.VersionConflict` formu korur, "Güncel hâli yükle" editörü yeniden açar. Yayınla: tür + afiş + oynatılabilir video
  listesi; eksikte ya da kaydedilmemiş değişiklikte kapalı (kayıtlı hâli yayınlar). Yayından kaldır sorar; yayındaki film
  silinemez, afişi kaldırılamaz. Permission'lar `catalog:movies:read|write|publish|delete`, görseller ayrıca
  `catalog:images:upload`.
- **Admin dizileri** (G3): liste filmlerle aynı (`TitleFilters`/`useTitleFilters`, `TitleList`; ek sütun sezon ve bölüm sayısı).
  Dizi sayfası filmle aynı parçalar (`catalog/title-sections.tsx`: görseller, yayın, silme, çakışma uyarısı; veri `data/titles.ts`,
  tür `movie`/`series`); rollerde Yaratıcı da var, süre yok. Sezon ve bölümler aynı sayfada (`seasons-editor.tsx`), ekleme ve
  düzenleme pencerede (varsayılan numara bir sonraki; sezon adı isteğe bağlı, boş dil gönderilmez; bölüm metinleri filmdeki kuralla).
  Sezon ve bölüm işlemleri dizinin `version`'ını taşır ve editörü bir artırır (`versioned`), pencereler ana formu kaydedilmemiş
  saymaz. Bölüm yayını videosuz kapalı; yayındaki dizinin son yayındaki bölümü kaldırılamaz; yayındaki bölüm ve yayında bölümü olan
  sezon silinemez (düğme kapalı, nedeni yazılı). Dizinin yayını en az bir yayındaki bölüm ister.
- **Formlar:** react-hook-form + zod; kurallar mesaj anahtarı taşır (`validation.*`), istemci sadece önceden söylenebileni
  denetler (şifre 12–128, Auth'un `PasswordPolicy`'si), asıl kural backend'de. E-postadaki tek kullanımlık token'ı gönderen
  sayfa onu bir kez gönderir (strict mode'un çift effect'i dahil).
- **Testler:** Vitest + Testing Library + MSW (`msw` 3: `server.listen({ onUnhandledFrame: 'error' })`); web'in yardımcısı
  `apps/web/src/test/render.tsx` (sağlayıcılar, strict mode, `next/navigation` taklidi). jsdom'da olmayan `IntersectionObserver`/
  `ResizeObserver` yerine `src/test/observers.ts` (hiçbir şey görünmez, `bringIntoView()`/`leaveView()`), `matchMedia` yerine
  `preferReducedMotion()`. Async sunucu bileşeni döndüren route'lar `serverRendered(Route(params))` ile render edilir. `renderPage`
  profil seçimini varsayılan olarak sarar ve her test oturumsuz başlar (`setup.ts`); `signInAs()` oturum + profil kurar.
  Admin'in yardımcısı `apps/admin/src/test/render.tsx`: `renderApp(path)` bütün paneli memory router'la (adres `locationOf(router)`),
  her test oturumsuz başlar, `signInWith(permissions)` oturum kurar.
