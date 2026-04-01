import type { Component } from 'solid-js';
import { appSettingsSidebar } from '../../theme/appChrome';
import { ACCOUNT_ITEMS, APP_ITEMS, type SectionId, type SettingsNavItem } from './types.js';
import { PresenceDot } from '../PresenceDot';

export interface SettingsSidebarProps {
  section: SectionId;
  onSectionChange: (id: SectionId) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  displayName: string;
  userId: string;
}

export const SettingsSidebar: Component<SettingsSidebarProps> = (props) => (
  <nav id="user-settings-title" class={`flex w-56 shrink-0 flex-col overflow-hidden ${appSettingsSidebar}`}>
    <div class="p-3 shrink-0 space-y-3">
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" />
        <input
          type="text"
          placeholder="Search settings..."
          class="w-full rounded-md border-0 bg-muted/80 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          value={props.searchQuery}
          onInput={(e) => props.onSearchChange(e.currentTarget.value)}
        />
      </div>
      <div class="flex items-center gap-3 px-1 py-1">
        <div class="relative shrink-0">
          <div class="size-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
            {props.displayName[0]?.toUpperCase() ?? '?'}
          </div>
          <span class="absolute bottom-0 right-0">
            <PresenceDot userId={props.userId} class="size-3.5" />
          </span>
        </div>
        <span class="text-sm font-medium text-foreground truncate min-w-0">{props.displayName}</span>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto py-2 min-h-0">
      <div class="px-2 mb-1">
        <h2 class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Your account</h2>
      </div>
      {ACCOUNT_ITEMS.map((s: SettingsNavItem) => (
        <button
          type="button"
          class={`flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm transition-colors border-l-2 rounded-r ${
            props.section === s.id
              ? 'bg-accent/60 text-foreground border-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40 border-transparent'
          }`}
          onClick={() => props.onSectionChange(s.id)}
        >
          <i class={`fa-solid ${s.icon} w-4 shrink-0 text-sm`} />
          <span class="truncate">{s.label}</span>
        </button>
      ))}
      <div class="px-2 mt-4 mb-1">
        <h2 class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Application</h2>
      </div>
      {APP_ITEMS.map((s: SettingsNavItem) => (
        <button
          type="button"
          class={`flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm transition-colors border-l-2 rounded-r ${
            props.section === s.id
              ? 'bg-accent/60 text-foreground border-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40 border-transparent'
          }`}
          onClick={() => props.onSectionChange(s.id)}
        >
          <i class={`fa-solid ${s.icon} w-4 shrink-0 text-sm`} />
          <span class="truncate">{s.label}</span>
        </button>
      ))}
    </div>
  </nav>
);
