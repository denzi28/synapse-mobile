# Synapse Mobile

## Türkçe

**Unutacağın şeyleri kaydet, ara ve düzenle. Hafızana başka bir bulut şirketi sahip olmasın.**

Synapse, notların ve fotoğrafların için **telefonda kalan, gizliliğe önem veren bir hafıza** uygulamasıdır. Düşünceni yaz, fotoğraf ekle veya içe aktar, **diğer uygulamalardan paylaş**. **Google Gemini** yalnızca **arama, açıklama veya YZ ile düzenle** gibi özellikleri kullandığında devreye girer. Kütüphanen cihazında kalır.

### Neden Synapse?

- **Tek yer:** Ekran görüntüleri, ders notları, fişler, fikirler ve görseller. Dağınık galeri veya kaybolan sekmeler değil.
- **Senin için çalışan YZ:** Kaydettiklerin arasında soru sor; fotoğraflar için **aranabilir, ayrıntılı açıklamalar** (dosya adına değil, görüntüdekilere göre arama).
- **Ders klasörleri:** İsteğe bağlı **ders klasörleri** ve YZ destekli dosyalama; ders materyali kaybolmaz.
- **Gerçek telefonlar için:** Koyu arayüz, masonry kartlar, **çevirmeli kart**, **tam ekran önizleme**, uzun basarak taşıma, geliştirme veya production derlemesinde **paylaşım hedefi** (Expo Go’nun kısıtladığı yerel API’ler için tam sürüm gerekir).

### Türkçe ve İngilizce arayüz

- Arama çubuğunun yanındaki **bayraklar** (🇬🇧 İngilizce, 🇹🇷 Türkçe) ile anında dil değişir.
- Seçim **cihazda saklanır** (AsyncStorage), uygulamayı tekrar açınca aynı dil gelir.
- İlk açılışta telefon dili **Türkçe ise** (veya `tr` ile başlıyorsa) varsayılan genelde Türkçedir; değilse İngilizce. İstediğin zaman bayrakla değiştirebilirsin.
- Metinler `i18n/locales/en.ts` ve `i18n/locales/tr.ts` içindedir. Daha önce kaydettiğin **not ve YZ açıklamalarının içeriği** dil değişince çevrilmez; **butonlar, uyarılar, yer tutucular** çevrilir.

### Özellikler

**Yakalama ve içe aktarma**

| Özellik | Açıklama |
|---------|----------|
| **Anı ekle** | Metin, galeri, panodan görsel; isteğe bağlı **YZ ile düzenle** ile ders notu düzeni. |
| **Paylaş → Synapse** | Diğer uygulamalardan **metin, bağlantı veya görsel** (`expo-share-intent` ile **dev/production derleme**; her akış Expo Go’da olmayabilir). |
| **Kareler (ekran görüntüsü)** | Yeni ekran görüntülerini kütüphaneden alıp **YZ ile açıkla**; uygulamayı açınca eklenir (platform ve izin kuralları geçerli). |

**Düzenleme**

| Özellik | Açıklama |
|---------|----------|
| **Ders klasörleri** | Derse göre filtre; kaydederken YZ **mevcut klasör** veya **yeni başlık** önerebilir. |
| **Derse taşı** | Kartta **uzun bas** ile yeniden dosyala. |
| **Silme modu** | Çoklu seçim ile Synapse’tan kaldırma. |

**Gezinme**

| Özellik | Açıklama |
|---------|----------|
| **Masonry** | İki sütun, yeni öğeler için kademeli giriş animasyonu. |
| **Kart çevir** | Dokun: **açıklama**, **eklenme zamanı**, **kaynak** (foto, paylaşım, ekran görüntüsü), klasör, kaydırılabilir detay. |
| **Fotoğrafa çift dokun** | Tam ekran (**contain**), altta kısa açıklama, animasyon. |
| **Not biçimi** | Başlık ve vurgu gibi okunaklı yapı (desteklendiği ölçüde). |

**Arama ve YZ**

| Özellik | Açıklama |
|---------|----------|
| **Hafızada ara** | Tüm anılarda soru; Gemini **kısa yanıt** ve ızgaranın üstünde özet. |
| **Görsel anlama** | Görseller için zengin **bağlam**, arama pikselleri yoksaymasın diye. |
| **Güven metni** | Uygulama içi açıklama: veri yerelde; YZ yalnızca kullandığın özelliklerde. |

### Gizlilik ve veri

- Anılar **cihazda** tutulur (AsyncStorage). Senin kütüphaneni barındıran ayrı bir **Synapse sunucusu yoktur**.
- YZ kullanıldığında yalnızca o işlem için gerekli veri **Google Gemini**’ye gider.
- Anahtar **istemci tarafı** olduğu için `EXPO_PUBLIC_GEMINI_API_KEY` ile gelir; Google Cloud / AI Studio’da **kısıtla ve döndür**.

### Gereksinimler

- **Node.js** (LTS önerilir)
- Derlemeler için **Expo / EAS** ([expo.dev](https://expo.dev))
- **Google Gemini API** anahtarı ([Google AI Studio](https://aistudio.google.com/apikey))
- Çeviri: **i18next**, **react-i18next**, **expo-localization**

### Kurulum

```bash
git clone <your-repo-url>
cd synapse-mobile
npm install
```

`.env` dosyası:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

`.env` içine:

```env
EXPO_PUBLIC_GEMINI_API_KEY=your_key_here
```

Geliştirme sunucusu:

```bash
npx expo start
```

Paylaşım hedefi, Android’de tam ekran görüntüsü akışı ve benzeri için **development build** veya **APK** kullan; **Expo Go** her özelliği kapsamaz.

### Android APK (EAS)

1. `npm i -g eas-cli` ve `eas login`
2. EAS ortam değişkenlerinde `EXPO_PUBLIC_GEMINI_API_KEY` (örnek: preview veya production). **Sensitive** veya **Plain text**; `EXPO_PUBLIC_*` EAS’ta Secret olamaz.
3. Proje kökünde: `eas build -p android --profile preview`
4. Telefonda bağlantıdan **APK** kur.

Yerelde Git yoksa: `EAS_NO_VCS=1` ile tek seferlik yükleme mümkün ([Expo VCS](https://expo.fyi/eas-vcs-workflow)).

### Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm start` | Expo geliştirme sunucusu |
| `npm run android` | Android (`expo run:android`) |
| `npm run ios` | iOS (`expo run:ios`) |
| `npm run lint` | TypeScript kontrolü (`tsc --noEmit`) |

### Teknolojiler

- **Expo SDK 54**, **React Native 0.81**, **React 19**
- **@google/genai** (Gemini)
- **expo-share-intent**, **expo-media-library**, **expo-image-picker**, **expo-file-system**, **AsyncStorage**
- **i18next**, **react-i18next**, **expo-localization**
- **TypeScript**, **Lucide**, **expo-linear-gradient**

### Proje yapısı (özet)

- `App.tsx`: ana arayüz, YZ akışları, paylaşım ve ekran görüntüsü, kart etkileşimleri
- `i18n/`: başlatma ve `locales/en.ts`, `locales/tr.ts`
- `app.json`, `eas.json`: Expo ve EAS
- `plugins/`: isteğe bağlı eklentiler
- `assets/`: ikon ve splash

### Lisans

Açık kaynak `LICENSE` eklemediğin sürece **özel / tüm hakları saklıdır**.

**Synapse:** kaybetme; kendi hafızanda tut.

## English

**The stuff you would forget, saved, searchable, and sorted, without another cloud service owning your brain.**

Synapse is a **private, on-device memory** for notes and photos. Capture what matters in seconds: type a thought, snap or import a picture, or **share from any app**. Google **Gemini** handles search and rich descriptions **only when you use those features**. Your library stays on your phone.

### Why Synapse?

- **One place** for screenshots, study notes, receipts, ideas, and images. No scattered camera roll or lost browser tabs.
- **AI that works for you**: ask questions across everything you have saved; get **detailed, searchable captions** for photos so you can find them later by what is in the picture, not the filename.
- **Lessons, not chaos**: optional **lesson folders** with AI-assisted filing, so course material does not drown in random captures.
- **Built for real phones**: dark UI, masonry cards, smooth **flip**, **full-screen preview**, long-press moves, and **share targets** in a dev or production build (not limited by Expo Go where native APIs are required).

You are not building another social feed. You are building a **calm, fast extension of memory**.

### Languages (English and Turkish)

The app UI is available in **English** and **Turkish**.

- Use the **flag toggles** next to the search row (United Kingdom for English, Turkey for Turkish) to switch language at any time.
- Your choice is **saved on the device** (AsyncStorage) and restored when you open the app again.
- The **first launch** picks a default from the phone language: if the system language is Turkish (or starts with `tr`), the app starts in Turkish; otherwise it starts in English. You can change this anytime with the flags.
- Strings live under `i18n/locales/en.ts` and `i18n/locales/tr.ts`. Alerts, buttons, placeholders, and accessibility labels follow the active language.
- **Note:** Content you already saved (your own notes, AI captions, or demo memories) stays as you wrote it. Language switching affects **interface text**, not your stored memory bodies.

### Features

#### Capture and import

| Capability | What it does |
|------------|----------------|
| **Add memory** | Text notes, camera, gallery, or **clipboard image**, with optional **Edit by AI** to tidy lesson-style notes. |
| **Share to Synapse** | Send **text, links, or images** from other apps (needs a **development or production** build with `expo-share-intent`; not all flows work in Expo Go). |
| **Screenshot import (Shots)** | Opt in to pull **new screenshots** from the library, **describe them with AI**, and add them when you open the app (platform and permission rules apply). |

#### Organize

| Capability | What it does |
|------------|----------------|
| **Lesson folders** | Filter the brain by lesson; **AI can suggest** an existing folder or a **new title** when you save. |
| **Move to lesson** | **Long-press** a card to re-file it. |
| **Delete mode** | Multi-select and remove memories you do not need. |

#### Browse and relive

| Capability | What it does |
|------------|----------------|
| **Masonry layout** | Pinterest-style columns; staggered entrance so new items feel **alive**, not flat. |
| **Flip card** | **Tap** a memory to flip it: **full caption**, **when it was added**, **source** (photo, share, screenshot), folder, and scrollable detail. |
| **Double-tap photo** | **Full-screen** image (**contain**, uncropped) with **small caption** underneath and a smooth **spring-open / fade** animation. |
| **Markdown-style text** | Notes render with readable structure (headings, emphasis) where supported. |

#### Search and AI

| Capability | What it does |
|------------|----------------|
| **Brain search** | Query across your memories; Gemini returns a **concise answer** surfaced above the grid. |
| **Image understanding** | Rich **context** for images so search is not blind to pixels. |
| **Trust copy** | In-app explainer: **local library**; AI only when you use search, describe, or edit-by-AI flows. |

#### Privacy and data

- Memories are **stored on device** (AsyncStorage). There is **no Synapse backend** that hosts your library.
- When you use AI, only what that action needs is sent to **Google Gemini** for the feature you triggered.
- The **API key** is supplied via `EXPO_PUBLIC_GEMINI_API_KEY` (see setup). Treat it like any client-side key: **restrict and rotate** in Google Cloud or AI Studio.

### Requirements

- **Node.js** (LTS recommended)
- **Expo / EAS** for builds ([Expo account](https://expo.dev))
- **Google Gemini API key** ([Google AI Studio](https://aistudio.google.com/apikey))

Dependencies for localization include **i18next**, **react-i18next**, and **expo-localization**.

### Getting started

```bash
git clone <your-repo-url>
cd synapse-mobile
npm install
```

Create a `.env` file from the example:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Put your key in `.env`:

```env
EXPO_PUBLIC_GEMINI_API_KEY=your_key_here
```

Start the dev server:

```bash
npx expo start
```

Use a **development build** or **release APK** for share-intent, full screenshot flows on Android, and other native behaviors that **Expo Go** does not cover.

### Building an Android APK (EAS)

1. Install and log in: `npm i -g eas-cli`, then `eas login`.
2. Configure env vars in EAS for `EXPO_PUBLIC_GEMINI_API_KEY` (for example preview or production). Use **Sensitive** or **Plain text** visibility. Keys named `EXPO_PUBLIC_...` cannot be Secret in EAS.
3. From the project root:

   ```bash
   eas build -p android --profile preview
   ```

4. Open the build artifact link on your phone and install the **APK**.

If Git is not set up locally, you can use `EAS_NO_VCS=1` for a one-off upload (see [Expo VCS notes](https://expo.fyi/eas-vcs-workflow)).

### Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Expo dev server |
| `npm run android` | Run on Android (`expo run:android`) |
| `npm run ios` | Run on iOS (`expo run:ios`) |
| `npm run lint` | Typecheck (`tsc --noEmit`) |

### Tech stack

- **Expo SDK 54**, **React Native 0.81**, **React 19**
- **Google GenAI** (`@google/genai`) for Gemini
- **expo-share-intent**, **expo-media-library**, **expo-image-picker**, **expo-file-system**, **AsyncStorage**
- **i18next**, **react-i18next**, **expo-localization**
- **TypeScript**, **Lucide** icons, **expo-linear-gradient**

### Project structure (high level)

- `App.tsx`: main UI, AI flows, share and screenshot pipelines, card interactions
- `i18n/`: `i18n.ts` bootstrap, `locales/en.ts` and `locales/tr.ts` strings
- `app.json` / `eas.json`: Expo config and EAS build profiles
- `plugins/`: custom config plugins if any
- `assets/`: icons and splash

### License

Private / all rights reserved, unless you add an explicit `LICENSE` file for open source.

**Synapse:** stop losing the good stuff. Keep it in a brain that is yours.
