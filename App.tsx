import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Dimensions,
  Image,
  InteractionManager,
  LayoutChangeEvent,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useShareIntent, type ShareIntent } from 'expo-share-intent';
import { GoogleGenAI, Type } from '@google/genai';
import {
  Brain,
  Camera,
  Check,
  CheckSquare,
  Crop as CropIcon,
  Folder,
  Image as ImageIcon,
  Info,
  Plus,
  Search,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import i18n, { initI18n, setAppLanguage } from './i18n/i18n';

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

function getGeminiOrNetworkMessage(error: unknown): string {
  if (error instanceof SyntaxError) {
    return i18n.t('errors.unexpectedAiResponse');
  }
  const msg =
    error != null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as Error).message === 'string'
      ? (error as Error).message
      : error != null
        ? String(error)
        : '';
  const lower = msg.toLowerCase();
  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('internet') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('enotfound') ||
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('aborted') ||
    lower.includes('socket') ||
    lower.includes('timeout')
  ) {
    return i18n.t('errors.networkOffline');
  }
  if (
    lower.includes('429') ||
    lower.includes('rate') ||
    lower.includes('quota') ||
    lower.includes('resource exhausted') ||
    lower.includes('too many requests')
  ) {
    return i18n.t('errors.rateLimited');
  }
  if (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('api key') ||
    lower.includes('permission denied') ||
    lower.includes('invalid key')
  ) {
    return i18n.t('errors.apiKeyBody');
  }
  return i18n.t('errors.networkBody');
}

function alertGeminiOrNetworkError(
  error?: unknown,
  options?: { title?: string; extra?: string }
) {
  const title = options?.title ?? i18n.t('errors.cannotReachAi');
  let message = getGeminiOrNetworkMessage(error);
  if (options?.extra) message += `\n\n${options.extra}`;
  Alert.alert(title, message, [{ text: i18n.t('common.ok') }]);
}

/** When user opts in to "Edit by AI", reorganize raw notes (lesson detection + structure inside prompt). */
async function organizeLessonNotesWithAi(rawNotes: string): Promise<string> {
  const trimmed = rawNotes.trim();
  if (!trimmed) return rawNotes;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `User notes (verbatim):\n${JSON.stringify(trimmed)}\n\nInstructions:
1. If this is primarily lesson, lecture, study, or course material, reorganize it: a concise title on line 1, then a blank line, then sections with ## markdown headings—make each heading short, concrete, and energetic (not generic like "Notes" or "Part 2"). Use bullet points for key facts and definitions, numbered lists only when order matters, and wrap especially important terms in **bold** sparingly so the note feels scannable.
2. If it is clearly not academic (e.g. grocery list, password, short reminder), keep every fact accurate—only fix typos, line breaks, and light formatting. Do not invent fake lesson sections.
3. Output ONLY the final note text. No preamble, quotes around the output, or explanation.`,
  });
  const out = (response.text || '').trim();
  return out || trimmed;
}

type LessonFolder = { id: string; name: string };

type Memory = {
  id: string;
  type: 'text' | 'image';
  content: string;
  context: string;
  date: string;
  /** ISO timestamp when first saved in Synapse (older items may omit). */
  addedAt?: string;
  /** Optional lesson collection for filtering. */
  folderId?: string;
  /** Screenshot import: image is shown first; AI caption fills in after. */
  captionPending?: boolean;
};

type PendingFolderDraft = {
  type: 'text' | 'image';
  content: string;
  context: string;
  suggestedNewTitle?: string | null;
};

type PendingImage = { uri: string; mimeType: string };

const INITIAL_MEMORIES: Memory[] = [
  {
    id: '1',
    type: 'image',
    content:
      'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=800',
    context:
      'Book cover of "Atomic Habits" by James Clear. Yellow background. Book recommendation from Sarah about building good habits and productivity.',
    date: '2 hours ago',
    addedAt: '2026-03-26T10:00:00.000Z',
  },
  {
    id: '2',
    type: 'text',
    content: 'Wifi password for the Airbnb in Rome: ROME2026!',
    context: 'Wifi password for the Airbnb in Rome: ROME2026!',
    date: 'Yesterday',
    addedAt: '2026-03-25T18:30:00.000Z',
  },
  {
    id: '3',
    type: 'image',
    content:
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=800',
    context:
      'Black leather bomber jacket, $250, seen on Instagram. Has silver zippers, a ribbed collar, and looks vintage or distressed.',
    date: '3 days ago',
    addedAt: '2026-03-23T12:00:00.000Z',
  },
  {
    id: '4',
    type: 'image',
    content:
      'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=800',
    context:
      'A sleek black winter coat, long trench style. Found on a fashion blog. Good alternative to the bomber jacket.',
    date: '4 days ago',
    addedAt: '2026-03-22T09:15:00.000Z',
  },
];

/** Raw base64 (no data: prefix) for Gemini inlineData. */
async function uriToGeminiBase64(uri: string): Promise<string> {
  if (uri.startsWith('data:')) {
    const idx = uri.indexOf(',');
    if (idx === -1) throw new Error('Invalid data URI');
    return uri.slice(idx + 1);
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

const STORAGE_MEMORIES = '@synapse/memories_v1';
const STORAGE_LESSON_FOLDERS = '@synapse/lesson_folders_v1';
const STORAGE_SCREENSHOT_SYNC = '@synapse/screenshot_sync_enabled';
const STORAGE_SCREENSHOT_IDS = '@synapse/processed_screenshot_asset_ids';
const STORAGE_SCREENSHOT_INTRO = '@synapse/screenshot_sync_intro_shown';

/** Expo Go on Android cannot grant photo read; expo-media-library throws or only requests audio. */
function isAndroidExpoGo(): boolean {
  return Platform.OS === 'android' && Constants.appOwnership === 'expo';
}

/** Android dev/production builds need explicit photo scope; iOS uses full read when omitted. */
function mediaLibraryGranularPhoto(): 'photo'[] | undefined {
  if (Platform.OS !== 'android') return undefined;
  if (Constants.appOwnership === 'expo') return undefined;
  return ['photo'];
}

function scheduleAfterAlert(fn: () => void) {
  InteractionManager.runAfterInteractions(() => {
    setTimeout(fn, 400);
  });
}

async function loadScreenshotIdSet(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_SCREENSHOT_IDS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

async function persistScreenshotIdSet(ids: Set<string>) {
  await AsyncStorage.setItem(STORAGE_SCREENSHOT_IDS, JSON.stringify([...ids]));
}

/** Screenshots album (locale-aware name) or filename fallback. */
async function fetchScreenshotAssets(): Promise<MediaLibrary.Asset[]> {
  if (isAndroidExpoGo()) return [];

  const granular = mediaLibraryGranularPhoto();
  const perm = await MediaLibrary.getPermissionsAsync(false, granular);
  if (!perm.granted) return [];

  const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbum: true });
  const screenshotAlbum = albums.find((a) => /screenshot|screen[\s_-]?shot|截屏|屏幕快照/i.test(a.title));

  if (screenshotAlbum) {
    const page = await MediaLibrary.getAssetsAsync({
      album: screenshotAlbum,
      first: 150,
      sortBy: MediaLibrary.SortBy.creationTime,
      mediaType: MediaLibrary.MediaType.photo,
    });
    return page.assets;
  }

  const page = await MediaLibrary.getAssetsAsync({
    first: 120,
    sortBy: MediaLibrary.SortBy.creationTime,
    mediaType: MediaLibrary.MediaType.photo,
  });
  return page.assets.filter((a) => {
    const n = (a.filename || '').toLowerCase();
    return (
      n.includes('screenshot') || n.includes('screencap') || n.includes('screen_shot') || n.includes('screen-')
    );
  });
}

function formatSynapseTimestamp(iso?: string, friendlyDate?: string, t?: TFunction): string {
  const justNowMarker = 'Just now';
  if (iso) {
    try {
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) {
        const abs = d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        if (friendlyDate && friendlyDate !== justNowMarker) return `${abs} · ${friendlyDate}`;
        return abs;
      }
    } catch {
      /* fall through */
    }
  }
  return friendlyDate || (t ? t('common.unknown') : 'Unknown');
}

function memorySourceLabel(memory: Memory, translate: TFunction): string {
  if (memory.id.startsWith('shot-')) return translate('card.srcScreenshot');
  if (memory.id.startsWith('share-')) return translate('card.srcShare');
  return memory.type === 'image' ? translate('card.srcPhoto') : translate('card.srcText');
}

function splitIntoColumns(items: Memory[]) {
  const left: Memory[] = [];
  const right: Memory[] = [];
  items.forEach((m, i) => {
    if (i % 2 === 0) left.push(m);
    else right.push(m);
  });
  return { left, right };
}

function filterMemoriesByFolder(list: Memory[], activeFolderId: string | null) {
  if (activeFolderId === null) return list;
  return list.filter((m) => m.folderId === activeFolderId);
}

async function resolveLessonFolderWithAi(
  noteSummary: string,
  folders: LessonFolder[]
): Promise<{
  decision: 'use_existing' | 'create_new' | 'ask_user';
  matchedFolderId: string | null;
  newLessonTitle: string | null;
}> {
  const clipped = noteSummary.slice(0, 2400);
  const folderLines =
    folders.length === 0
      ? '(none — no lesson folders yet)'
      : folders.map((f) => `- id=${f.id} | name=${f.name}`).join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `File this new memory into a lesson folder for the user's study brain.

Existing folders (if you choose use_existing, matchedFolderId MUST exactly equal one of these ids):
${folderLines}

Memory content (note text, caption, or description of a photo/slide/screenshot):
${JSON.stringify(clipped)}

Choose:
- use_existing: it clearly belongs to exactly one listed folder (same course/topic).
- create_new: there is a clear new lesson/course name (often in the first line) and it does not match an existing folder.
- ask_user: ambiguous, could fit several folders, non-study clutter, passwords, or you are not sure.

Rules: For use_existing set matchedFolderId only. For create_new set newLessonTitle (short label, 2–8 words, no "Folder:" prefix). For ask_user leave matchedFolderId and newLessonTitle empty or null.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          decision: {
            type: Type.STRING,
            description: 'Exactly one of: use_existing, create_new, ask_user',
          },
          matchedFolderId: { type: Type.STRING },
          newLessonTitle: { type: Type.STRING },
        },
        required: ['decision'],
      },
    },
  });

  let parsed: { decision?: string; matchedFolderId?: string; newLessonTitle?: string };
  try {
    parsed = JSON.parse(response.text || '{}');
  } catch {
    return { decision: 'ask_user', matchedFolderId: null, newLessonTitle: null };
  }

  const dec = parsed.decision;
  const decision: 'use_existing' | 'create_new' | 'ask_user' =
    dec === 'use_existing' || dec === 'create_new' || dec === 'ask_user' ? dec : 'ask_user';

  return {
    decision,
    matchedFolderId: parsed.matchedFolderId?.trim() || null,
    newLessonTitle: parsed.newLessonTitle?.trim() || null,
  };
}

type NoteBlock =
  | { kind: 'spacer' }
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'ordered'; num: number; text: string }
  | { kind: 'para'; text: string };

function parseNoteBlocks(raw: string): NoteBlock[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: NoteBlock[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind !== 'spacer') blocks.push({ kind: 'spacer' });
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 1) blocks.push({ kind: 'h1', text });
      else if (level === 2) blocks.push({ kind: 'h2', text });
      else blocks.push({ kind: 'h3', text });
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      blocks.push({ kind: 'bullet', text: bullet[1].trim() });
      continue;
    }
    const ordered = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (ordered) {
      blocks.push({ kind: 'ordered', num: parseInt(ordered[1], 10), text: ordered[2].trim() });
      continue;
    }
    blocks.push({ kind: 'para', text: trimmed });
  }
  return blocks;
}

function splitBoldSegments(text: string): { text: string; bold?: boolean }[] {
  if (!text.includes('**')) return [{ text }];
  const out: { text: string; bold?: boolean }[] = [];
  const re = /\*\*([\s\S]*?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text }];
}

function MdInline({
  text,
  baseStyle,
  boldStyle,
}: {
  text: string;
  baseStyle: TextStyle;
  boldStyle: TextStyle;
}) {
  const parts = splitBoldSegments(text);
  if (parts.length === 1 && !parts[0].bold) {
    return <Text style={baseStyle}>{text}</Text>;
  }
  return (
    <Text style={baseStyle}>
      {parts.map((p, i) =>
        p.bold ? (
          <Text key={i} style={boldStyle}>
            {p.text}
          </Text>
        ) : (
          p.text
        )
      )}
    </Text>
  );
}

const markdownStyles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
  },
  spacer: {
    height: 8,
  },
  blockFirst: {
    marginTop: 0,
  },
  h1Wrap: {
    marginTop: 12,
  },
  h1Underline: {
    height: 3,
    borderRadius: 3,
    marginBottom: 8,
    opacity: 0.95,
  },
  h1Row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  h1Text: {
    flex: 1,
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '800',
    color: '#fef9c3',
    letterSpacing: -0.4,
  },
  h1Bold: {
    fontWeight: '800',
    color: '#fde047',
  },
  h2Wrap: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
  },
  h2Row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  h2Text: {
    flex: 1,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '800',
    color: '#a5f3fc',
    letterSpacing: -0.2,
  },
  h2Bold: {
    fontWeight: '800',
    color: '#ecfeff',
  },
  h3Wrap: {
    marginTop: 12,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#c4b5fd',
  },
  h3Text: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    color: '#ddd6fe',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  h3Bold: {
    fontWeight: '800',
    color: '#f5f3ff',
    textTransform: 'none',
  },
  para: {
    fontSize: 14,
    lineHeight: 22,
    color: '#d4d4d8',
  },
  paraBold: {
    fontWeight: '700',
    color: '#f4f4f5',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 6,
  },
  bulletGlyph: {
    marginTop: 2,
    fontSize: 13,
    color: '#34d399',
    fontWeight: '800',
    width: 18,
    textAlign: 'center',
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#e4e4e7',
  },
  bulletBold: {
    fontWeight: '700',
    color: '#fafafa',
  },
  orderedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 6,
  },
  ordBadge: {
    marginTop: 1,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ordNum: {
    fontSize: 12,
    fontWeight: '800',
    color: '#e9d5ff',
  },
  ordText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#e4e4e7',
  },
  ordBold: {
    fontWeight: '700',
    color: '#fafafa',
  },
});

function TextCardMarkdownBody({ content }: { content: string }) {
  const blocks = useMemo(() => parseNoteBlocks(content), [content]);
  const firstContentIdx = useMemo(
    () => blocks.findIndex((b) => b.kind !== 'spacer'),
    [blocks]
  );

  return (
    <View style={markdownStyles.root}>
      {blocks.map((b, i) => {
        if (b.kind === 'spacer') {
          return <View key={i} style={markdownStyles.spacer} />;
        }
        const isFirst = i === firstContentIdx;

        switch (b.kind) {
          case 'h1':
            return (
              <View key={i} style={[markdownStyles.h1Wrap, isFirst && markdownStyles.blockFirst]}>
                <LinearGradient
                  colors={['#fbbf24', '#fb7185', '#a78bfa']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={markdownStyles.h1Underline}
                />
                <View style={markdownStyles.h1Row}>
                  <Sparkles size={18} color="#fde047" strokeWidth={2.2} />
                  <MdInline
                    text={b.text}
                    baseStyle={markdownStyles.h1Text}
                    boldStyle={markdownStyles.h1Bold}
                  />
                </View>
              </View>
            );
          case 'h2':
            return (
              <View
                key={i}
                style={[markdownStyles.h2Wrap, isFirst && markdownStyles.blockFirst]}
              >
                <View style={markdownStyles.h2Row}>
                  <Sparkles size={16} color="#22d3ee" strokeWidth={2.2} />
                  <MdInline
                    text={b.text}
                    baseStyle={markdownStyles.h2Text}
                    boldStyle={markdownStyles.h2Bold}
                  />
                </View>
              </View>
            );
          case 'h3':
            return (
              <View
                key={i}
                style={[markdownStyles.h3Wrap, isFirst && markdownStyles.blockFirst]}
              >
                <MdInline
                  text={b.text}
                  baseStyle={markdownStyles.h3Text}
                  boldStyle={markdownStyles.h3Bold}
                />
              </View>
            );
          case 'bullet':
            return (
              <View
                key={i}
                style={[markdownStyles.bulletRow, isFirst && markdownStyles.blockFirst]}
              >
                <Text style={markdownStyles.bulletGlyph} accessibilityLabel="Bullet">
                  ✦
                </Text>
                <MdInline
                  text={b.text}
                  baseStyle={markdownStyles.bulletText}
                  boldStyle={markdownStyles.bulletBold}
                />
              </View>
            );
          case 'ordered':
            return (
              <View
                key={i}
                style={[markdownStyles.orderedRow, isFirst && markdownStyles.blockFirst]}
              >
                <View style={markdownStyles.ordBadge}>
                  <Text style={markdownStyles.ordNum}>{b.num}</Text>
                </View>
                <MdInline
                  text={b.text}
                  baseStyle={markdownStyles.ordText}
                  boldStyle={markdownStyles.ordBold}
                />
              </View>
            );
          case 'para':
            return (
              <View key={i} style={!isFirst ? { marginTop: 6 } : undefined}>
                <MdInline
                  text={b.text}
                  baseStyle={markdownStyles.para}
                  boldStyle={markdownStyles.paraBold}
                />
              </View>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}

const CARD_ENTRANCE_MS = 145;
const CARD_STAGGER_STEP_MS = 32;
const CARD_STAGGER_MAX_MS = 96;
/** Max delay between taps to count as double-tap on image cards (single tap flip waits this long). */
const IMAGE_DOUBLE_TAP_MS = 260;

function PhotoLightbox({
  memory,
  onClosed,
  topInset,
  bottomInset,
}: {
  memory: Memory | null;
  onClosed: () => void;
  topInset: number;
  bottomInset: number;
}) {
  const { t } = useTranslation();
  const open = memory !== null && memory.type === 'image';
  const scale = useRef(new Animated.Value(0.92)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!open) return;
    scale.setValue(0.92);
    backdrop.setValue(0);
    const anim = Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 78,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [open, memory?.id, scale, backdrop]);

  const runClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.92,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onClosed();
    });
  }, [scale, backdrop, onClosed]);

  if (!open || !memory) return null;

  const { width: sw, height: sh } = Dimensions.get('window');
  const imgW = sw * 0.94;
  const imgH = Math.min(sh * 0.58, imgW * 1.38);
  const captionMaxH = sh * 0.24;
  const caption = memory.captionPending ? t('card.analyzing') : memory.context;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={runClose}
    >
      <View style={styles.photoLightboxRoot}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: '#09090b',
              opacity: backdrop,
            },
          ]}
        />
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={runClose}
          accessibilityLabel={t('a11y.closePhoto')}
        />
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, styles.photoLightboxLayer]}>
          <Pressable
            onPress={runClose}
            style={[styles.photoLightboxCloseFab, { top: topInset + 6 }]}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.close')}
          >
            <X size={22} color="#fafafa" strokeWidth={2.2} />
          </Pressable>

          <View style={styles.photoLightboxBody} pointerEvents="box-none">
            <Animated.View style={[styles.photoLightboxScaleWrap, { transform: [{ scale }] }]}>
              <Pressable onPress={runClose}>
                <Image
                  source={{ uri: memory.content }}
                  style={{ width: imgW, height: imgH }}
                  resizeMode="contain"
                />
              </Pressable>
            </Animated.View>
          </View>

          <View style={[styles.photoLightboxCaptionWrap, { maxHeight: captionMaxH, paddingBottom: bottomInset + 12 }]}>
            <ScrollView
              style={styles.photoLightboxCaptionScroll}
              contentContainerStyle={styles.photoLightboxCaptionContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <Text style={styles.photoLightboxCaption}>{caption}</Text>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MemoryCard({
  memory,
  folderLabel,
  selectMode = false,
  selected = false,
  isFlipped = false,
  onToggleSelect,
  onFlipToggle,
  onLongPress,
  onImageDoubleTap,
  entranceDelayMs,
}: {
  memory: Memory;
  folderLabel?: string;
  selectMode?: boolean;
  selected?: boolean;
  isFlipped?: boolean;
  onToggleSelect?: () => void;
  onFlipToggle?: () => void;
  onLongPress?: () => void;
  /** Full-screen photo preview (image cards only). */
  onImageDoubleTap?: () => void;
  /** Stagger index × step; undefined = no entrance animation (existing cards). */
  entranceDelayMs?: number;
}) {
  const { t } = useTranslation();
  const captionPending = memory.type === 'image' && memory.captionPending;
  const opacity = useRef(new Animated.Value(entranceDelayMs !== undefined ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(entranceDelayMs !== undefined ? 10 : 0)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (entranceDelayMs === undefined) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    opacity.setValue(0);
    translateY.setValue(10);
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: CARD_ENTRANCE_MS,
        delay: entranceDelayMs,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: CARD_ENTRANCE_MS,
        delay: entranceDelayMs,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [entranceDelayMs, opacity, translateY]);

  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: isFlipped ? 1 : 0,
      friction: 9,
      tension: 68,
      useNativeDriver: true,
    }).start();
  }, [isFlipped, flipAnim]);

  const frontSpin = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backSpin = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  const [textStageH, setTextStageH] = useState(168);
  const imageTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageLastTapRef = useRef(0);

  useEffect(() => {
    return () => {
      if (imageTapTimerRef.current) clearTimeout(imageTapTimerRef.current);
    };
  }, []);

  const handleImageFrontPress = useCallback(() => {
    if (memory.type !== 'image') return;
    if (selectMode) {
      onToggleSelect?.();
      return;
    }
    if (isFlipped) return;

    const now = Date.now();
    if (now - imageLastTapRef.current < IMAGE_DOUBLE_TAP_MS) {
      if (imageTapTimerRef.current) {
        clearTimeout(imageTapTimerRef.current);
        imageTapTimerRef.current = null;
      }
      imageLastTapRef.current = 0;
      onImageDoubleTap?.();
      return;
    }
    imageLastTapRef.current = now;
    if (imageTapTimerRef.current) clearTimeout(imageTapTimerRef.current);
    imageTapTimerRef.current = setTimeout(() => {
      imageTapTimerRef.current = null;
      imageLastTapRef.current = 0;
      onFlipToggle?.();
    }, IMAGE_DOUBLE_TAP_MS);
  }, [memory.type, selectMode, isFlipped, onToggleSelect, onFlipToggle, onImageDoubleTap]);

  const handleImageLongPress = useCallback(() => {
    if (imageTapTimerRef.current) {
      clearTimeout(imageTapTimerRef.current);
      imageTapTimerRef.current = null;
    }
    imageLastTapRef.current = 0;
    if (!selectMode) onLongPress?.();
  }, [selectMode, onLongPress]);

  const onTextFrontLayout = (e: LayoutChangeEvent) => {
    if (memory.type !== 'text' || isFlipped) return;
    const h = e.nativeEvent.layout.height;
    if (h > 12) setTextStageH((prev) => Math.max(prev, Math.ceil(h)));
  };

  const showTapHint = !selectMode && !isFlipped;
  const faceBase = { backfaceVisibility: 'hidden' as const, width: '100%' as const };

  const backMetaBlock = (
    <>
      <View style={styles.cardBackHeaderRow}>
        <Info size={14} color="#a1a1aa" />
        <Text style={styles.cardBackHeaderTitle}>{t('card.details')}</Text>
      </View>
      <Text style={styles.cardBackSectionLabel}>{t('card.addedAt')}</Text>
      <Text style={styles.cardBackMeta}>{formatSynapseTimestamp(memory.addedAt, memory.date, t)}</Text>
      <Text style={styles.cardBackSectionLabel}>{t('card.source')}</Text>
      <Text style={styles.cardBackMeta}>{memorySourceLabel(memory, t)}</Text>
      {!!folderLabel && (
        <>
          <Text style={styles.cardBackSectionLabel}>{t('card.folder')}</Text>
          <Text style={styles.cardBackMeta}>{folderLabel}</Text>
        </>
      )}
      {captionPending && (
        <>
          <Text style={styles.cardBackSectionLabel}>{t('card.status')}</Text>
          <Text style={styles.cardBackMeta}>{t('card.statusCaptionPending')}</Text>
        </>
      )}
      <Text style={styles.cardBackSectionLabel}>
        {memory.type === 'image' ? t('card.captionDetail') : t('card.noteContext')}
      </Text>
      <Text style={styles.cardBackBody}>{memory.context}</Text>
    </>
  );

  const cardShellStyle = [
    styles.card,
    selected && styles.cardSelected,
    selectMode && styles.cardInSelectMode,
  ];

  const inner = (
    <>
      {selectMode && (
        <View style={styles.cardSelectBadge} pointerEvents="none">
          {selected ? (
            <CheckSquare size={20} color="#34d399" strokeWidth={2.2} />
          ) : (
            <Square size={20} color="#e4e4e7" strokeWidth={2.2} />
          )}
        </View>
      )}
      {memory.type === 'image' ? (
        <View style={styles.cardFlipStageImage}>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              faceBase,
              {
                zIndex: isFlipped ? 0 : 1,
                transform: [{ perspective: 1200 }, { rotateY: frontSpin }],
              },
            ]}
            pointerEvents={isFlipped ? 'none' : 'auto'}
            collapsable={false}
          >
            <Pressable
              onPress={handleImageFrontPress}
              onLongPress={handleImageLongPress}
              delayLongPress={450}
              disabled={selectMode ? false : isFlipped}
              style={({ pressed }) => [
                StyleSheet.absoluteFillObject,
                pressed && !selectMode && !isFlipped && styles.cardPressed,
              ]}
            >
              <Image source={{ uri: memory.content }} style={styles.cardImage} resizeMode="cover" />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']}
                style={styles.imageCaptionGradient}
              >
                {!!folderLabel && !selectMode && !captionPending && (
                  <View style={styles.imageCaptionFolderRow}>
                    <Folder size={10} color="#86efac" />
                    <Text style={styles.imageCaptionFolderText} numberOfLines={1}>
                      {folderLabel}
                    </Text>
                  </View>
                )}
                {captionPending ? (
                  <View style={styles.imageCaptionPendingRow}>
                    <ActivityIndicator size="small" color="#e4e4e7" />
                    <Text style={styles.imageCaptionPendingText} numberOfLines={2}>
                      {t('card.analyzing')}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.imageCaption} numberOfLines={4}>
                    {memory.context}
                  </Text>
                )}
                {showTapHint && (
                  <Text style={styles.cardTapHint}>{t('card.tapFlipDetails')}</Text>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              faceBase,
              styles.cardFaceBack,
              {
                zIndex: isFlipped ? 1 : 0,
                transform: [{ perspective: 1200 }, { rotateY: backSpin }],
              },
            ]}
            pointerEvents={isFlipped ? 'auto' : 'none'}
            collapsable={false}
          >
            <View style={styles.cardBackInnerColumn}>
              <Pressable
                onPress={() => {
                  if (!selectMode) onFlipToggle?.();
                }}
                style={({ pressed }) => [styles.cardBackFlipBar, pressed && styles.cardBackFlipBarPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.flipToFront')}
              >
                <Text style={styles.cardBackFlipBarText}>{t('card.tapFlipBack')}</Text>
              </Pressable>
              <ScrollView
                style={styles.cardBackScrollFlex}
                contentContainerStyle={styles.cardBackScrollContent}
                showsVerticalScrollIndicator={true}
                bounces
                overScrollMode="always"
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                <Image
                  source={{ uri: memory.content }}
                  style={styles.cardBackThumb}
                  resizeMode="cover"
                />
                {backMetaBlock}
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      ) : (
        <View style={[styles.cardFlipStageText, { height: textStageH }]}>
          <Animated.View
            style={[
              styles.cardFlipTextFace,
              faceBase,
              {
                zIndex: isFlipped ? 0 : 1,
                transform: [{ perspective: 1200 }, { rotateY: frontSpin }],
              },
            ]}
            pointerEvents={isFlipped ? 'none' : 'auto'}
            collapsable={false}
          >
            <Pressable
              onPress={() => {
                if (selectMode) onToggleSelect?.();
                else onFlipToggle?.();
              }}
              onLongPress={() => {
                if (!selectMode) onLongPress?.();
              }}
              delayLongPress={450}
              disabled={selectMode ? false : isFlipped}
              style={({ pressed }) => [
                styles.cardFrontPressableFill,
                pressed && !selectMode && !isFlipped && styles.cardPressed,
              ]}
            >
              <View onLayout={onTextFrontLayout}>
                <View style={styles.textCardBody}>
                  <TextCardMarkdownBody content={memory.content} />
                  {!!folderLabel && (
                    <View style={styles.textCardFolderRow}>
                      <Folder size={11} color="#34d399" />
                      <Text style={styles.textCardFolderText} numberOfLines={1}>
                        {folderLabel}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.textCardDate}>
                    {memory.date === 'Just now' ? t('common.justNow') : memory.date}
                  </Text>
                  {showTapHint && (
                    <Text style={styles.cardTapHintText}>{t('card.tapFlipNote')}</Text>
                  )}
                </View>
              </View>
            </Pressable>
          </Animated.View>
          <Animated.View
            style={[
              styles.cardFlipTextFace,
              faceBase,
              styles.cardFaceBack,
              {
                zIndex: isFlipped ? 1 : 0,
                transform: [{ perspective: 1200 }, { rotateY: backSpin }],
              },
            ]}
            pointerEvents={isFlipped ? 'auto' : 'none'}
            collapsable={false}
          >
            <View style={styles.cardBackInnerColumn}>
              <Pressable
                onPress={() => {
                  if (!selectMode) onFlipToggle?.();
                }}
                style={({ pressed }) => [styles.cardBackFlipBar, pressed && styles.cardBackFlipBarPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.flipToFront')}
              >
                <Text style={styles.cardBackFlipBarText}>{t('card.tapFlipBack')}</Text>
              </Pressable>
              <ScrollView
                style={styles.cardBackScrollFlex}
                contentContainerStyle={styles.cardBackScrollContent}
                showsVerticalScrollIndicator={true}
                bounces
                overScrollMode="always"
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {backMetaBlock}
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      )}
    </>
  );

  return (
    <Animated.View
      style={[
        styles.cardAnimatedWrap,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={cardShellStyle}>{inner}</View>
    </Animated.View>
  );
}

function AppShell() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [memoriesHydrated, setMemoriesHydrated] = useState(false);
  const [memories, setMemories] = useState<Memory[]>(INITIAL_MEMORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [displayedMemories, setDisplayedMemories] = useState<Memory[]>(INITIAL_MEMORIES);
  const [deleteSelectMode, setDeleteSelectMode] = useState(false);
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);
  const [selectedLessonFolderIds, setSelectedLessonFolderIds] = useState<string[]>([]);
  const [lessonFolders, setLessonFolders] = useState<LessonFolder[]>([]);
  const [activeLessonFolderId, setActiveLessonFolderId] = useState<string | null>(null);
  const [pendingFolderDraft, setPendingFolderDraft] = useState<PendingFolderDraft | null>(null);
  const [folderPickNewName, setFolderPickNewName] = useState('');
  const [moveTargetMemoryId, setMoveTargetMemoryId] = useState<string | null>(null);
  const [flippedMemoryId, setFlippedMemoryId] = useState<string | null>(null);
  const [photoLightboxMemory, setPhotoLightboxMemory] = useState<Memory | null>(null);
  const [moveFolderNewName, setMoveFolderNewName] = useState('');
  const [cardEntranceDelays, setCardEntranceDelays] = useState<Record<string, number>>({});
  const [lessonFoldersLoaded, setLessonFoldersLoaded] = useState(false);

  const queueCardEntrance = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setCardEntranceDelays((prev) => {
      const next = { ...prev };
      let idx = Object.keys(prev).length;
      for (const id of ids) {
        if (next[id] === undefined) {
          next[id] = Math.min(idx * CARD_STAGGER_STEP_MS, CARD_STAGGER_MAX_MS);
          idx += 1;
        }
      }
      return next;
    });
    const clearAfter = CARD_STAGGER_MAX_MS + CARD_ENTRANCE_MS + 100;
    for (const id of ids) {
      setTimeout(() => {
        setCardEntranceDelays((p) => {
          if (p[id] === undefined) return p;
          const n = { ...p };
          delete n[id];
          return n;
        });
      }, clearAfter);
    }
  }, []);
  const lessonFoldersRef = useRef<LessonFolder[]>([]);
  lessonFoldersRef.current = lessonFolders;

  const shareIntentHookOptions = useMemo(
    () => ({
      disabled: Constants.appOwnership === 'expo',
      scheme: 'synapse',
      resetOnBackground: true,
    }),
    []
  );
  const {
    isReady: shareIntentReady,
    hasShareIntent,
    shareIntent,
    resetShareIntent,
    error: shareIntentModuleError,
  } = useShareIntent(shareIntentHookOptions);

  const shareImportLock = useRef(false);
  const lastSharePayloadRef = useRef<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [editNotesWithAi, setEditNotesWithAi] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [screenshotSyncOn, setScreenshotSyncOn] = useState(false);
  const [isScreenshotSyncing, setIsScreenshotSyncing] = useState(false);
  const screenshotSyncLock = useRef(false);
  /** Cooldown so background AI failures (screenshots, auto-file) do not spam alerts. */
  const backgroundGeminiAlertAt = useRef(0);
  const requestScreenshotSyncRef = useRef<() => Promise<void>>(async () => {});
  const folderPickScrollRef = useRef<ScrollView>(null);
  const movePickScrollRef = useRef<ScrollView>(null);

  const applyAutoLessonFolder = useCallback(async (memoryId: string, contextText: string) => {
    if (!GEMINI_KEY) return;
    try {
      const folders = lessonFoldersRef.current;
      const res = await resolveLessonFolderWithAi(contextText, folders);
      let folderId: string | undefined;
      if (
        res.decision === 'use_existing' &&
        res.matchedFolderId &&
        folders.some((f) => f.id === res.matchedFolderId)
      ) {
        folderId = res.matchedFolderId;
      } else if (res.decision === 'create_new' && res.newLessonTitle) {
        const id = `lf-${Date.now()}`;
        folderId = id;
        setLessonFolders((p) => [...p, { id, name: res.newLessonTitle! }]);
      }
      if (folderId) {
        setMemories((prev) =>
          prev.map((m) => (m.id === memoryId ? { ...m, folderId } : m))
        );
      }
    } catch (e) {
      console.warn('auto lesson folder', e);
      const now = Date.now();
      if (now - backgroundGeminiAlertAt.current > 20_000) {
        backgroundGeminiAlertAt.current = now;
        alertGeminiOrNetworkError(e, {
          title: t('errors.autoFileLessonTitle'),
          extra: t('errors.autoFileLessonExtra'),
        });
      }
    }
  }, [t]);

  const syncNewScreenshots = useCallback(async () => {
    if (!GEMINI_KEY || isAndroidExpoGo()) return;
    const enabled = (await AsyncStorage.getItem(STORAGE_SCREENSHOT_SYNC)) === 'true';
    if (!enabled) return;
    const granular = mediaLibraryGranularPhoto();
    const perm = await MediaLibrary.getPermissionsAsync(false, granular);
    if (!perm.granted) return;

    if (screenshotSyncLock.current) return;
    screenshotSyncLock.current = true;
    setIsScreenshotSyncing(true);
    try {
      let processed = await loadScreenshotIdSet();
      const assets = await fetchScreenshotAssets();
      const newAssets = assets
        .filter((a) => !processed.has(a.id))
        .sort((a, b) => a.creationTime - b.creationTime);

      for (const asset of newAssets) {
        try {
          const info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false });
          const uri = info.localUri ?? asset.uri;
          if (!uri) continue;

          const memoryId = `shot-${asset.id}`;
          const placeholder: Memory = {
            id: memoryId,
            type: 'image',
            content: uri,
            context: i18n.t('screenshot.analyzingContext'),
            date: 'Just now',
            addedAt: new Date().toISOString(),
            captionPending: true,
          };
          queueCardEntrance([memoryId]);
          setMemories((prev) => [placeholder, ...prev]);
          processed.add(asset.id);
          await persistScreenshotIdSet(processed);

          void (async () => {
            try {
              const base64 = await uriToGeminiBase64(uri);
              const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                  { inlineData: { data: base64, mimeType: 'image/jpeg' } },
                  'Describe this screenshot in extreme detail for search: visible text, apps, UI, context. Be concise but comprehensive.',
                ],
              });
              const context =
                (response.text || i18n.t('screenshot.defaultContext')).trim() ||
                i18n.t('screenshot.defaultContext');
              setMemories((prev) =>
                prev.map((m) =>
                  m.id === memoryId ? { ...m, context, captionPending: false } : m
                )
              );
              void applyAutoLessonFolder(memoryId, context);
            } catch (e) {
              console.warn('screenshot caption', e);
              const now = Date.now();
              if (now - backgroundGeminiAlertAt.current > 20_000) {
                backgroundGeminiAlertAt.current = now;
                alertGeminiOrNetworkError(e, {
                  title: t('screenshot.notDescribedTitle'),
                  extra: t('screenshot.notDescribedExtra'),
                });
              }
              setMemories((prev) =>
                prev.map((m) =>
                  m.id === memoryId
                    ? { ...m, context: i18n.t('screenshot.unavailableLabel'), captionPending: false }
                    : m
                )
              );
            }
          })();
        } catch (e) {
          console.warn('screenshot asset import', e);
        }
      }
    } catch (e) {
      console.error('Screenshot sync failed', e);
    } finally {
      screenshotSyncLock.current = false;
      setIsScreenshotSyncing(false);
    }
  }, [applyAutoLessonFolder, queueCardEntrance, t]);

  const requestScreenshotSync = useCallback(async () => {
    try {
      if (!GEMINI_KEY) {
        Alert.alert(t('screenshot.apiKeyTitle'), t('screenshot.apiKeyBody'));
        return;
      }
      if (isAndroidExpoGo()) {
        Alert.alert(t('screenshot.devBuildTitle'), t('screenshot.devBuildBody'), [
          { text: t('common.ok') },
        ]);
        return;
      }

      const granular = mediaLibraryGranularPhoto();
      const result = await MediaLibrary.requestPermissionsAsync(false, granular);

      if (!result.granted) {
        Alert.alert(t('screenshot.photosTitle'), t('screenshot.photosBody'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.openSettings'), onPress: () => void Linking.openSettings() },
        ]);
        return;
      }

      await AsyncStorage.setItem(STORAGE_SCREENSHOT_SYNC, 'true');
      setScreenshotSyncOn(true);

      let processed = await loadScreenshotIdSet();
      if (processed.size === 0) {
        const assets = await fetchScreenshotAssets();
        await persistScreenshotIdSet(new Set(assets.map((a) => a.id)));
      }

      await syncNewScreenshots();

      Alert.alert(t('screenshot.shotsOnTitle'), t('screenshot.shotsOnBody'));
    } catch (e) {
      console.error('requestScreenshotSync', e);
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert(t('screenshot.enableFailedTitle'), message);
    }
  }, [syncNewScreenshots, t]);

  requestScreenshotSyncRef.current = requestScreenshotSync;

  const disableScreenshotSync = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_SCREENSHOT_SYNC, 'false');
    setScreenshotSyncOn(false);
  }, []);

  const onScreenshotChipPress = useCallback(() => {
    if (screenshotSyncOn) {
      Alert.alert(t('screenshot.syncTitle'), t('screenshot.syncTurnOff'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.turnOff'),
          style: 'destructive',
          onPress: () => void disableScreenshotSync(),
        },
      ]);
    } else {
      Alert.alert(t('screenshot.importTitle'), t('screenshot.importBody'), [
        { text: t('common.notNow'), style: 'cancel' },
        {
          text: t('common.continue'),
          onPress: () => scheduleAfterAlert(() => void requestScreenshotSync()),
        },
      ]);
    }
  }, [screenshotSyncOn, requestScreenshotSync, disableScreenshotSync, t]);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_MEMORIES);
        if (raw) {
          const parsed = JSON.parse(raw) as Memory[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMemories(parsed);
            setDisplayedMemories(filterMemoriesByFolder(parsed, null));
          }
        }
      } catch {
        /* keep defaults */
      } finally {
        setMemoriesHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_LESSON_FOLDERS);
        if (raw) {
          const parsed = JSON.parse(raw) as LessonFolder[];
          if (Array.isArray(parsed) && parsed.length > 0) setLessonFolders(parsed);
        }
      } catch {
        /* ignore */
      } finally {
        setLessonFoldersLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!lessonFoldersLoaded) return;
    void AsyncStorage.setItem(STORAGE_LESSON_FOLDERS, JSON.stringify(lessonFolders));
  }, [lessonFolders, lessonFoldersLoaded]);

  useEffect(() => {
    if (!memoriesHydrated) return;
    void AsyncStorage.setItem(STORAGE_MEMORIES, JSON.stringify(memories));
  }, [memories, memoriesHydrated]);

  useEffect(() => {
    void (async () => {
      const v = await AsyncStorage.getItem(STORAGE_SCREENSHOT_SYNC);
      const on = v === 'true';
      setScreenshotSyncOn(on);
      if (!isAndroidExpoGo() && on && GEMINI_KEY) {
        const granular = mediaLibraryGranularPhoto();
        const perm = await MediaLibrary.getPermissionsAsync(false, granular);
        if (perm.granted) await syncNewScreenshots();
      }
    })();
  }, [syncNewScreenshots]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void (async () => {
          const on = (await AsyncStorage.getItem(STORAGE_SCREENSHOT_SYNC)) === 'true';
          if (!isAndroidExpoGo() && on && GEMINI_KEY) {
            const granular = mediaLibraryGranularPhoto();
            const perm = await MediaLibrary.getPermissionsAsync(false, granular);
            if (perm.granted) await syncNewScreenshots();
          }
        })();
      }
    });
    return () => sub.remove();
  }, [syncNewScreenshots]);

  useEffect(() => {
    const introTimer = setTimeout(() => {
      void (async () => {
        const seen = await AsyncStorage.getItem(STORAGE_SCREENSHOT_INTRO);
        if (seen) return;
        const already = (await AsyncStorage.getItem(STORAGE_SCREENSHOT_SYNC)) === 'true';
        if (already) {
          await AsyncStorage.setItem(STORAGE_SCREENSHOT_INTRO, 'true');
          return;
        }
        Alert.alert(i18n.t('screenshot.introTitle'), i18n.t('screenshot.introBody'), [
          {
            text: i18n.t('common.notNow'),
            style: 'cancel',
            onPress: () => void AsyncStorage.setItem(STORAGE_SCREENSHOT_INTRO, 'true'),
          },
          {
            text: i18n.t('common.setUp'),
            onPress: () => {
              void AsyncStorage.setItem(STORAGE_SCREENSHOT_INTRO, 'true');
              scheduleAfterAlert(() => void requestScreenshotSyncRef.current());
            },
          },
        ]);
      })();
    }, 1200);
    return () => clearTimeout(introTimer);
  }, []);

  const windowHeight = Dimensions.get('window').height;
  const sheetMaxHeight = windowHeight * 0.88;

  const [addModalKbHeight, setAddModalKbHeight] = useState(0);
  useEffect(() => {
    if (!isAddOpen) {
      setAddModalKbHeight(0);
      return;
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: { endCoordinates: { height: number } }) =>
      setAddModalKbHeight(e.endCoordinates.height);
    const onHide = () => setAddModalKbHeight(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [isAddOpen]);

  const pickSheetOpen = pendingFolderDraft !== null || moveTargetMemoryId !== null;
  const [pickSheetKbHeight, setPickSheetKbHeight] = useState(0);
  useEffect(() => {
    if (!pickSheetOpen) {
      setPickSheetKbHeight(0);
      return;
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: { endCoordinates: { height: number } }) =>
      setPickSheetKbHeight(e.endCoordinates.height);
    const onHide = () => setPickSheetKbHeight(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [pickSheetOpen]);

  const pickSheetBottomMargin =
    pickSheetKbHeight > 0 ? pickSheetKbHeight : Math.max(24, insets.bottom);

  const answerCardOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!aiAnswer) {
      answerCardOpacity.setValue(0);
      return;
    }
    answerCardOpacity.setValue(0);
    Animated.timing(answerCardOpacity, {
      toValue: 1,
      duration: 195,
      useNativeDriver: true,
    }).start();
  }, [aiAnswer, answerCardOpacity]);

  const fabScale = useRef(new Animated.Value(1)).current;
  const fabPressIn = () => {
    Animated.spring(fabScale, {
      toValue: 0.93,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  };
  const fabPressOut = () => {
    Animated.spring(fabScale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const lessonFolderNameById = useMemo(
    () => Object.fromEntries(lessonFolders.map((f) => [f.id, f.name])) as Record<string, string>,
    [lessonFolders]
  );

  const { left, right } = useMemo(() => splitIntoColumns(displayedMemories), [displayedMemories]);

  useEffect(() => {
    if (deleteSelectMode) setFlippedMemoryId(null);
  }, [deleteSelectMode]);

  useEffect(() => {
    if (flippedMemoryId && !displayedMemories.some((m) => m.id === flippedMemoryId)) {
      setFlippedMemoryId(null);
    }
  }, [flippedMemoryId, displayedMemories]);

  useEffect(() => {
    if (!photoLightboxMemory) return;
    if (!memories.some((m) => m.id === photoLightboxMemory.id)) {
      setPhotoLightboxMemory(null);
    }
  }, [memories, photoLightboxMemory]);

  const closePhotoLightbox = useCallback(() => setPhotoLightboxMemory(null), []);

  const ensureApiKey = useCallback(() => {
    if (!GEMINI_KEY) {
      Alert.alert(t('errors.apiMissingTitle'), t('errors.apiMissingBody'));
      return false;
    }
    return true;
  }, [t]);

  const showAiTrustExplainer = useCallback(() => {
    Alert.alert(t('errors.trustTitle'), t('errors.trustBody'), [{ text: t('common.gotIt') }]);
  }, [t]);

  const exitDeleteSelectMode = useCallback(() => {
    setDeleteSelectMode(false);
    setSelectedMemoryIds([]);
    setSelectedLessonFolderIds([]);
  }, []);

  const toggleSelectMemory = useCallback((id: string) => {
    setSelectedMemoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectLessonFolder = useCallback((folderId: string) => {
    setSelectedLessonFolderIds((prev) =>
      prev.includes(folderId) ? prev.filter((x) => x !== folderId) : [...prev, folderId]
    );
  }, []);

  const closeMoveMemorySheet = useCallback(() => {
    setMoveTargetMemoryId(null);
    setMoveFolderNewName('');
  }, []);

  const moveTargetMemory = useMemo(
    () =>
      moveTargetMemoryId ? memories.find((m) => m.id === moveTargetMemoryId) ?? null : null,
    [moveTargetMemoryId, memories]
  );

  useEffect(() => {
    if (moveTargetMemoryId && !memories.some((m) => m.id === moveTargetMemoryId)) {
      closeMoveMemorySheet();
    }
  }, [moveTargetMemoryId, memories, closeMoveMemorySheet]);

  const applyMemoryLessonMove = useCallback(
    (folderId: string | undefined) => {
      const id = moveTargetMemoryId;
      if (!id) return;
      setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, folderId } : m)));
      closeMoveMemorySheet();
    },
    [moveTargetMemoryId, closeMoveMemorySheet]
  );

  const createFolderAndMoveMemory = useCallback(() => {
    const name = moveFolderNewName.trim();
    const memId = moveTargetMemoryId;
    if (!name || !memId) return;
    const newId = `lf-${Date.now()}`;
    setLessonFolders((p) => [...p, { id: newId, name }]);
    setMemories((prev) => prev.map((m) => (m.id === memId ? { ...m, folderId: newId } : m)));
    closeMoveMemorySheet();
  }, [moveFolderNewName, moveTargetMemoryId, closeMoveMemorySheet]);

  const confirmDeleteMemories = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      closeMoveMemorySheet();
      const title = t('delete.titleBulk');
      const message =
        ids.length === 1
          ? t('delete.sheetOne')
          : t('delete.sheetMany', { count: ids.length });
      Alert.alert(title, message, [
        { text: t('delete.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            setMemories((prev) => {
              const next = prev.filter((m) => !ids.includes(m.id));
              const usedFolderIds = new Set(
                next.map((m) => m.folderId).filter((id): id is string => Boolean(id))
              );
              setLessonFolders((folders) => folders.filter((f) => usedFolderIds.has(f.id)));
              setActiveLessonFolderId((active) =>
                active != null && !usedFolderIds.has(active) ? null : active
              );
              return next;
            });
            setDisplayedMemories((prev) => prev.filter((m) => !ids.includes(m.id)));
            exitDeleteSelectMode();
          },
        },
      ]);
    },
    [exitDeleteSelectMode, closeMoveMemorySheet, t]
  );

  const confirmBulkDelete = useCallback(() => {
    const folderSet = new Set(selectedLessonFolderIds);
    const memoryIdSet = new Set(selectedMemoryIds);
    for (const m of memories) {
      if (m.folderId && folderSet.has(m.folderId)) memoryIdSet.add(m.id);
    }
    const idsToRemove = [...memoryIdSet];

    if (folderSet.size === 0 && idsToRemove.length === 0) return;

    const namedFolders = lessonFolders.filter((f) => folderSet.has(f.id));
    const namesStr = namedFolders.map((f) => f.name).join(', ');

    let message: string;
    if (idsToRemove.length === 0 && folderSet.size > 0) {
      message =
        folderSet.size === 1
          ? t('delete.confirmMemoriesSingle', {
              name: namesStr || t('delete.thisFolder'),
            })
          : t('delete.confirmMemoriesMany', { count: folderSet.size, names: namesStr });
    } else if (folderSet.size > 0) {
      const isTr = i18n.language.startsWith('tr');
      const folderWord =
        folderSet.size > 1 ? (isTr ? 'klasörleri' : 'folders') : isTr ? 'klasörü' : 'folder';
      const memoryWord =
        idsToRemove.length > 1 ? (isTr ? 'anı' : 'memories') : isTr ? 'anı' : 'memory';
      message = t('delete.bulkMixed', {
        folderCount: folderSet.size,
        names: namesStr ? ` (${namesStr})` : '',
        memoryCount: idsToRemove.length,
        folderWord,
        memoryWord,
      });
    } else {
      message =
        idsToRemove.length === 1
          ? t('delete.confirmOne')
          : t('delete.confirmMany', { count: idsToRemove.length });
    }

    Alert.alert(t('delete.title'), message, [
      { text: t('delete.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          const idSet = new Set(idsToRemove);
          setMemories((prev) => {
            const next = prev.filter((m) => !idSet.has(m.id));
            const usedFolderIds = new Set(
              next.map((m) => m.folderId).filter((id): id is string => Boolean(id))
            );
            setLessonFolders((folders) =>
              folders.filter((f) => !folderSet.has(f.id) && usedFolderIds.has(f.id))
            );
            setActiveLessonFolderId((active) => {
              if (active == null) return null;
              if (folderSet.has(active)) return null;
              if (!usedFolderIds.has(active)) return null;
              return active;
            });
            return next;
          });
          setDisplayedMemories((prev) => prev.filter((m) => !idSet.has(m.id)));
          exitDeleteSelectMode();
        },
      },
    ]);
  }, [memories, selectedMemoryIds, selectedLessonFolderIds, lessonFolders, exitDeleteSelectMode, t]);

  const resolveFolderForShareSnippet = useCallback(async (snippet: string) => {
    let folderId: string | undefined;
    let newFolder: LessonFolder | undefined;
    try {
      const folders = lessonFoldersRef.current;
      const res = await resolveLessonFolderWithAi(snippet.slice(0, 2400), folders);
      if (
        res.decision === 'use_existing' &&
        res.matchedFolderId &&
        folders.some((f) => f.id === res.matchedFolderId)
      ) {
        folderId = res.matchedFolderId;
      } else if (res.decision === 'create_new' && res.newLessonTitle) {
        const id = `lf-${Date.now()}`;
        newFolder = { id, name: res.newLessonTitle };
        folderId = id;
      }
    } catch {
      /* keep unfoldered */
    }
    return { folderId, newFolder };
  }, []);

  const processIncomingShare = useCallback(
    async (intent: ShareIntent) => {
      if (!GEMINI_KEY) {
        Alert.alert(t('common.synapse'), t('share.needKey'));
        return;
      }

      if (
        intent.files?.length &&
        !intent.files.some((f) => f.mimeType.startsWith('image/'))
      ) {
        Alert.alert(t('common.synapse'), t('share.badAttachment'));
        return;
      }

      try {
        const imageFile = intent.files?.find((f) => f.mimeType.startsWith('image/'));
        if (imageFile) {
          let uri = imageFile.path;
          try {
            const safeName = (imageFile.fileName || 'shared.jpg').replace(/[^\w.\-]+/g, '_');
            const dest = `${FileSystem.cacheDirectory}share_in_${Date.now()}_${safeName}`;
            await FileSystem.copyAsync({ from: imageFile.path, to: dest });
            uri = dest;
          } catch {
            if (uri && !uri.startsWith('file://')) {
              uri = uri.startsWith('/') ? `file://${uri}` : uri;
            }
          }

          const mime = imageFile.mimeType || 'image/jpeg';
          const data = await uriToGeminiBase64(uri);
          const aiResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              { inlineData: { data, mimeType: mime } },
              'Describe this image in extreme detail so it can be searched later. Include visible text, apps, UI, objects, and context. Be concise but comprehensive.',
            ],
          });
          const context = (aiResponse.text || '').trim() || t('share.sharedImage');
          const { folderId, newFolder } = await resolveFolderForShareSnippet(context);
          if (newFolder) setLessonFolders((p) => [...p, newFolder]);
          const shareMemoryId = `share-${Date.now()}`;
          queueCardEntrance([shareMemoryId]);
          setMemories((p) => [
            {
              id: shareMemoryId,
              type: 'image',
              content: uri,
              context,
              date: 'Just now',
              addedAt: new Date().toISOString(),
              folderId,
            },
            ...p,
          ]);
          setSearchQuery('');
          setAiAnswer(null);
          return;
        }

        const textParts = [intent.text, intent.webUrl].filter(
          (x): x is string => typeof x === 'string' && x.trim().length > 0
        );
        const raw = textParts.join('\n\n').trim();
        if (raw) {
          const { folderId, newFolder } = await resolveFolderForShareSnippet(raw);
          if (newFolder) setLessonFolders((p) => [...p, newFolder]);
          const shareTextId = `share-${Date.now()}`;
          queueCardEntrance([shareTextId]);
          setMemories((p) => [
            {
              id: shareTextId,
              type: 'text',
              content: raw,
              context: raw,
              date: 'Just now',
              addedAt: new Date().toISOString(),
              folderId,
            },
            ...p,
          ]);
          setSearchQuery('');
          setAiAnswer(null);
          return;
        }

        Alert.alert(t('common.synapse'), t('share.empty'));
      } catch (e) {
        console.warn('share intent', e);
        alertGeminiOrNetworkError(e, {
          title: t('errors.importTitle'),
          extra: t('errors.importExtra'),
        });
      }
    },
    [resolveFolderForShareSnippet, queueCardEntrance, t]
  );

  const sharePayloadKey = useMemo(() => {
    if (!hasShareIntent) return '';
    return [
      shareIntent.type ?? '',
      shareIntent.text ?? '',
      shareIntent.webUrl ?? '',
      ...(shareIntent.files ?? []).map((f) => `${f.path}|${f.mimeType}`),
    ].join('\u0001');
  }, [hasShareIntent, shareIntent.type, shareIntent.text, shareIntent.webUrl, shareIntent.files]);

  useEffect(() => {
    if (shareIntentModuleError) {
      Alert.alert(t('errors.shareModuleTitle'), shareIntentModuleError);
    }
  }, [shareIntentModuleError, t]);

  useEffect(() => {
    if (!shareIntentReady || !hasShareIntent || shareImportLock.current) return;
    if (lastSharePayloadRef.current === sharePayloadKey) return;
    lastSharePayloadRef.current = sharePayloadKey;
    shareImportLock.current = true;
    const snapshot: ShareIntent = {
      type: shareIntent.type,
      text: shareIntent.text,
      webUrl: shareIntent.webUrl,
      meta: shareIntent.meta,
      files: shareIntent.files ? [...shareIntent.files] : null,
    };
    void (async () => {
      try {
        await processIncomingShare(snapshot);
      } finally {
        resetShareIntent();
        shareImportLock.current = false;
        const cleared = sharePayloadKey;
        setTimeout(() => {
          if (lastSharePayloadRef.current === cleared) lastSharePayloadRef.current = null;
        }, 900);
      }
    })();
  }, [shareIntentReady, hasShareIntent, sharePayloadKey, processIncomingShare, resetShareIntent]);

  useEffect(() => {
    if (isAddOpen && deleteSelectMode) exitDeleteSelectMode();
  }, [isAddOpen, deleteSelectMode, exitDeleteSelectMode]);

  const deleteToolbarReserve =
    deleteSelectMode ? 52 + Math.max(insets.bottom, 12) : 0;

  const handleSearch = async () => {
    if (!ensureApiKey()) return;

    if (!searchQuery.trim()) {
      setAiAnswer(null);
      setDisplayedMemories(memories);
      return;
    }

    setIsSearching(true);
    setAiAnswer(null);

    try {
      const memoriesContext = memories.map((m) => {
        const lesson = m.folderId ? lessonFolderNameById[m.folderId] : null;
        return {
          id: m.id,
          type: m.type,
          details: lesson ? `[Lesson: ${lesson}] ${m.context}` : m.context,
          date: m.date,
        };
      });

      const prompt = `You are Synapse, a privacy-first second brain AI. The user is searching their personal memories.
User Query: "${searchQuery}"

Here is the JSON dump of the user's memories:
${JSON.stringify(memoriesContext)}

Task:
1. Answer the user's query conversationally and directly, using ONLY the provided memories. If the answer isn't in the memories, say so.
2. Identify the IDs of the memories that are relevant to the query or your answer. If the user asks a vague question (e.g., "show me jackets"), return all relevant memory IDs.

Respond strictly in JSON format matching the schema.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description: "Conversational answer to the user's query.",
              },
              relevantIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Array of memory IDs that are relevant.',
              },
            },
            required: ['answer', 'relevantIds'],
          },
        },
      });

      const result = JSON.parse(response.text || '{}');

      setAiAnswer(result.answer || t('search.processFailed'));

      if (result.relevantIds && Array.isArray(result.relevantIds)) {
        const filtered = memories.filter((m) => result.relevantIds.includes(m.id));
        setDisplayedMemories(filtered);
      } else {
        setDisplayedMemories([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      alertGeminiOrNetworkError(error, { extra: t('search.retryOnline') });
      setAiAnswer(null);
      setDisplayedMemories(filterMemoriesByFolder(memories, activeLessonFolderId));
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (searchQuery === '') {
      setAiAnswer(null);
      setDisplayedMemories(filterMemoriesByFolder(memories, activeLessonFolderId));
    }
  }, [searchQuery, memories, activeLessonFolderId]);

  const closeAddModal = () => {
    if (isProcessing) return;
    setIsAddOpen(false);
    setPendingImage(null);
    setInputText('');
    setEditNotesWithAi(false);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('photos.pickerTitle'), t('photos.pickerBody'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPendingImage({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' });
    }
  };

  const pasteImageFromClipboard = async () => {
    try {
      const has = await Clipboard.hasImageAsync();
      if (!has) {
        Alert.alert(t('clipboard.title'), t('clipboard.noImage'));
        return;
      }
      const img = await Clipboard.getImageAsync({ format: 'jpeg' });
      if (!img?.data) {
        Alert.alert(t('clipboard.title'), t('clipboard.readFail'));
        return;
      }
      setPendingImage({ uri: img.data, mimeType: 'image/jpeg' });
    } catch (e) {
      console.error(e);
      Alert.alert(t('clipboard.title'), t('clipboard.pasteFail'));
    }
  };

  const commitNewMemoryWithFolder = useCallback(
    (draft: PendingFolderDraft, folderId: string | undefined) => {
      const newMemory: Memory = {
        id: Date.now().toString(),
        type: draft.type,
        content: draft.content,
        context: draft.context,
        date: 'Just now',
        addedAt: new Date().toISOString(),
        folderId,
      };
      queueCardEntrance([newMemory.id]);
      setMemories((prev) => [newMemory, ...prev]);
      setPendingFolderDraft(null);
      setFolderPickNewName('');
    },
    [queueCardEntrance]
  );

  const handleSave = async () => {
    if (!ensureApiKey()) return;
    if (!inputText.trim() && !pendingImage) return;

    setIsProcessing(true);

    try {
      let context = inputText;
      let type: 'text' | 'image' = 'text';
      let content = inputText;

      if (pendingImage) {
        type = 'image';
        content = pendingImage.uri;
        let userCaption = inputText.trim();
        if (editNotesWithAi && userCaption) {
          try {
            userCaption = await organizeLessonNotesWithAi(userCaption);
          } catch (e) {
            console.warn('organize caption', e);
            userCaption = inputText.trim();
            alertGeminiOrNetworkError(e, {
              extra: t('errors.captionFallback'),
            });
          }
        }
        const base64Data = await uriToGeminiBase64(pendingImage.uri);
        const instruction = userCaption
          ? `The user wrote this personal caption about the image (preserve their meaning; do not contradict it):\n"${userCaption}"\n\nDescribe what you see in extreme detail for search: visible text, UI, objects, colors, brands, and context. Add information that complements their caption—avoid repeating their exact words as the opening of your reply; focus on visual facts they did not spell out. Be concise but comprehensive.`
          : 'Describe this image in extreme detail so it can be searched later. Include objects, colors, text, brands, and overall context. Be concise but comprehensive.';
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ inlineData: { data: base64Data, mimeType: pendingImage.mimeType } }, instruction],
        });
        const aiPart = (response.text || '').trim() || t('image.noDescription');
        context = userCaption ? `${userCaption} — ${aiPart}` : aiPart;
      } else {
        let finalText = inputText.trim();
        if (editNotesWithAi && finalText) {
          try {
            finalText = await organizeLessonNotesWithAi(finalText);
          } catch (e) {
            console.warn('organize notes', e);
            finalText = inputText.trim();
            alertGeminiOrNetworkError(e, {
              title: t('errors.reorganizeTitle'),
              extra: t('errors.reorganizeExtra'),
            });
          }
        }
        content = finalText;
        context = finalText;
      }

      let folderId: string | undefined;
      try {
        const res = await resolveLessonFolderWithAi(context, lessonFolders);
        if (
          res.decision === 'use_existing' &&
          res.matchedFolderId &&
          lessonFolders.some((f) => f.id === res.matchedFolderId)
        ) {
          folderId = res.matchedFolderId;
        } else if (res.decision === 'create_new' && res.newLessonTitle) {
          const newFid = `lf-${Date.now()}`;
          setLessonFolders((p) => [...p, { id: newFid, name: res.newLessonTitle! }]);
          folderId = newFid;
        } else {
          setPendingFolderDraft({
            type,
            content,
            context,
            suggestedNewTitle: res.newLessonTitle,
          });
          setFolderPickNewName(res.newLessonTitle || '');
          closeAddModal();
          setSearchQuery('');
          setAiAnswer(null);
          return;
        }
      } catch (e) {
        console.warn('lesson folder', e);
        alertGeminiOrNetworkError(e, {
          title: t('errors.autoFileTitle'),
          extra: t('errors.autoFileExtra'),
        });
        setPendingFolderDraft({ type, content, context, suggestedNewTitle: null });
        setFolderPickNewName('');
        closeAddModal();
        setSearchQuery('');
        setAiAnswer(null);
        return;
      }

      const newMemory: Memory = {
        id: Date.now().toString(),
        type,
        content,
        context,
        date: 'Just now',
        addedAt: new Date().toISOString(),
        folderId,
      };

      queueCardEntrance([newMemory.id]);
      setMemories((prev) => [newMemory, ...prev]);
      closeAddModal();
      setSearchQuery('');
      setAiAnswer(null);
    } catch (error) {
      console.error('Upload error:', error);
      alertGeminiOrNetworkError(error, {
        title: t('errors.saveMemoryTitle'),
        extra: t('errors.saveMemoryExtra'),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.phone}>
          <View style={styles.header}>
            <Pressable
              onPress={() => {
                if (deleteSelectMode) exitDeleteSelectMode();
                else setDeleteSelectMode(true);
              }}
              style={({ pressed }) => [
                styles.headerTrashBtn,
                deleteSelectMode && styles.headerTrashBtnOn,
                pressed && styles.pressed,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={
                deleteSelectMode ? t('a11y.doneSelecting') : t('a11y.selectToDelete')
              }
            >
              <Text style={styles.headerTrashEmoji}>🗑️</Text>
            </Pressable>
            <View style={styles.headerTop}>
              <View style={styles.logoRow}>
                <View style={styles.logoMark}>
                  <Brain size={22} color="#09090b" strokeWidth={2.1} />
                </View>
                <Text style={styles.logoText} numberOfLines={1}>
                  {t('common.synapse')}
                </Text>
              </View>
              <View style={styles.headerChips}>
                <Pressable
                  onPress={onScreenshotChipPress}
                  style={({ pressed }) => [
                    styles.shotChip,
                    !screenshotSyncOn && styles.shotChipOff,
                    pressed && styles.pressed,
                  ]}
                >
                  {isScreenshotSyncing ? (
                    <ActivityIndicator size="small" color="#34d399" />
                  ) : (
                    <Camera size={12} color={screenshotSyncOn ? '#34d399' : '#71717a'} />
                  )}
                  <Text style={[styles.shotChipText, !screenshotSyncOn && styles.shotChipTextMuted]}>
                    {screenshotSyncOn ? t('header.shotsOn') : t('header.shots')}
                  </Text>
                </Pressable>
                <View style={styles.langSwitch}>
                  {(['en', 'tr'] as const).map((lng) => {
                    const active = i18n.language.startsWith(lng);
                    return (
                      <Pressable
                        key={lng}
                        onPress={() => void setAppLanguage(lng)}
                        style={({ pressed }) => [
                          styles.langSeg,
                          active && styles.langSegActive,
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={lng === 'en' ? t('lang.en') : t('lang.tr')}
                      >
                        <Text
                          style={[
                            styles.langFlagEmoji,
                            !active && styles.langFlagEmojiInactive,
                          ]}
                        >
                          {lng === 'en' ? '🇬🇧' : '🇹🇷'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={styles.searchRow}>
              <View style={styles.searchWrap}>
                <Search size={16} color="#71717a" style={styles.searchIcon} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t('search.placeholder')}
                  placeholderTextColor="#71717a"
                  style={styles.searchInput}
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
                {!!searchQuery && (
                  <Pressable onPress={handleSearch} style={styles.searchSend} hitSlop={8}>
                    {isSearching ? (
                      <ActivityIndicator size="small" color="#a1a1aa" />
                    ) : (
                      <Send size={16} color="#a1a1aa" />
                    )}
                  </Pressable>
                )}
              </View>
              <Pressable
                onPress={showAiTrustExplainer}
                style={({ pressed }) => [styles.aiPill, styles.aiPillSearchEnd, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.aiPrivacy')}
                accessibilityHint={t('a11y.aiPrivacyHint')}
                hitSlop={8}
              >
                <Sparkles size={10} color="#34d399" strokeWidth={2} />
                <Text style={styles.aiPillText} numberOfLines={1}>
                  {t('header.aiActive')}
                </Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.lessonFolderStrip}
              contentContainerStyle={styles.lessonFolderStripInner}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable
                onPress={() => {
                  if (deleteSelectMode) setSelectedLessonFolderIds([]);
                  else setActiveLessonFolderId(null);
                }}
                style={({ pressed }) => [
                  styles.lessonFolderChip,
                  !deleteSelectMode && activeLessonFolderId === null && styles.lessonFolderChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.lessonFolderChipText,
                    !deleteSelectMode && activeLessonFolderId === null && styles.lessonFolderChipTextActive,
                  ]}
                >
                  {deleteSelectMode ? t('folders.foldersClear') : t('folders.all')}
                </Text>
              </Pressable>
              {lessonFolders.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    if (deleteSelectMode) toggleSelectLessonFolder(f.id);
                    else setActiveLessonFolderId(f.id);
                  }}
                  style={({ pressed }) => [
                    styles.lessonFolderChip,
                    !deleteSelectMode && activeLessonFolderId === f.id && styles.lessonFolderChipActive,
                    deleteSelectMode &&
                      selectedLessonFolderIds.includes(f.id) &&
                      styles.lessonFolderChipDeleteSel,
                    pressed && styles.pressed,
                  ]}
                >
                  <Folder
                    size={12}
                    color={
                      deleteSelectMode && selectedLessonFolderIds.includes(f.id)
                        ? '#f87171'
                        : !deleteSelectMode && activeLessonFolderId === f.id
                          ? '#34d399'
                          : '#71717a'
                    }
                  />
                  <Text
                    style={[
                      styles.lessonFolderChipText,
                      !deleteSelectMode &&
                        activeLessonFolderId === f.id &&
                        styles.lessonFolderChipTextActive,
                      deleteSelectMode &&
                        selectedLessonFolderIds.includes(f.id) &&
                        styles.lessonFolderChipTextDeleteSel,
                    ]}
                    numberOfLines={1}
                  >
                    {f.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <ScrollView
            style={styles.mainScroll}
            contentContainerStyle={[
              styles.mainContent,
              { paddingBottom: 120 + deleteToolbarReserve },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {!!aiAnswer && (
              <Animated.View style={[styles.answerCard, { opacity: answerCardOpacity }]}>
                <LinearGradient
                  colors={['#6366f1', '#a855f7', '#34d399']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.answerAccent}
                />
                <View style={styles.answerRow}>
                  <View style={styles.answerIcon}>
                    <Sparkles size={16} color="#d4d4d8" />
                  </View>
                  <Text style={styles.answerText}>{aiAnswer}</Text>
                </View>
              </Animated.View>
            )}

            <View style={styles.masonryRow}>
              <View style={styles.masonryCol}>
                {left.map((m) => (
                  <MemoryCard
                    key={m.id}
                    memory={m}
                    folderLabel={m.folderId ? lessonFolderNameById[m.folderId] : undefined}
                    selectMode={deleteSelectMode}
                    selected={selectedMemoryIds.includes(m.id)}
                    isFlipped={flippedMemoryId === m.id}
                    onToggleSelect={() => toggleSelectMemory(m.id)}
                    onFlipToggle={() =>
                      setFlippedMemoryId((cur) => (cur === m.id ? null : m.id))
                    }
                    onLongPress={() => setMoveTargetMemoryId(m.id)}
                    onImageDoubleTap={
                      m.type === 'image' && !deleteSelectMode
                        ? () => setPhotoLightboxMemory(m)
                        : undefined
                    }
                    entranceDelayMs={cardEntranceDelays[m.id]}
                  />
                ))}
              </View>
              <View style={styles.masonryCol}>
                {right.map((m) => (
                  <MemoryCard
                    key={m.id}
                    memory={m}
                    folderLabel={m.folderId ? lessonFolderNameById[m.folderId] : undefined}
                    selectMode={deleteSelectMode}
                    selected={selectedMemoryIds.includes(m.id)}
                    isFlipped={flippedMemoryId === m.id}
                    onToggleSelect={() => toggleSelectMemory(m.id)}
                    onFlipToggle={() =>
                      setFlippedMemoryId((cur) => (cur === m.id ? null : m.id))
                    }
                    onLongPress={() => setMoveTargetMemoryId(m.id)}
                    onImageDoubleTap={
                      m.type === 'image' && !deleteSelectMode
                        ? () => setPhotoLightboxMemory(m)
                        : undefined
                    }
                    entranceDelayMs={cardEntranceDelays[m.id]}
                  />
                ))}
              </View>
            </View>

            {!isSearching && displayedMemories.length === 0 && (
              <View style={styles.empty}>
                <Brain size={40} color="#52525b" style={{ opacity: 0.35 }} />
                <Text style={styles.emptyText}>
                  {memories.length === 0
                    ? t('empty.brainEmpty')
                    : activeLessonFolderId
                      ? t('empty.noLesson')
                      : t('empty.brainEmpty')}
                </Text>
                {memories.length === 0 && (
                  <Text style={styles.emptyHint}>{t('empty.shareHint')}</Text>
                )}
              </View>
            )}
          </ScrollView>

          <View
            style={[
              styles.fabCol,
              {
                bottom: Math.max(insets.bottom, 12) + 8 + deleteToolbarReserve,
                right: 16,
              },
            ]}
          >
            <Pressable
              onPress={() => setIsAddOpen(true)}
              onPressIn={fabPressIn}
              onPressOut={fabPressOut}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.addMemory')}
            >
              <Animated.View style={[styles.fabPrimary, { transform: [{ scale: fabScale }] }]}>
                <Plus size={28} color="#09090b" />
              </Animated.View>
            </Pressable>
          </View>

          {deleteSelectMode && (
            <View
              style={[
                styles.deleteToolbar,
                { paddingBottom: Math.max(insets.bottom, 10) },
              ]}
            >
              <Text style={styles.deleteToolbarHint}>
                {selectedMemoryIds.length === 0 && selectedLessonFolderIds.length === 0
                  ? t('deleteToolbar.hint')
                  : [
                      selectedMemoryIds.length > 0
                        ? t(
                            selectedMemoryIds.length === 1
                              ? 'deleteToolbar.noteOne'
                              : 'deleteToolbar.noteMany',
                            { count: selectedMemoryIds.length }
                          )
                        : null,
                      selectedLessonFolderIds.length > 0
                        ? t(
                            selectedLessonFolderIds.length === 1
                              ? 'deleteToolbar.folderOne'
                              : 'deleteToolbar.folderMany',
                            { count: selectedLessonFolderIds.length }
                          )
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
              </Text>
              <Pressable
                onPress={confirmBulkDelete}
                disabled={
                  selectedMemoryIds.length === 0 && selectedLessonFolderIds.length === 0
                }
                style={({ pressed }) => [
                  styles.deleteToolbarBtn,
                  selectedMemoryIds.length === 0 &&
                    selectedLessonFolderIds.length === 0 &&
                    styles.deleteToolbarBtnDisabled,
                  pressed &&
                    (selectedMemoryIds.length > 0 || selectedLessonFolderIds.length > 0) &&
                    styles.deleteToolbarBtnPressed,
                ]}
              >
                <Trash2
                  size={18}
                  color={
                    selectedMemoryIds.length === 0 && selectedLessonFolderIds.length === 0
                      ? '#52525b'
                      : '#fef2f2'
                  }
                />
                <Text
                  style={[
                    styles.deleteToolbarBtnText,
                    selectedMemoryIds.length === 0 &&
                      selectedLessonFolderIds.length === 0 &&
                      styles.deleteToolbarBtnTextDisabled,
                  ]}
                >
                  {t('common.delete')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>

      <Modal visible={isAddOpen} animationType="slide" transparent onRequestClose={closeAddModal}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeAddModal} />
          <View
            style={[styles.sheet, { maxHeight: sheetMaxHeight, marginBottom: addModalKbHeight }]}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('addModal.title')}</Text>
              <Pressable onPress={closeAddModal} style={styles.sheetClose} hitSlop={12}>
                <X size={18} color="#a1a1aa" />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.sheetBody}
              contentContainerStyle={styles.sheetBodyContent}
            >
              {pendingImage ? (
                <>
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: pendingImage.uri }} style={styles.previewImg} resizeMode="contain" />
                    <Pressable style={styles.previewClear} onPress={() => setPendingImage(null)}>
                      <X size={16} color="#fff" />
                    </Pressable>
                    <View style={styles.editingHint}>
                      <CropIcon size={14} color="#a1a1aa" />
                      <Text style={styles.editingHintText}>{t('addModal.cropHint')}</Text>
                    </View>
                  </View>
                  <TextInput
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder={t('addModal.captionPlaceholder')}
                    placeholderTextColor="#52525b"
                    multiline
                    style={styles.noteInputBelowPreview}
                  />
                </>
              ) : (
                <TextInput
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder={t('addModal.notePlaceholder')}
                  placeholderTextColor="#52525b"
                  multiline
                  style={styles.noteInput}
                />
              )}

              {inputText.trim().length > 0 && (
                <Pressable
                  onPress={() => setEditNotesWithAi((v) => !v)}
                  style={({ pressed }) => [
                    styles.lessonAiOpt,
                    editNotesWithAi && styles.lessonAiOptOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Sparkles
                    size={18}
                    color={editNotesWithAi ? '#34d399' : '#71717a'}
                  />
                  <View style={styles.lessonAiOptTextCol}>
                    <Text
                      style={[
                        styles.lessonAiOptTitle,
                        !editNotesWithAi && styles.lessonAiOptTitleMuted,
                      ]}
                    >
                      {t('addModal.editByAi')}
                    </Text>
                    <Text style={styles.lessonAiOptSub}>
                      {t('addModal.editByAiSub', {
                        imageHint: pendingImage ? t('addModal.editByAiImageHint') : '',
                      })}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.lessonAiSwitchTrack,
                      editNotesWithAi && styles.lessonAiSwitchTrackOn,
                    ]}
                  >
                    <View
                      style={[
                        styles.lessonAiSwitchKnob,
                        editNotesWithAi && styles.lessonAiSwitchKnobOn,
                      ]}
                    />
                  </View>
                </Pressable>
              )}

              <View style={styles.sheetActions}>
                <View style={styles.sheetActionLeft}>
                  <Pressable onPress={pickImage} style={styles.iconBtn}>
                    <ImageIcon size={22} color="#d4d4d8" />
                  </Pressable>
                  <Pressable onPress={pasteImageFromClipboard} style={styles.iconBtn}>
                    <Text style={styles.pasteLabel}>{t('addModal.paste')}</Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={handleSave}
                  disabled={(!inputText.trim() && !pendingImage) || isProcessing}
                  style={({ pressed }) => [
                    styles.saveBtn,
                    pressed && styles.pressed,
                    ((!inputText.trim() && !pendingImage) || isProcessing) && styles.saveBtnDisabled,
                  ]}
                >
                  {isProcessing ? (
                    <View style={styles.saveInner}>
                      <ActivityIndicator size="small" color="#09090b" />
                      <Text style={styles.saveBtnText}>{t('addModal.processing')}</Text>
                    </View>
                  ) : (
                    <View style={styles.saveInner}>
                      <Brain size={16} color="#09090b" />
                      <Text style={styles.saveBtnText}>{t('addModal.save')}</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pendingFolderDraft !== null}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (pendingFolderDraft) commitNewMemoryWithFolder(pendingFolderDraft, undefined);
        }}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              if (pendingFolderDraft) commitNewMemoryWithFolder(pendingFolderDraft, undefined);
            }}
          />
          <View style={[styles.sheet, { maxHeight: sheetMaxHeight, marginBottom: pickSheetBottomMargin }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('folderPick.fileTitle')}</Text>
              <Pressable
                onPress={() => {
                  if (pendingFolderDraft) commitNewMemoryWithFolder(pendingFolderDraft, undefined);
                }}
                style={styles.sheetClose}
                hitSlop={12}
              >
                <X size={18} color="#a1a1aa" />
              </Pressable>
            </View>
            <Text style={styles.folderPickExplainer}>{t('folderPick.explainer')}</Text>
            <ScrollView
              ref={folderPickScrollRef}
              style={styles.sheetBody}
              contentContainerStyle={[
                styles.folderPickScrollContent,
                pickSheetKbHeight > 0 && { paddingBottom: 20 },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <Text style={styles.folderPickSectionLabel}>{t('folders.existingLessons')}</Text>
              {lessonFolders.length === 0 ? (
                <Text style={styles.folderPickEmpty}>{t('folders.noFoldersYet')}</Text>
              ) : (
                lessonFolders.map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => {
                      if (pendingFolderDraft) commitNewMemoryWithFolder(pendingFolderDraft, f.id);
                    }}
                    style={({ pressed }) => [styles.folderPickRow, pressed && styles.pressed]}
                  >
                    <Folder size={18} color="#34d399" />
                    <Text style={styles.folderPickRowText} numberOfLines={2}>
                      {f.name}
                    </Text>
                  </Pressable>
                ))
              )}

              <Text style={styles.folderPickSectionLabel}>{t('folders.newLesson')}</Text>
              <TextInput
                value={folderPickNewName}
                onChangeText={setFolderPickNewName}
                placeholder={
                  pendingFolderDraft?.suggestedNewTitle
                    ? t('folders.lessonPlaceholderExample', {
                        suggestion: pendingFolderDraft.suggestedNewTitle,
                      })
                    : t('folders.lessonPlaceholder')
                }
                placeholderTextColor="#52525b"
                style={styles.folderPickInput}
                onFocus={() => {
                  InteractionManager.runAfterInteractions(() => {
                    setTimeout(() => {
                      folderPickScrollRef.current?.scrollToEnd({ animated: true });
                    }, 120);
                  });
                }}
              />
              <Pressable
                onPress={() => {
                  const name = folderPickNewName.trim();
                  if (!name || !pendingFolderDraft) return;
                  const id = `lf-${Date.now()}`;
                  setLessonFolders((p) => [...p, { id, name }]);
                  commitNewMemoryWithFolder(pendingFolderDraft, id);
                }}
                disabled={!folderPickNewName.trim()}
                style={({ pressed }) => [
                  styles.folderPickCreateBtn,
                  !folderPickNewName.trim() && styles.folderPickCreateBtnDisabled,
                  pressed && folderPickNewName.trim() && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.folderPickCreateBtnText,
                    !folderPickNewName.trim() && styles.folderPickCreateBtnTextDisabled,
                  ]}
                >
                  {t('folderPick.createSave')}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (pendingFolderDraft) commitNewMemoryWithFolder(pendingFolderDraft, undefined);
                }}
                style={({ pressed }) => [styles.folderPickSkipBtn, pressed && styles.pressed]}
              >
                <Text style={styles.folderPickSkipText}>{t('folderPick.saveWithout')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={moveTargetMemoryId !== null}
        animationType="slide"
        transparent
        onRequestClose={closeMoveMemorySheet}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeMoveMemorySheet} />
          <View style={[styles.sheet, { maxHeight: sheetMaxHeight, marginBottom: pickSheetBottomMargin }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('folderPick.moveTitle')}</Text>
              <Pressable onPress={closeMoveMemorySheet} style={styles.sheetClose} hitSlop={12}>
                <X size={18} color="#a1a1aa" />
              </Pressable>
            </View>
            {moveTargetMemory ? (
              <Text style={styles.moveSheetPreview} numberOfLines={2}>
                {moveTargetMemory.type === 'text'
                  ? moveTargetMemory.content
                  : moveTargetMemory.context}
              </Text>
            ) : null}
            <Text style={styles.folderPickExplainer}>{t('folderPick.moveExplainer')}</Text>
            <ScrollView
              ref={movePickScrollRef}
              style={styles.sheetBody}
              contentContainerStyle={[
                styles.folderPickScrollContent,
                pickSheetKbHeight > 0 && { paddingBottom: 20 },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <Text style={styles.folderPickSectionLabel}>{t('folders.filing')}</Text>
              <Pressable
                onPress={() => applyMemoryLessonMove(undefined)}
                style={({ pressed }) => [
                  styles.folderPickRow,
                  !moveTargetMemory?.folderId && styles.folderPickRowCurrent,
                  pressed && styles.pressed,
                ]}
              >
                <Folder size={18} color="#a1a1aa" />
                <Text style={styles.folderPickRowText} numberOfLines={2}>
                  {t('folderPick.allBrain')}
                </Text>
                {!moveTargetMemory?.folderId ? (
                  <Check size={18} color="#34d399" strokeWidth={2.4} />
                ) : (
                  <View style={styles.folderPickRowCheckSpacer} />
                )}
              </Pressable>

              <Text style={styles.folderPickSectionLabel}>{t('folders.existingLessons')}</Text>
              {lessonFolders.length === 0 ? (
                <Text style={styles.folderPickEmpty}>{t('folders.noFoldersYet')}</Text>
              ) : (
                lessonFolders.map((f) => {
                  const isCurrent = moveTargetMemory?.folderId === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => applyMemoryLessonMove(f.id)}
                      style={({ pressed }) => [
                        styles.folderPickRow,
                        isCurrent && styles.folderPickRowCurrent,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Folder size={18} color="#34d399" />
                      <Text style={styles.folderPickRowText} numberOfLines={2}>
                        {f.name}
                      </Text>
                      {isCurrent ? (
                        <Check size={18} color="#34d399" strokeWidth={2.4} />
                      ) : (
                        <View style={styles.folderPickRowCheckSpacer} />
                      )}
                    </Pressable>
                  );
                })
              )}

              <Text style={styles.folderPickSectionLabel}>{t('folders.newLesson')}</Text>
              <TextInput
                value={moveFolderNewName}
                onChangeText={setMoveFolderNewName}
                placeholder={t('folders.lessonPlaceholder')}
                placeholderTextColor="#52525b"
                style={styles.folderPickInput}
                onFocus={() => {
                  InteractionManager.runAfterInteractions(() => {
                    setTimeout(() => {
                      movePickScrollRef.current?.scrollToEnd({ animated: true });
                    }, 120);
                  });
                }}
              />
              <Pressable
                onPress={createFolderAndMoveMemory}
                disabled={!moveFolderNewName.trim()}
                style={({ pressed }) => [
                  styles.folderPickCreateBtn,
                  !moveFolderNewName.trim() && styles.folderPickCreateBtnDisabled,
                  pressed && moveFolderNewName.trim() && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.folderPickCreateBtnText,
                    !moveFolderNewName.trim() && styles.folderPickCreateBtnTextDisabled,
                  ]}
                >
                  {t('folderPick.createMove')}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  const id = moveTargetMemory?.id;
                  if (id) confirmDeleteMemories([id]);
                }}
                style={({ pressed }) => [styles.folderPickDangerBtn, pressed && styles.pressed]}
              >
                <Trash2 size={18} color="#f87171" />
                <Text style={styles.folderPickDangerText}>{t('folderPick.deleteFromSynapse')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <PhotoLightbox
        memory={photoLightboxMemory}
        onClosed={closePhotoLightbox}
        topInset={insets.top}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);
  useEffect(() => {
    void initI18n().then(() => setI18nReady(true));
  }, []);
  if (!i18nReady) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#34d399" />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  safe: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  phone: {
    flex: 1,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#09090b',
  },
  /** Visual rhythm below device safe area: logo block → search → folder strip → divider. */
  header: {
    position: 'relative',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#27272a',
    backgroundColor: 'rgba(9,9,11,0.92)',
  },
  headerTrashBtn: {
    position: 'absolute',
    right: 16,
    top: 13,
    zIndex: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  headerTrashBtnOn: {
    backgroundColor: 'rgba(251,191,36,0.14)',
  },
  headerTrashEmoji: {
    fontSize: 17,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
    paddingRight: 48,
  },
  headerChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  shotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  shotChipOff: {
    backgroundColor: 'rgba(39,39,42,0.8)',
    borderColor: '#3f3f46',
  },
  shotChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34d399',
    letterSpacing: 0.4,
  },
  shotChipTextMuted: {
    color: '#a1a1aa',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    minWidth: 0,
    flex: 1,
  },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#f4f4f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fafafa',
    letterSpacing: -0.5,
  },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.22)',
  },
  aiPillText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6ee7b7',
    letterSpacing: 0.65,
  },
  aiPillSearchEnd: {
    flexShrink: 0,
    maxWidth: 108,
    paddingHorizontal: 7,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  langSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3f3f46',
    backgroundColor: 'rgba(39,39,42,0.8)',
  },
  langSeg: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langSegActive: {
    backgroundColor: 'rgba(16,185,129,0.18)',
  },
  langFlagEmoji: {
    fontSize: 17,
    lineHeight: 21,
  },
  langFlagEmojiInactive: {
    opacity: 0.38,
  },
  searchWrap: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  searchInput: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 18,
    paddingVertical: 14,
    paddingLeft: 44,
    paddingRight: 44,
    color: '#fafafa',
    fontSize: 14,
  },
  searchSend: {
    position: 'absolute',
    right: 10,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  lessonFolderStrip: {
    maxHeight: 44,
  },
  lessonFolderStripInner: {
    gap: 8,
    paddingRight: 4,
    alignItems: 'center',
  },
  lessonFolderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(39,39,42,0.9)',
    borderWidth: 1,
    borderColor: '#3f3f46',
    maxWidth: 220,
  },
  lessonFolderChipActive: {
    borderColor: 'rgba(16,185,129,0.45)',
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  lessonFolderChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
    flexShrink: 1,
  },
  lessonFolderChipTextActive: {
    color: '#34d399',
  },
  lessonFolderChipDeleteSel: {
    borderColor: 'rgba(248,113,113,0.75)',
    backgroundColor: 'rgba(248,113,113,0.12)',
  },
  lessonFolderChipTextDeleteSel: {
    color: '#fca5a5',
  },
  mainScroll: {
    flex: 1,
  },
  mainContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 120,
  },
  answerCard: {
    backgroundColor: 'rgba(24,24,27,0.65)',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 22,
    padding: 18,
    marginBottom: 20,
    overflow: 'hidden',
  },
  answerAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.55,
  },
  answerRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  answerIcon: {
    marginTop: 2,
    padding: 6,
    borderRadius: 999,
    backgroundColor: '#27272a',
  },
  answerText: {
    flex: 1,
    color: '#e4e4e7',
    fontSize: 14,
    lineHeight: 21,
  },
  masonryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  masonryCol: {
    flex: 1,
    gap: 12,
  },
  cardAnimatedWrap: {
    alignSelf: 'stretch',
  },
  card: {
    borderRadius: 18,
    backgroundColor: 'rgba(24,24,27,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.55)',
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: '#34d399',
    borderWidth: 2,
  },
  cardInSelectMode: {
    opacity: 0.98,
  },
  cardPressed: {
    opacity: 0.92,
  },
  /** Fills the text-card front face so tap/long-press targets the whole note area. */
  cardFrontPressableFill: {
    ...StyleSheet.absoluteFillObject,
  },
  cardSelectBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(9,9,11,0.65)',
    padding: 6,
  },
  cardFlipStageImage: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  cardFlipStageText: {
    position: 'relative',
    width: '100%',
  },
  cardFlipTextFace: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(24,24,27,0.98)',
    overflow: 'hidden',
  },
  cardFaceBack: {
    backgroundColor: '#18181b',
  },
  cardBackInnerColumn: {
    flex: 1,
    width: '100%',
  },
  cardBackFlipBar: {
    flexShrink: 0,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(63,63,70,0.65)',
    backgroundColor: 'rgba(24,24,27,0.98)',
  },
  cardBackFlipBarPressed: {
    opacity: 0.85,
  },
  cardBackFlipBarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  /** Occupies remaining height under the flip bar so content scrolls inside a fixed viewport. */
  cardBackScrollFlex: {
    flex: 1,
    width: '100%',
  },
  cardBackScrollContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 20,
  },
  cardBackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(63,63,70,0.65)',
  },
  cardBackHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e4e4e7',
    letterSpacing: 0.3,
  },
  cardBackSectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: 0.55,
    marginTop: 10,
    marginBottom: 4,
  },
  cardBackMeta: {
    fontSize: 12,
    color: '#d4d4d8',
    lineHeight: 18,
  },
  cardBackBody: {
    fontSize: 13,
    color: '#e4e4e7',
    lineHeight: 20,
    marginBottom: 8,
  },
  cardBackThumb: {
    width: '100%',
    height: 108,
    borderRadius: 12,
    backgroundColor: '#27272a',
    marginBottom: 4,
  },
  cardTapHint: {
    marginTop: 8,
    fontSize: 9,
    color: 'rgba(228,228,231,0.55)',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  cardTapHintText: {
    marginTop: 10,
    fontSize: 9,
    color: '#71717a',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#18181b',
  },
  imageCaptionGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 40,
    paddingBottom: 12,
  },
  imageCaptionFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
    opacity: 0.95,
  },
  imageCaptionFolderText: {
    flex: 1,
    fontSize: 9,
    fontWeight: '700',
    color: '#86efac',
    letterSpacing: 0.2,
  },
  imageCaption: {
    fontSize: 10,
    color: '#d4d4d8',
    lineHeight: 14,
  },
  imageCaptionPendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imageCaptionPendingText: {
    flex: 1,
    fontSize: 10,
    color: '#a1a1aa',
    lineHeight: 14,
    fontStyle: 'italic',
  },
  textCardBody: {
    padding: 14,
  },
  textCardFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  textCardFolderText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    color: '#4ade80',
  },
  textCardDate: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(39,39,42,0.55)',
    fontSize: 10,
    color: '#71717a',
  },
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 10,
    color: '#52525b',
    fontSize: 14,
  },
  emptyHint: {
    marginTop: 12,
    paddingHorizontal: 32,
    color: '#71717a',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  deleteToolbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(9,9,11,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#27272a',
  },
  deleteToolbarHint: {
    flex: 1,
    fontSize: 12,
    color: '#a1a1aa',
    lineHeight: 16,
  },
  deleteToolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#b91c1c',
  },
  deleteToolbarBtnDisabled: {
    backgroundColor: '#27272a',
  },
  deleteToolbarBtnPressed: {
    opacity: 0.88,
  },
  deleteToolbarBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fef2f2',
  },
  deleteToolbarBtnTextDisabled: {
    color: '#52525b',
  },
  fabCol: {
    position: 'absolute',
    alignItems: 'flex-end',
    gap: 12,
  },
  fabPrimary: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#f4f4f5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fff',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: '#27272a',
    paddingBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fafafa',
  },
  moveSheetPreview: {
    paddingHorizontal: 22,
    marginBottom: 6,
    fontSize: 13,
    lineHeight: 18,
    color: '#71717a',
  },
  sheetClose: {
    padding: 10,
    borderRadius: 999,
    backgroundColor: '#27272a',
  },
  sheetBody: {
    paddingHorizontal: 22,
  },
  sheetBodyContent: {
    paddingBottom: 24,
  },
  folderPickExplainer: {
    paddingHorizontal: 22,
    marginTop: 4,
    marginBottom: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#a1a1aa',
  },
  folderPickScrollContent: {
    paddingBottom: 28,
  },
  folderPickSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 10,
  },
  folderPickEmpty: {
    fontSize: 13,
    color: '#52525b',
    marginBottom: 8,
  },
  folderPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  folderPickRowCurrent: {
    borderColor: 'rgba(52,211,153,0.45)',
    backgroundColor: 'rgba(52,211,153,0.06)',
  },
  folderPickRowCheckSpacer: {
    width: 18,
    height: 18,
  },
  folderPickRowText: {
    flex: 1,
    fontSize: 15,
    color: '#e4e4e7',
    fontWeight: '500',
  },
  folderPickInput: {
    backgroundColor: '#09090b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#fafafa',
  },
  folderPickCreateBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#f4f4f5',
  },
  folderPickCreateBtnDisabled: {
    opacity: 0.45,
  },
  folderPickCreateBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090b',
  },
  folderPickCreateBtnTextDisabled: {
    color: '#52525b',
  },
  folderPickSkipBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  folderPickSkipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#a1a1aa',
  },
  folderPickDangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 22,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#27272a',
  },
  folderPickDangerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f87171',
  },
  noteInput: {
    minHeight: 120,
    backgroundColor: '#09090b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 14,
    color: '#e4e4e7',
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  noteInputBelowPreview: {
    minHeight: 96,
    backgroundColor: '#09090b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 14,
    color: '#e4e4e7',
    fontSize: 14,
    textAlignVertical: 'top',
    marginTop: 4,
    marginBottom: 16,
  },
  lessonAiOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  lessonAiOptOn: {
    borderColor: 'rgba(16,185,129,0.45)',
    backgroundColor: 'rgba(16,185,129,0.06)',
  },
  lessonAiOptTextCol: {
    flex: 1,
  },
  lessonAiOptTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fafafa',
  },
  lessonAiOptTitleMuted: {
    color: '#a1a1aa',
  },
  lessonAiOptSub: {
    marginTop: 3,
    fontSize: 11,
    color: '#71717a',
    lineHeight: 15,
  },
  lessonAiSwitchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3f3f46',
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lessonAiSwitchTrackOn: {
    backgroundColor: 'rgba(16,185,129,0.35)',
  },
  lessonAiSwitchKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e4e4e7',
  },
  lessonAiSwitchKnobOn: {
    marginLeft: 'auto',
    backgroundColor: '#34d399',
  },
  previewWrap: {
    borderRadius: 16,
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    overflow: 'hidden',
    marginBottom: 12,
    maxHeight: 280,
  },
  previewImg: {
    width: '100%',
    height: 240,
    backgroundColor: '#09090b',
  },
  previewClear: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  editingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#09090b',
  },
  editingHintText: {
    flex: 1,
    fontSize: 11,
    color: '#71717a',
    lineHeight: 15,
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sheetActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#27272a',
  },
  pasteLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d4d4d8',
  },
  saveBtn: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f4f4f5',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090b',
  },
  photoLightboxRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  photoLightboxLayer: {
    zIndex: 1,
  },
  photoLightboxCloseFab: {
    position: 'absolute',
    right: 14,
    zIndex: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,9,11,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(63,63,70,0.65)',
  },
  photoLightboxBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoLightboxScaleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLightboxCaptionWrap: {
    flexShrink: 0,
    paddingHorizontal: 18,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(63,63,70,0.45)',
    backgroundColor: 'rgba(9,9,11,0.35)',
  },
  photoLightboxCaptionScroll: {
    flexGrow: 0,
  },
  photoLightboxCaptionContent: {
    paddingBottom: 4,
  },
  photoLightboxCaption: {
    fontSize: 11,
    lineHeight: 16,
    color: '#a1a1aa',
    textAlign: 'center',
    fontWeight: '400',
  },
});
