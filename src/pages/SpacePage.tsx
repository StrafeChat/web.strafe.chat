import type { Component } from 'solid-js';
import { useParams } from '@solidjs/router';

const SpacePage: Component = () => {
  const params = useParams();
  const spaceId = () => params.spaceId;

  return (
    <div class="flex-1 flex flex-col">
      <div class="h-12 flex items-center px-4 border-b border-border shrink-0">
        <h1 class="text-base font-semibold text-foreground">Space {spaceId()}</h1>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <p class="text-muted-foreground">Space view coming soon.</p>
      </div>
    </div>
  );
};

export default SpacePage;
