import type { Component } from 'solid-js';
import { t } from '../../i18n';

export type TriState = 'allow' | 'deny' | 'neutral';

const OPTIONS: { value: TriState; icon: string; titleKey: string; activeClass: string }[] = [
  { value: 'deny', icon: 'fa-xmark', titleKey: 'permissions.deny', activeClass: 'bg-destructive/20 text-destructive' },
  { value: 'neutral', icon: 'fa-slash', titleKey: 'permissions.resetToDefault', activeClass: 'bg-muted text-foreground' },
  { value: 'allow', icon: 'fa-check', titleKey: 'permissions.allow', activeClass: 'bg-primary/20 text-primary' },
];

/** Channel-override control: Deny / Neutral (inherit) / Allow. */
export const TriStateToggle: Component<{
  state: TriState;
  disabled?: boolean;
  onChange: (next: TriState) => void;
}> = (props) => (
  <div class="flex shrink-0 items-center gap-1 rounded-lg border border-border/70 bg-background/60 p-1" role="radiogroup">
    {OPTIONS.map((opt) => (
      <button
        type="button"
        role="radio"
        aria-checked={props.state === opt.value}
        title={t(opt.titleKey)}
        aria-label={t(opt.titleKey)}
        disabled={props.disabled}
        class={`flex size-7 items-center justify-center rounded-md text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          props.state === opt.value ? opt.activeClass : 'text-muted-foreground hover:bg-muted/60'
        } ${props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        onClick={() => {
          if (!props.disabled) props.onChange(opt.value);
        }}
      >
        <i class={`fa-solid ${opt.icon}`} aria-hidden="true" />
      </button>
    ))}
  </div>
);
