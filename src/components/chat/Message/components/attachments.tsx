import { Component, Show, For } from "solid-js";
import { MessageAttachment } from "../../../../types/messageTypes";
import { StableAudioPlayer } from "./AudioPlayer";

interface MessageAttachmentsProps {
  attachments: MessageAttachment[];
  getAttachmentUrl: (url: string) => string;
  onDownload: (attachment: MessageAttachment) => void;
  messageId?: string;
}

export const MessageAttachments: Component<MessageAttachmentsProps> = (
  props,
) => {
  return (
    <Show when={props.attachments.length > 0}>
      <div class="mt-2 space-y-2">
        <For each={props.attachments}>
          {(attachment) => {
            const isImage = attachment?.type?.startsWith("image/") || false;
            const isVideo = attachment?.type?.startsWith("video/") || false;
            const isAudio = attachment?.type?.startsWith("audio/") || false;
            const attachmentUrl = props.getAttachmentUrl(attachment.url);

            return (
              <div
                class="border border-border rounded-lg overflow-hidden"
                style={{
                  ...((isImage || isVideo) &&
                    attachment.width &&
                    attachment.height && {
                      "max-width": `min(${Math.min(attachment.width, 448)}px, 100%)`,
                    }),
                  ...((isImage || isVideo) &&
                    (!attachment.width || !attachment.height) && {
                      "max-width": "28rem",
                    }),
                  ...(!isImage && !isVideo && { "max-width": "28rem" }),
                }}
              >
                <Show when={isImage}>
                  <img
                    src={attachmentUrl}
                    alt={attachment.name}
                    class="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(attachmentUrl, "_blank")}
                    loading="lazy"
                    style={{
                      ...(attachment.width &&
                        attachment.height && {
                          "aspect-ratio": `${attachment.width} / ${attachment.height}`,
                        }),
                    }}
                  />
                </Show>
                <Show when={isVideo}>
                  <video
                    src={attachmentUrl}
                    controls
                    class="w-full h-auto"
                    preload="metadata"
                    style={{
                      ...(attachment.width &&
                        attachment.height && {
                          "aspect-ratio": `${attachment.width} / ${attachment.height}`,
                        }),
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                </Show>
                <Show when={isAudio}>
                  <StableAudioPlayer
                    src={attachmentUrl}
                    name={attachment.name}
                    size={attachment.size}
                    messageId={props.messageId}
                  />
                </Show>
                <Show when={!isAudio}>
                  <div class="p-3 bg-surface bg-opacity-20">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2 min-w-0">
                        <Show when={!isImage && !isVideo && !isAudio}>
                          <svg
                            class="w-5 h-5 text-text-secondary flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                              clip-rule="evenodd"
                            />
                          </svg>
                        </Show>
                        <div class="min-w-0">
                          <div class="text-sm font-medium text-text-primary truncate">
                            {attachment.name}
                          </div>
                          <div class="text-xs text-text-secondary">
                            {(attachment.size / 1024 / 1024).toFixed(2)} MB
                            <Show when={attachment.width && attachment.height}>
                              <span class="ml-1">
                                • {attachment.width}×{attachment.height}
                              </span>
                            </Show>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => props.onDownload(attachment)}
                        class="flex-shrink-0 p-1 hover:bg-surface hover:bg-opacity-30 rounded transition-colors focus:outline-none"
                        title="Download"
                      >
                        <svg
                          class="w-4 h-4 text-text-secondary"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </Show>
  );
};
