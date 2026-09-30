import type { Component } from 'solid-js';
import { createEffect, createMemo, createSignal, For, Show, onCleanup, onMount } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { RoomParticipant } from '../../api/rooms';
import type { SpaceRole, SpaceRoom } from '../../api/spaces';
import type { CustomEmoji } from '../../api/emojis';
import { spaceRoleColorHex } from '../../lib/spacePermissions';
import { EMPTY_CATALOG, tokenizeDraft, type MentionCatalog } from '../../lib/utils/mentions';
import { emojiCatalogIfLoaded, loadEmojiCatalog, searchEmoji, withSkinTone, type EmojiCatalog } from '../../lib/emoji/data';
import type { PendingAttachment } from '../../lib/attachments/draft';
import { attachmentKind, fileIcon, formatFileSize, isVoiceMessage } from '../../lib/attachments/format';
import {
  isVoiceRecordingSupported,
  startVoiceRecording,
  VOICE_MESSAGE_MAX_MS,
  VoiceRecorderError,
  type VoiceRecorderHandle,
} from '../../lib/voiceRecorder';
import { appearance } from '../../stores/appearance';
import { settings } from '../../stores/settings';
import { appMenuItem, appMenuPanel, zLayer } from '../../theme/appChrome';
import { IconButton } from '../ui/IconButton';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { Emoji } from '../emoji/Emoji';
import { ExpressionPicker, type ExpressionTab } from '../emoji/ExpressionPicker';
import { VoiceMessagePlayer } from '../media';
import { WAVEFORM_BARS } from '../media/waveform';
import { VoiceRecordingBar } from './VoiceRecordingBar';
import { isMdViewport } from '../../stores/mobileShellLayout';
import { requestEditLastMessage } from '../../lib/chatShortcuts';
import { TypingIndicator, type TypingPerson } from './TypingIndicator';
import { t } from '../../i18n';
import { BotTag } from '../BotTag';

export interface ReplyTarget {
  /** Author of the message being replied to. */
  name: string;
  /** One-line preview of that message ('' when unavailable). */
  preview: string;
  onJump?: () => void;
  onCancel: () => void;
}

export interface RoomMessageInputProps {
  draft: string;
  onInput: (e: InputEvent) => void;
  onSubmit: (e: Event) => void;
  /** A send is in flight: block a second submit without disabling the textarea. Disabling
   * it would blur it - and on a phone that closes the keyboard on every message. */
  sending?: boolean;
  placeholder: string;
  disabled: boolean;
  inputRef: (el: HTMLTextAreaElement | undefined) => void;
  /** Who is currently typing here, oldest first. The indicator stacks their avatars. */
  typingUsers?: TypingPerson[];
  /** Room participants for @mention dropdown (excluding current user if provided) */
  participants?: RoomParticipant[];
  /** Space channels only: roles offered in the @mention dropdown. */
  spaceRoles?: SpaceRole[];
  /** Space channels only: text channels offered in the #channel dropdown. */
  spaceRooms?: SpaceRoom[];
  /** Whether @everyone/@here should be offered - space channels gate this on
   * PermMentionEveryone; group PMs (no permission system) can pass true unconditionally;
   * 1:1 PMs should omit/leave false since mass-notifying one other person is meaningless. */
  canMentionEveryone?: boolean;
  currentUserId?: string;
  /** Current selection start in the input (for mention trigger detection) */
  cursorPos?: number;
  /** Called when user selects a completion: replace [queryStart, cursorEnd) with insertText. */
  onInsertMention?: (queryStart: number, cursorEnd: number, insertText: string) => void;
  /** Optional: sync cursor position when user moves caret without typing (arrows, click) */
  onCursorChange?: (pos: number) => void;
  /** When set, the textarea is hidden and this message is shown (e.g. missing send permission). */
  noSendMessage?: string;
  /** Resolves @names / #channels / :emoji: in the draft for the styled overlay. */
  mentionCatalog?: MentionCatalog;
  /** Shown as a strip attached to the top of the box while replying. */
  replyTo?: ReplyTarget | null;
  /** Files queued to go with the next message. */
  attachments?: PendingAttachment[];
  /** Enables the attach button, drag-and-drop and paste-to-attach. */
  onAddFiles?: (files: File[]) => void;
  onRemoveAttachment?: (localId: string) => void;
  /** Validation message from the attachment queue (too large, too many…). */
  attachmentError?: string;
  /** Custom emoji offered by the picker and the :name: completion. */
  customEmojis?: CustomEmoji[];
  /** Send a GIF (its direct .gif URL) as a message, straight from the GIF picker. */
  onSendGif?: (url: string) => void;
}

function participantDisplayName(p: RoomParticipant): string {
  return p.display_name || p.username || t('common.unknown');
}

type Candidate =
  | { kind: 'user'; key: string; label: string; sublabel: string; insertText: string; participant: RoomParticipant }
  | { kind: 'role'; key: string; label: string; colorHex: string; insertText: string }
  | { kind: 'channel'; key: string; label: string; insertText: string }
  | { kind: 'special'; key: string; label: string; sublabel: string; insertText: string }
  | { kind: 'emoji'; key: string; label: string; sublabel: string; insertText: string; unicode?: string; custom?: CustomEmoji };

const EVERYONE_ROLE_NAME = '@everyone';
const ROOM_TYPE_TEXT = 3;
const SPECIALS: Array<{ token: 'everyone' | 'here'; sublabelKey: string }> = [
  { token: 'everyone', sublabelKey: 'composer.mentionEveryone' },
  { token: 'here', sublabelKey: 'composer.mentionHere' },
];

/** Composer grows with its content up to this height, then scrolls (Discord-style). */
const COMPOSER_MAX_HEIGHT_PX = 200;

/** Typography shared by the textarea and its mirror so they stay glyph-aligned. The
 * horizontal padding leaves room for the attach (left) and the GIF+emoji (right) buttons. */
const composerTextClass = 'pl-12 pr-[5.5rem] py-3 text-sm leading-5';

function isWordChar(c: string | undefined): boolean {
  return c != null && /[\p{L}\p{N}_]/u.test(c);
}

export const RoomMessageInput: Component<RoomMessageInputProps> = (props) => {
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [pickerOpen, setPickerOpen] = createSignal(false);
  const [pickerTab, setPickerTab] = createSignal<ExpressionTab>('emoji');
  const [dragDepth, setDragDepth] = createSignal(0);
  const mobile = () => !isMdViewport();

  /** Open the emoji/GIF picker on a tab (or close if that tab is already open). On mobile the
   * picker takes the on-screen keyboard's place, so blur the textarea to dismiss the keyboard. */
  function togglePicker(tab: ExpressionTab) {
    if (pickerOpen() && pickerTab() === tab) {
      setPickerOpen(false);
      return;
    }
    setPickerTab(tab);
    setPickerOpen(true);
    if (mobile()) textareaEl?.blur();
  }
  const [emojiCatalog, setEmojiCatalog] = createSignal<EmojiCatalog | null>(emojiCatalogIfLoaded());
  let textareaEl: HTMLTextAreaElement | undefined;
  let mirrorEl: HTMLDivElement | undefined;
  let fileInputEl: HTMLInputElement | undefined;

  // Desktop expression picker: portaled to <body> and positioned against the toggle buttons,
  // so the room's overflow-hidden scroll area can't clip the tall card (it opens upward from a
  // composer pinned to the bottom - previously the top of the picker was sliced off on short
  // viewports). Measured on open and on resize/scroll; clamped to the viewport, shrinking its
  // height when there isn't room for the full card so it's never cut off.
  let toggleClusterEl: HTMLDivElement | undefined;
  const EXPR_WIDTH = 352; // 22rem
  const EXPR_HEIGHT = 416; // 26rem
  const [exprAnchor, setExprAnchor] = createSignal<
    { left: number; top: number; width: number; height: number } | null
  >(null);
  function measureExprAnchor() {
    const el = toggleClusterEl;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const gap = 8;
    const width = Math.min(EXPR_WIDTH, window.innerWidth - margin * 2);
    const availableAbove = r.top - gap - margin;
    const height = Math.max(0, Math.min(EXPR_HEIGHT, availableAbove));
    const top = r.top - gap - height;
    let left = r.right - width;
    if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
    if (left < margin) left = margin;
    setExprAnchor({ left, top, width, height });
  }
  createEffect(() => {
    if (!pickerOpen() || mobile()) {
      setExprAnchor(null);
      return;
    }
    measureExprAnchor();
    const onReflow = () => measureExprAnchor();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    onCleanup(() => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    });
  });

  // The Unicode catalogue backs :shortcode: completion and serialization; load it once
  // the composer exists rather than on first keystroke, so the first ":smi" already works.
  onMount(() => {
    if (!emojiCatalog()) loadEmojiCatalog().then(setEmojiCatalog).catch(() => undefined);
  });

  function autoGrow(el: HTMLTextAreaElement) {
    // An empty field is always exactly one line. A textarea's scrollHeight counts its
    // placeholder, so a long placeholder in a narrow composer ("Message #some-long-channel")
    // wraps and would inflate the empty box to two lines - which then made the bottom-pinned
    // action buttons sit low instead of centered. Fall back to the CSS min-height until there's
    // real content to grow for.
    if (el.value === '') {
      el.style.height = '';
      el.style.overflowY = 'hidden';
      if (mirrorEl) mirrorEl.scrollTop = 0;
      return;
    }
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX_HEIGHT_PX ? 'auto' : 'hidden';
    if (mirrorEl) mirrorEl.scrollTop = el.scrollTop;
  }

  // Re-measure whenever the draft changes (typing, mention insert, clear-after-send).
  createEffect(() => {
    void props.draft;
    const el = textareaEl;
    if (!el) return;
    queueMicrotask(() => autoGrow(el));
  });

  const catalog = () => props.mentionCatalog ?? EMPTY_CATALOG;
  const overlayTokens = createMemo(() => tokenizeDraft(props.draft, catalog()));
  const hasAttachments = () => (props.attachments?.length ?? 0) > 0;
  // Recording blocks sending: the field is hidden behind the recording bar, so an Enter or a
  // click on send must not fire a half-written draft while the mic is hot.
  const canSend = () =>
    (props.draft.trim().length > 0 || hasAttachments()) && !props.disabled && !props.sending && !recording();

  // Voice messages. The recorder lives here rather than in the page because it is pure UI
  // state that dies with the composer; the finished clip is handed to the normal
  // attachment queue, so it uploads, encrypts and previews like any other attachment.
  const [recording, setRecording] = createSignal(false);
  const [voiceLevels, setVoiceLevels] = createSignal<number[]>([]);
  const [voiceElapsedMs, setVoiceElapsedMs] = createSignal(0);
  const [voiceError, setVoiceError] = createSignal('');
  let recorder: VoiceRecorderHandle | null = null;
  let recordTimer: number | null = null;

  function clearRecordTimer() {
    if (recordTimer !== null) {
      window.clearInterval(recordTimer);
      recordTimer = null;
    }
  }

  /** Human-readable reason for a failed start, so the UI can say why rather than shrug. */
  function voiceErrorKey(err: unknown): string {
    const reason = err instanceof VoiceRecorderError ? err.reason : 'failed';
    switch (reason) {
      case 'unsupported':
        return t('attachments.voice.unsupported');
      case 'denied':
        return t('attachments.voice.denied');
      case 'unavailable':
        return t('attachments.voice.unavailable');
      default:
        return t('attachments.voice.failed');
    }
  }

  async function beginRecording() {
    if (recording() || props.disabled) return;
    setVoiceError('');
    let handle: VoiceRecorderHandle;
    try {
      handle = await startVoiceRecording();
    } catch (err) {
      setVoiceError(voiceErrorKey(err));
      return;
    }
    recorder = handle;
    setRecording(true);
    setVoiceLevels([]);
    setVoiceElapsedMs(0);
    // Poll rather than push: the recorder is deliberately Solid-free, and a 100ms tick is
    // smooth enough for a waveform that grows 72 slots over minutes.
    recordTimer = window.setInterval(() => {
      const h = recorder;
      if (!h) return;
      const elapsed = h.elapsedMs();
      setVoiceElapsedMs(elapsed);
      setVoiceLevels(h.levels().slice(-WAVEFORM_BARS));
      if (elapsed >= VOICE_MESSAGE_MAX_MS) void stopRecording();
    }, 100);
  }

  async function stopRecording() {
    const handle = recorder;
    recorder = null;
    clearRecordTimer();
    if (!handle) return;
    setRecording(false);
    setVoiceLevels([]);
    setVoiceElapsedMs(0);
    const clip = await handle.stop();
    // A clip shorter than the floor is a mis-click, not a message.
    if (!clip) {
      setVoiceError(t('attachments.voice.tooShort'));
      return;
    }
    props.onAddFiles?.([clip.file]);
  }

  function cancelRecording() {
    recorder?.cancel();
    recorder = null;
    clearRecordTimer();
    setRecording(false);
    setVoiceLevels([]);
    setVoiceElapsedMs(0);
  }

  // Never leave the microphone running if the composer goes away mid-recording.
  onCleanup(() => {
    if (recorder) cancelRecording();
  });

  const completion = createMemo(() => {
    const draft = props.draft;
    const pos = props.cursorPos ?? draft.length;
    const textBefore = draft.slice(0, pos);
    const atIndex = textBefore.lastIndexOf('@');
    const hashIndex = props.spaceRooms?.length ? textBefore.lastIndexOf('#') : -1;
    const colonIndex = textBefore.lastIndexOf(':');
    const triggerIndex = Math.max(atIndex, hashIndex, colonIndex);
    if (triggerIndex === -1) return null;
    const trigger = textBefore[triggerIndex]!;
    // Only trigger at a word boundary ("email@" / "10:30" must not open the menu).
    if (triggerIndex > 0 && isWordChar(textBefore[triggerIndex - 1])) return null;
    const query = textBefore.slice(triggerIndex + 1);
    if (query.includes('\n') || /\s/.test(query)) return null;
    const q = query.toLowerCase();

    const candidates: Candidate[] = [];
    if (trigger === ':') {
      // Emoji needs a couple of characters so a lone ":" (smileys, times) stays quiet.
      if (q.length < 2) return null;
      for (const c of props.customEmojis ?? []) {
        if (!c.name.toLowerCase().includes(q)) continue;
        candidates.push({ kind: 'emoji', key: `custom:${c.id}`, label: `:${c.name}:`, sublabel: t('composer.customEmoji'), insertText: `:${c.name}: `, custom: c });
        if (candidates.length >= 6) break;
      }
      const cat = emojiCatalog();
      if (cat) {
        for (const e of searchEmoji(cat, q, 8)) {
          const unicode = withSkinTone(e, appearance.emojiSkinTone);
          candidates.push({ kind: 'emoji', key: `u:${e.hexcode}`, label: `:${e.shortcode}:`, sublabel: e.label, insertText: `${unicode} `, unicode });
        }
      }
    } else if (trigger === '#') {
      for (const r of props.spaceRooms ?? []) {
        if (r.type !== ROOM_TYPE_TEXT || !r.name) continue;
        if (q !== '' && !r.name.toLowerCase().startsWith(q)) continue;
        candidates.push({ kind: 'channel', key: `channel:${r.id}`, label: r.name, insertText: `#${r.name} ` });
      }
    } else {
      const currentUserId = props.currentUserId;
      const others = currentUserId
        ? (props.participants ?? []).filter((p) => p.id !== currentUserId)
        : props.participants ?? [];
      for (const p of others) {
        const name = participantDisplayName(p);
        const username = p.username ?? '';
        if (!username) continue;
        if (q !== '' && !name.toLowerCase().startsWith(q) && !username.toLowerCase().startsWith(q)) continue;
        candidates.push({
          kind: 'user',
          key: `user:${p.id}`,
          label: name,
          sublabel: `@${username}`,
          insertText: `@${username} `,
          participant: p,
        });
      }
      for (const r of props.spaceRoles ?? []) {
        if (r.name === EVERYONE_ROLE_NAME || !r.mentionable) continue;
        if (q !== '' && !r.name.toLowerCase().startsWith(q)) continue;
        candidates.push({
          kind: 'role',
          key: `role:${r.id}`,
          label: r.name,
          colorHex: spaceRoleColorHex(r.color),
          insertText: `@${r.name} `,
        });
      }
      if (props.canMentionEveryone) {
        for (const s of SPECIALS) {
          if (q !== '' && !s.token.startsWith(q)) continue;
          candidates.push({
            kind: 'special',
            key: `special:${s.token}`,
            label: s.token,
            sublabel: t(s.sublabelKey),
            insertText: `@${s.token} `,
          });
        }
      }
    }
    if (candidates.length === 0) return null;
    return { queryStart: triggerIndex, cursorEnd: pos, list: candidates.slice(0, 12) };
  });

  const completionOpen = () => completion() !== null;
  const completionList = () => completion()?.list ?? [];
  const maxIndex = () => Math.max(0, completionList().length - 1);
  const effectiveSelectedIndex = () => Math.min(selectedIndex(), maxIndex());

  function select(candidate: Candidate) {
    const state = completion();
    if (!state || !props.onInsertMention) return;
    props.onInsertMention(state.queryStart, state.cursorEnd, candidate.insertText);
    setSelectedIndex(0);
  }

  /** Insert text at the caret (used by the emoji picker). */
  function insertAtCaret(text: string) {
    const el = textareaEl;
    const pos = el ? el.selectionStart : props.draft.length;
    props.onInsertMention?.(pos, el ? el.selectionEnd : pos, text);
  }

  const handlePickEmoji = (pick: { custom?: CustomEmoji; unicode?: string }) => {
    insertAtCaret(pick.custom ? `:${pick.custom.name}: ` : `${pick.unicode} `);
    setPickerOpen(false);
    // Keep focus so desktop typing continues; on mobile the picker replaced the keyboard, so
    // don't force it back open until the user taps the field again.
    if (!mobile()) textareaEl?.focus();
  };
  const handlePickGif = (gif: { url: string }) => {
    props.onSendGif?.(gif.url);
    setPickerOpen(false);
  };

  function handleKeyDown(e: KeyboardEvent) {
    const state = completion();
    if (state) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, maxIndex()));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const candidate = completionList()[effectiveSelectedIndex()];
        if (candidate) {
          e.preventDefault();
          select(candidate);
        }
        return;
      }
      if (e.key === 'Escape') {
        setSelectedIndex(0);
        return;
      }
    }
    // ↑ in an empty composer edits your last message (Discord). Only when empty, so it never
    // steals the arrow key from someone moving the caret in a draft.
    if (e.key === 'ArrowUp' && props.draft === '' && !props.replyTo) {
      e.preventDefault();
      requestEditLastMessage();
      return;
    }
    if (e.key === 'Escape' && props.replyTo) {
      e.preventDefault();
      props.replyTo.onCancel();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend()) {
        (e.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
      }
    }
  }

  function handlePaste(e: ClipboardEvent) {
    if (!props.onAddFiles) return;
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length === 0) return;
    e.preventDefault();
    props.onAddFiles(files);
  }

  function handleDrop(e: DragEvent) {
    setDragDepth(0);
    if (!props.onAddFiles) return;
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length === 0) return;
    e.preventDefault();
    props.onAddFiles(files);
  }

  const tokenClass = (kind: string): string => {
    switch (kind) {
      case 'user':
      case 'channel':
      case 'everyone':
        return 'rounded bg-primary/25 text-primary';
      case 'emoji':
        return 'rounded bg-primary/15 text-primary';
      case 'role':
        return 'rounded';
      case 'url':
        return 'text-primary underline underline-offset-2';
      case 'code':
        return 'rounded bg-muted text-foreground';
      case 'marker':
        return 'text-muted-foreground/60';
      case 'bold':
      case 'italic':
        return 'text-foreground';
      default:
        return '';
    }
  };

  const hasTopStrip = () => hasAttachments() || !!props.replyTo;

  return (
    <>
      <Show
        when={!props.noSendMessage}
        fallback={
          <div class="shrink-0 px-4 pt-2">
            <div class="flex min-h-11 items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <i class="fa-solid fa-lock text-xs" aria-hidden="true" />
              {props.noSendMessage}
            </div>
          </div>
        }
      >
        <form
          onSubmit={(e) => {
            if (props.sending || recording()) {
              e.preventDefault();
              return;
            }
            props.onSubmit(e);
          }}
          class="relative shrink-0 px-4 pt-2 pb-1.5"
          onDragEnter={(e) => {
            if (!props.onAddFiles || !e.dataTransfer?.types.includes('Files')) return;
            e.preventDefault();
            setDragDepth((d) => d + 1);
          }}
          onDragOver={(e) => {
            if (!props.onAddFiles || !e.dataTransfer?.types.includes('Files')) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={(e) => {
            if (!props.onAddFiles || !e.dataTransfer?.types.includes('Files')) return;
            setDragDepth((d) => Math.max(0, d - 1));
          }}
          onDrop={handleDrop}
        >
          <Show when={dragDepth() > 0}>
            <div class="pointer-events-none absolute inset-x-4 inset-y-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-primary">
              <i class="fa-solid fa-paperclip me-2" aria-hidden="true" />
              {t('composer.dropFiles')}
            </div>
          </Show>
          <Show when={props.attachmentError}>
            <p class="mb-1.5 flex items-center gap-1.5 text-xs text-destructive">
              <i class="fa-solid fa-circle-exclamation" aria-hidden="true" />
              {props.attachmentError}
            </p>
          </Show>
          <Show when={voiceError()}>
            <p class="mb-1.5 flex items-center gap-1.5 text-xs text-destructive">
              <i class="fa-solid fa-circle-exclamation" aria-hidden="true" />
              {voiceError()}
            </p>
          </Show>
          <div class="relative flex items-end gap-2">
            <div class="relative min-w-0 flex-1">
              <Show when={hasAttachments()}>
                <div class="flex flex-wrap gap-2 rounded-t-lg border border-b-0 border-input bg-muted/40 p-2">
                  <For each={props.attachments}>
                    {(att) => {
                      const kind = attachmentKind(att.file.type, att.file.name);
                      // A queued voice message is playable straight away, so you can check
                      // the take before committing it to the room.
                      const isVoice = () => isVoiceMessage(att.file.type, att.file.name) && !!att.previewUrl;
                      return (
                        <Show
                          when={!isVoice()}
                          fallback={
                            <div
                              class="group/pending relative w-full max-w-sm"
                              title={`${att.file.name} (${formatFileSize(att.file.size)})`}
                            >
                              <VoiceMessagePlayer src={att.previewUrl!} size={att.file.size} filename={att.file.name} />
                              <div class="absolute end-1.5 top-1.5">
                                <IconButton
                                  size="sm"
                                  tone="overlay"
                                  icon="fa-solid fa-xmark"
                                  label={t('composer.removeAttachment', { name: att.file.name })}
                                  onClick={() => props.onRemoveAttachment?.(att.localId)}
                                />
                              </div>
                            </div>
                          }
                        >
                          <div
                            class="group/pending relative flex w-24 flex-col overflow-hidden rounded-md border border-border/70 bg-background/70"
                            title={`${att.file.name} (${formatFileSize(att.file.size)})`}
                          >
                            <div class="flex h-20 items-center justify-center overflow-hidden bg-muted/40">
                              <Show
                                when={kind === 'image' && att.previewUrl}
                                fallback={
                                  <Show
                                    when={kind === 'video' && att.previewUrl}
                                    fallback={
                                      <i class={`fa-solid ${fileIcon(att.file.type, att.file.name)} text-2xl text-muted-foreground`} aria-hidden="true" />
                                    }
                                  >
                                    <video src={att.previewUrl} muted class="size-full object-cover" />
                                  </Show>
                                }
                              >
                                <img src={att.previewUrl} alt="" class="size-full object-cover" />
                              </Show>
                            </div>
                            <p class="truncate px-1.5 py-1 text-[11px] text-muted-foreground">{att.file.name}</p>
                            <div class="absolute right-1 top-1">
                              <IconButton
                                size="sm"
                                tone="overlay"
                                icon="fa-solid fa-xmark"
                                label={t('composer.removeAttachment', { name: att.file.name })}
                                onClick={() => props.onRemoveAttachment?.(att.localId)}
                              />
                            </div>
                          </div>
                        </Show>
                      );
                    }}
                  </For>
                </div>
              </Show>
              <Show when={props.replyTo}>
                {(reply) => (
                  <div
                    class={`flex items-center gap-2 border border-b-0 border-input bg-muted/40 py-1.5 pl-3 pr-1.5 text-xs ${
                      hasAttachments() ? 'border-t-0' : 'rounded-t-lg'
                    }`}
                  >
                    <i class="fa-solid fa-reply shrink-0 -scale-x-100 text-[11px] text-muted-foreground" aria-hidden="true" />
                    <span class="shrink-0 text-muted-foreground">{t('composer.replyingTo')}</span>
                    <span class="shrink-0 font-semibold text-foreground">{reply().name}</span>
                    <span class="min-w-0 flex-1 truncate text-muted-foreground">{reply().preview}</span>
                    <Show when={reply().onJump}>
                      <button
                        type="button"
                        class="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        onClick={() => reply().onJump?.()}
                      >
                        {t('composer.jump')}
                      </button>
                    </Show>
                    <IconButton size="sm" icon="fa-solid fa-xmark" label={t('composer.cancelReply')} onClick={() => reply().onCancel()} />
                  </div>
                )}
              </Show>
              <Show when={recording()}>
                <VoiceRecordingBar
                  levels={voiceLevels()}
                  elapsedMs={voiceElapsedMs()}
                  maxMs={VOICE_MESSAGE_MAX_MS}
                  onStop={() => void stopRecording()}
                  onCancel={cancelRecording}
                />
              </Show>
              <div class={`relative ${props.disabled ? 'opacity-50' : ''} ${recording() ? 'hidden' : ''}`}>
                {/* Paint order is DOM order: field fill, then the styled mirror, then the
                    transparent textarea on top (it owns the caret, selection and events),
                    then the attach/emoji buttons floating at either end. */}
                <div
                  aria-hidden="true"
                  class={`absolute inset-0 rounded-lg bg-background/80 ${hasTopStrip() ? 'rounded-t-none' : ''}`}
                />
                <div
                  ref={(el) => {
                    mirrorEl = el;
                  }}
                  aria-hidden="true"
                  class={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent text-foreground ${composerTextClass} ${
                    hasTopStrip() ? 'rounded-t-none' : ''
                  }`}
                >
                  <For each={overlayTokens()}>
                    {(t) => (
                      <span
                        class={tokenClass(t.kind)}
                        style={
                          t.kind === 'role' && t.colorHex
                            ? { 'background-color': `${t.colorHex}33`, color: t.colorHex }
                            : undefined
                        }
                      >
                        {t.text}
                      </span>
                    )}
                  </For>
                  {/* A trailing newline needs something after it to take up a line, like the textarea's caret does. */}
                  <Show when={props.draft.endsWith('\n')}>{'​'}</Show>
                </div>
                <textarea
                  ref={(el) => {
                    textareaEl = el;
                    props.inputRef(el);
                  }}
                  value={props.draft}
                  onInput={(e) => props.onInput(e)}
                  onKeyDown={handleKeyDown}
                  onKeyUp={(e) => props.onCursorChange?.((e.target as HTMLTextAreaElement).selectionStart)}
                  onClick={(e) => props.onCursorChange?.((e.target as HTMLTextAreaElement).selectionStart)}
                  onPaste={handlePaste}
                  onScroll={(e) => {
                    if (mirrorEl) mirrorEl.scrollTop = e.currentTarget.scrollTop;
                  }}
                  placeholder={props.placeholder}
                  rows={1}
                  spellcheck={settings.spellcheck}
                  class={`relative box-border block min-h-12 w-full resize-none overflow-hidden rounded-lg border border-input bg-transparent text-transparent caret-foreground placeholder:text-muted-foreground transition-colors focus:border-input focus:outline-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed ${composerTextClass} ${
                    hasTopStrip() ? 'rounded-t-none' : ''
                  }`}
                  disabled={props.disabled}
                />
                <div class="absolute bottom-1.5 left-1.5">
                  <IconButton
                    size="lg"
                    tone="subtle"
                    icon="fa-solid fa-circle-plus"
                    label={t('composer.attachFiles')}
                    title={props.onAddFiles ? t('composer.attachFiles') : t('composer.attachUnavailable')}
                    disabled={!props.onAddFiles || props.disabled}
                    onClick={() => fileInputEl?.click()}
                  />
                  <input
                    ref={(el) => {
                      fileInputEl = el;
                    }}
                    type="file"
                    multiple
                    class="hidden"
                    tabIndex={-1}
                    onChange={(e) => {
                      const files = [...(e.currentTarget.files ?? [])];
                      e.currentTarget.value = '';
                      if (files.length) props.onAddFiles?.(files);
                    }}
                  />
                </div>
                <div class="absolute bottom-1.5 right-1.5 flex items-center gap-0.5" ref={(el) => (toggleClusterEl = el)}>
                  <IconButton
                    size="lg"
                    tone="subtle"
                    icon="fa-solid fa-film"
                    label={t('gif.tab')}
                    active={pickerOpen() && pickerTab() === 'gif'}
                    disabled={props.disabled}
                    data-expr-toggle=""
                    onClick={() => togglePicker('gif')}
                  />
                  <IconButton
                    size="lg"
                    tone="subtle"
                    icon="fa-solid fa-face-smile"
                    label={t('composer.emoji')}
                    active={pickerOpen() && pickerTab() === 'emoji'}
                    disabled={props.disabled}
                    data-expr-toggle=""
                    onClick={() => togglePicker('emoji')}
                  />
                  <Show when={props.onAddFiles && !recording()}>
                    <IconButton
                      size="lg"
                      tone="subtle"
                      icon="fa-solid fa-microphone"
                      label={t('composer.recordVoice')}
                      title={isVoiceRecordingSupported() ? t('composer.recordVoice') : t('composer.voiceUnavailable')}
                      disabled={props.disabled}
                      data-expr-toggle=""
                      onClick={() => void beginRecording()}
                    />
                  </Show>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={!canSend()}
              // Keep the textarea focused so the on-screen keyboard does not close and
              // reopen on every send. preventDefault on pointer-down blocks the focus
              // change; the click still fires and submits.
              onPointerDown={(e) => e.preventDefault()}
              class="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 md:hidden"
              title={t('common.send')}
              aria-label={t('common.send')}
            >
              <i class="fa-solid fa-paper-plane text-sm" aria-hidden="true" />
            </button>
            {/* Desktop: a floating card, portaled to <body> and positioned above the toggle
                buttons so the room's overflow-hidden scroll area can't clip it. */}
            <Show when={pickerOpen() && !mobile() && exprAnchor()}>
              {(anchor) => (
                <Portal>
                  <div
                    class={`fixed ${zLayer.popover}`}
                    style={{
                      left: `${anchor().left}px`,
                      top: `${anchor().top}px`,
                      width: `${anchor().width}px`,
                      height: `${anchor().height}px`,
                    }}
                  >
                    <ExpressionPicker
                      initialTab={pickerTab()}
                      onClose={() => setPickerOpen(false)}
                      onPickEmoji={handlePickEmoji}
                      onPickGif={handlePickGif}
                    />
                  </div>
                </Portal>
              )}
            </Show>
            <Show when={completionOpen()}>
              <div
                class={`absolute bottom-full left-0 right-13 mb-2 max-h-60 overflow-y-auto md:right-0 ${appMenuPanel}`}
                role="listbox"
                aria-label={t('composer.completionAria')}
              >
                <div class="flex flex-col gap-0.5">
                  <For each={completionList()}>
                    {(c, i) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={i() === effectiveSelectedIndex()}
                        class={`${appMenuItem} ${
                          i() === effectiveSelectedIndex()
                            ? 'bg-primary/15 text-foreground'
                            : 'text-foreground hover:bg-accent/70'
                        }`}
                        onMouseEnter={() => setSelectedIndex(i())}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => select(c)}
                      >
                        <Show when={c.kind === 'user'}>
                          <MessageAvatar
                            name={c.label}
                            avatar={(c as { participant: RoomParticipant }).participant.avatar}
                            class="size-6 text-[11px]"
                          />
                          <span class="truncate">{c.label}</span>
                          <BotTag bot={(c as { participant: RoomParticipant }).participant.bot} size="xs" class="ms-0" />
                          <span class="truncate text-xs text-muted-foreground">
                            {(c as { sublabel?: string }).sublabel}
                          </span>
                        </Show>
                        <Show when={c.kind === 'role'}>
                          <span class="flex size-6 shrink-0 items-center justify-center">
                            <span
                              class="size-2.5 rounded-full ring-1 ring-border/40"
                              style={{ 'background-color': (c as { colorHex: string }).colorHex }}
                            />
                          </span>
                          <span class="truncate">{c.label}</span>
                          <span class="truncate text-xs text-muted-foreground">{t('composer.role')}</span>
                        </Show>
                        <Show when={c.kind === 'channel'}>
                          <span class="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
                            <i class="fa-solid fa-hashtag text-xs" aria-hidden="true" />
                          </span>
                          <span class="truncate">{c.label}</span>
                          <span class="truncate text-xs text-muted-foreground">{t('composer.room')}</span>
                        </Show>
                        <Show when={c.kind === 'special'}>
                          <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                            <i class="fa-solid fa-at text-[11px]" aria-hidden="true" />
                          </span>
                          <span class="truncate">@{c.label}</span>
                          <span class="truncate text-xs text-muted-foreground">
                            {(c as { sublabel?: string }).sublabel}
                          </span>
                        </Show>
                        <Show when={c.kind === 'emoji'}>
                          {(() => {
                            const ec = c as Extract<Candidate, { kind: 'emoji' }>;
                            return (
                              <>
                                <span class="flex size-6 shrink-0 items-center justify-center">
                                  <Show when={ec.custom} fallback={<Emoji emoji={ec.unicode!} class="!m-0 !size-5" />}>
                                    <img src={ec.custom!.url} alt="" class="size-5 object-contain" />
                                  </Show>
                                </span>
                                <span class="truncate">{ec.label}</span>
                                <span class="truncate text-xs text-muted-foreground">{ec.sublabel}</span>
                              </>
                            );
                          })()}
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>
          {/* Mobile: dock the picker where the on-screen keyboard was - same spot, replacing it.
              It sits below the input inside the bottom-anchored composer dock, so opening it
              pushes the field up exactly like the keyboard did. Blurring the textarea (in
              togglePicker) dismisses the keyboard so the two never fight for the space. */}
          <Show when={pickerOpen() && mobile()}>
            <div class="mt-2 h-[45vh] max-h-[24rem] min-h-[15rem] overflow-hidden rounded-lg border border-border/70">
              <ExpressionPicker
                fill
                initialTab={pickerTab()}
                onClose={() => setPickerOpen(false)}
                onPickEmoji={handlePickEmoji}
                onPickGif={handlePickGif}
              />
            </div>
          </Show>
        </form>
      </Show>
      <TypingIndicator people={props.typingUsers ?? []} />
    </>
  );
};
