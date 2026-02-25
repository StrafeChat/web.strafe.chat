import type { Component } from 'solid-js';

const SKELETON_COUNT = 6;

export const MessageSkeleton: Component = () => {
  return (
    <div class="flex-1 min-h-0 overflow-hidden flex flex-col">
      <div class="flex flex-col p-4 gap-2">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <div class="flex gap-3 -mx-2 px-2 py-1">
            <div class="size-10 shrink-0 rounded-full bg-muted animate-pulse" />
            <div class="flex-1 min-w-0 space-y-2">
              <div class="flex items-baseline gap-2">
                <div
                  class="h-3.5 rounded bg-muted animate-pulse"
                  style={{ width: `${60 + (i % 3) * 20}px` }}
                />
                <div class="h-3 rounded bg-muted/70 animate-pulse w-12" />
              </div>
              <div
                class="h-3.5 rounded bg-muted/80 animate-pulse"
                style={{ width: `${80 + (i % 4) * 30}%` }}
              />
              {i % 2 === 0 && (
                <div class="h-3 rounded bg-muted/60 animate-pulse max-w-[75%]" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
