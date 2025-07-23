import { createMemo } from "solid-js";
import { MessageProps } from "../types";

export const scrollToMessage = (messageId: string) => {
  const element = document.querySelector(`[data-message-id='${messageId}']`);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("highlight-message");
    setTimeout(() => {
      element.classList.remove("highlight-message");
    }, 2000);
  }
};

export function referencedMessages(props: () => MessageProps, cache: any) {
  return createMemo(() => {
    const currentProps = props();

    if (!currentProps.message_references?.length) return [];

    return currentProps.message_references.map((refId) => {
      const message = cache.getMessage(currentProps.room_id!, refId);
      const user = cache.getUser(message?.author_id || refId);
      return {
        id: refId,
        content: message?.content,
        author: user?.display_name || user?.username || "Unknown User",
        avatar: user?.avatar,
        author_id: message?.author_id || refId,
      };
    });
  });
}
