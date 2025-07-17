import { Component, Show } from "solid-js";

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
  return (
    <div class="bg-background border border-border rounded-md p-3 mt-1">
      <div
        ref={props.ref}
        contentEditable
        class="text-text-primary whitespace-pre-wrap overflow-hidden max-w-full bg-surface bg-opacity-30 p-3 rounded-md focus:outline-none border border-transparent focus:border-primary min-h-[40px] resize-none"
        style="word-break: break-word; overflow-wrap: break-word;"
        onInput={(e) =>
          props.onContentChange(e.currentTarget.textContent || "")
        }
      >
        {props.content}
      </div>
      <Show when={props.error}>
        <div class="text-xs text-red-500 mt-2">{props.error}</div>
      </Show>
      <div class="flex items-center justify-between mt-3">
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
        <div class="flex gap-2">
          <button
            class="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
            onClick={props.onCancel}
            disabled={props.isLoading}
          >
            Cancel
          </button>
          <button
            class="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={props.onSave}
            disabled={props.isLoading || !props.content.trim()}
          >
            <Show when={props.isLoading} fallback="Save">
              Saving...
            </Show>
          </button>
        </div>
      </div>
    </div>
  );
};
