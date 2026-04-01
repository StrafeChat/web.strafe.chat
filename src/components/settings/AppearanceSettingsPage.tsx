import type { Component } from 'solid-js';
import {
  settings,
  setMessageCompact,
  setMembersPanelOpen,
  type SettingsData,
} from '../../stores/settings';

export const AppearanceSettingsPage: Component = () => (
  <div class="flex-1 min-w-0 max-w-xl space-y-6">
    <section class="space-y-4">
      <h4 class="text-sm font-semibold text-foreground">Messages & layout</h4>
      <p class="text-sm text-muted-foreground">Control how messages and panels are displayed.</p>
    </section>
    <div class="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
      <div>
        <p class="text-sm font-medium text-foreground">Compact messages</p>
        <p class="text-xs text-muted-foreground">Use less vertical space per message.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!!settings.messageCompact}
        class={`relative inline-flex h-6 w-11 shrink-0 rounded-full border border-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          settings.messageCompact ? 'bg-primary border-primary' : 'bg-muted'
        }`}
        onClick={() => setMessageCompact(!settings.messageCompact)}
      >
        <span
          class={`pointer-events-none block size-5 rounded-full bg-white shadow ring-0 transition translate-y-0.5 ${
            settings.messageCompact ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
    <div class="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
      <div>
        <p class="text-sm font-medium text-foreground">Members panel open by default</p>
        <p class="text-xs text-muted-foreground">Show the members sidebar when opening a room.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!!(settings as SettingsData).membersPanelOpen}
        class={`relative inline-flex h-6 w-11 shrink-0 rounded-full border border-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          (settings as SettingsData).membersPanelOpen ? 'bg-primary border-primary' : 'bg-muted'
        }`}
        onClick={() => setMembersPanelOpen(!(settings as SettingsData).membersPanelOpen)}
      >
        <span
          class={`pointer-events-none block size-5 rounded-full bg-white shadow ring-0 transition translate-y-0.5 ${
            (settings as SettingsData).membersPanelOpen ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  </div>
);
