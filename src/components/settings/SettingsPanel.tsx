import type { Component, JSX } from 'solid-js';
import { SECTION_TITLES, type SectionId } from './types.js';

export interface SettingsPanelProps {
  section: SectionId;
  onClose: () => void;
  /** When true, show Save button in header; when clicked calls onSave */
  showHeaderSave?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  children: JSX.Element;
}

export const SettingsPanel: Component<SettingsPanelProps> = (props) => (
  <div class="flex-1 flex flex-col min-w-0 bg-card">
    <header class="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-border">
      <h3 class="text-xl font-bold text-foreground truncate min-w-0">{SECTION_TITLES[props.section]}</h3>
      <div class="flex items-center gap-2 shrink-0">
        {props.showHeaderSave && props.onSave && (
          <button
            type="button"
            disabled={props.isSaving}
            onClick={props.onSave}
            class="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            {props.isSaving ? (
              <span class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <>
                <i class="fa-solid fa-check text-xs" />
                Save
              </>
            )}
          </button>
        )}
        <button
          type="button"
          class="size-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Close settings"
          onClick={props.onClose}
        >
          <i class="fa-solid fa-xmark text-lg" />
        </button>
      </div>
    </header>
    <div class="flex-1 overflow-y-auto p-6 flex gap-8">{props.children}</div>
  </div>
);
