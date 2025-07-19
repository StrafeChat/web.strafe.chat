import { Component, Show, onMount, createEffect } from "solid-js";
import { useAuth } from "../../../../lib/providers/auth/AuthProvider";

interface MessageEditorProps {
  content: string;
  error: string;
  isLoading: boolean;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
  ref?: (el: HTMLDivElement) => void;
}

export const MessageEditor: Component<MessageEditorProps> = (props) => {
  let editorRef: HTMLDivElement | undefined;
  let isInitialized = false;
  const { isMobile } = useAuth();

  const setEditorRef = (el: HTMLDivElement) => {
    editorRef = el;
    if (props.ref) {
      props.ref(el);
    }
  };

  onMount(() => {
    if (editorRef && props.content) {
      editorRef.textContent = props.content;
      // Position cursor at the end on initial mount
      const range = document.createRange();
      const selection = window.getSelection();
      if (editorRef.childNodes.length > 0) {
        range.setStartAfter(editorRef.childNodes[editorRef.childNodes.length - 1]);
      } else {
        range.setStart(editorRef, 0);
      }
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      isInitialized = true;
    }
  });

  createEffect(() => {
    // Only update content if it's different and not from user input
    if (editorRef && !isInitialized && props.content !== editorRef.textContent) {
      const selection = window.getSelection();
      const range = selection?.getRangeAt(0);
      const cursorPosition = range?.startOffset || 0;
      
      editorRef.textContent = props.content;
      
      // Restore cursor position
      if (selection && editorRef.childNodes.length > 0) {
        const newRange = document.createRange();
        const textNode = editorRef.childNodes[0];
        const maxOffset = textNode?.textContent?.length || 0;
        newRange.setStart(textNode, Math.min(cursorPosition, maxOffset));
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    }
  });

  return (
    <div class="rounded-md pt-2">
      <div
        ref={setEditorRef}
        contentEditable
        class="text-text-primary whitespace-pre-wrap overflow-hidden max-w-full bg-surface bg-opacity-30 p-3 rounded-md focus:outline-none focus:border-primary min-h-[40px] resize-none border border-border"
        style="word-break: break-word; overflow-wrap: break-word;"
        onInput={(e) => {
          isInitialized = true;
          props.onContentChange(e.currentTarget.textContent || "");
        }}
        onKeyDown={(e) => {       
          if (!isMobile && e.key === "Enter") {
            if (e.shiftKey) {
              // Shift+Enter: Allow new line (default behavior)
              return;
            } else {
              // Enter only: Save the message
              e.preventDefault();
              props.onSave();
            }
          }
          
          if (e.key === "Escape") {
            e.preventDefault();
            props.onCancel();
          }
        }}
      >
      </div>
      <Show when={props.error}>
        <div class="text-xs text-red-500 mt-2">{props.error}</div>
      </Show>
      <div class="flex items-center justify-between mt-1">
        <div class="text-xs text-text-secondary">
          escape to{" "}
          <span
            class="text-text-primary font-medium cursor-pointer hover:underline"
            onClick={props.onCancel}
          >
            cancel
          </span>{" "}
          • enter to{" "}
          <span
            class="text-text-primary font-medium cursor-pointer hover:underline"
            onClick={props.onSave}
          >
            save
          </span>
        </div>
      </div>
    </div>
  );
};
