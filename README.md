# Synapse

**The stuff you’d forget—saved, searchable, and sorted—without another cloud service owning your brain.**

Synapse is a **private, on-device memory** for notes and photos. Capture what matters in seconds: type a thought, snap or import a picture, or **share from any app**. Google **Gemini** handles search and rich descriptions **only when you use those features**—your library stays on your phone.

---

## Why Synapse?

- **One place** for screenshots, study notes, receipts, ideas, and images—no scattered camera roll or lost browser tabs.
- **AI that works for you**: ask questions across everything you’ve saved; get **detailed, searchable captions** for photos so you can find them later by *what’s in the picture*, not the filename.
- **Lessons, not chaos**: optional **lesson folders** with AI-assisted filing, so course material doesn’t drown in random captures.
- **Built for real phones**: dark UI, masonry cards, smooth **flip**, **full-screen preview**, long-press moves, and **share targets** (in a dev/production build—not Expo Go limitations).

You’re not building another social feed. You’re building a **calm, fast extension of memory**.

---

## Features

### Capture & import

| Capability | What it does |
|------------|----------------|
| **Add memory** | Text notes, camera, gallery, or **clipboard image**—with optional **“Edit by AI”** to tidy lesson-style notes. |
| **Share → Synapse** | Send **text, links, or images** from other apps (requires a **development/production build** with `expo-share-intent`; not Expo Go on all flows). |
| **Screenshot import (“Shots”)** | Opt in to pull **new screenshots** from the library, **describe them with AI**, and drop them into your brain when you open the app (platform/permission rules apply). |

### Organize

| Capability | What it does |
|------------|----------------|
| **Lesson folders** | Filter the brain by lesson; **AI can suggest** an existing folder or a **new title** when you save. |
| **Move to lesson** | **Long-press** a card to re-file it. |
| **Delete mode** | Multi-select and remove memories you don’t need. |

### Browse & relive

| Capability | What it does |
|------------|----------------|
| **Masonry layout** | Pinterest-style columns; staggered entrance so new items feel **alive**, not flat. |
| **Flip card** | **Tap** a memory to flip it—**full caption**, **when it was added**, **source** (photo / share / screenshot), folder, and scrollable detail. |
| **Double-tap photo** | **Full-screen** image (**contain**, uncropped) with **small caption** underneath and a smooth **spring-open / fade** animation. |
| **Markdown-style text** | Notes render with readable structure (headings, emphasis) where supported. |

### Search & AI

| Capability | What it does |
|------------|----------------|
| **Brain search** | Query across your memories; Gemini returns a **concise answer** surfaced above the grid. |
| **Image understanding** | Rich **context** for images so search isn’t blind to pixels. |
| **Trust copy** | In-app explainer: **local library**; AI only when you use search, describe, or edit-by-AI flows. |

### Privacy & data

- Memories are **stored on device** (AsyncStorage); there is **no Synapse backend** that hosts your library.
- When you use AI, only what that action needs is sent to **Google Gemini** (per the feature you triggered).
- **API key** is supplied via `EXPO_PUBLIC_GEMINI_API_KEY` (see setup). Treat it like any client-side key: **restrict and rotate** in Google Cloud / AI Studio.

---

## Requirements

- **Node.js** (LTS recommended)
- **Expo / EAS** for builds ([Expo account](https://expo.dev))
- **Google Gemini API key** ([Google AI Studio](https://aistudio.google.com/apikey))

---

## Getting started

```bash
git clone <your-repo-url>
cd synapse-mobile
npm install
```

Create a `.env` file from the example:

```bash
cp .env.example .env
# Windows PowerShell: Copy-Item .env.example .env
```

Put your key in `.env`:

```env
EXPO_PUBLIC_GEMINI_API_KEY=your_key_here
```

Start the dev server:

```bash
npx expo start
```

Use a **development build** or **release APK** for share-intent, full screenshot flows on Android, and other native behaviors that **Expo Go** doesn’t cover.

---

## Building an Android APK (EAS)

1. Install and log in: `npm i -g eas-cli` → `eas login`
2. Configure env vars in EAS for **`EXPO_PUBLIC_GEMINI_API_KEY`** (e.g. **preview** / **production**; use **Sensitive** or **Plain text** visibility—`EXPO_PUBLIC_*` cannot be “Secret” in EAS).
3. From the project root:

   ```bash
   eas build -p android --profile preview
   ```

4. Open the build artifact link on your phone and install the **APK**.

If Git isn’t set up locally, you can use `EAS_NO_VCS=1` for a one-off upload (see [Expo VCS notes](https://expo.fyi/eas-vcs-workflow)).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Expo dev server |
| `npm run android` | Run on Android (`expo run:android`) |
| `npm run ios` | Run on iOS (`expo run:ios`) |
| `npm run lint` | Typecheck (`tsc --noEmit`) |

---

## Tech stack

- **Expo SDK 54** · **React Native 0.81** · **React 19**
- **Google GenAI** (`@google/genai`) for Gemini
- **expo-share-intent**, **expo-media-library**, **expo-image-picker**, **expo-file-system**, **AsyncStorage**
- **TypeScript** · **Lucide** icons · **expo-linear-gradient**

---

## Project structure (high level)

- `App.tsx` — main UI, AI flows, share/screenshot pipelines, card interactions
- `app.json` / `eas.json` — Expo config and EAS build profiles
- `plugins/` — custom config plugins if any
- `assets/` — icons and splash

---

## License

Private / all rights reserved—unless you add an explicit `LICENSE` file for open source.

---

**Synapse**: *stop losing the good stuff—keep it in a brain that’s yours.*
