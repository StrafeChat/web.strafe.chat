import type { Component } from 'solid-js';
import { AppRouter } from './routes';
import { DocumentLangSync } from './i18n';
import { initAppearance } from './stores/appearance';
import { initAccessibility } from './stores/accessibility';
import { TooltipHost } from './components/ui/TooltipHost';
import { initDesktop } from './desktop/boot';

// Apply the saved theme / styling options before the first paint of any route.
initAppearance();
initAccessibility();
// The desktop shell, when this is the desktop app (a no-op in a browser).
initDesktop();

const App: Component = () => {
  return (
    <>
      <DocumentLangSync />
      <AppRouter />
      {/* One app-wide custom tooltip for every data-tooltip / native title (off on touch). */}
      <TooltipHost />
    </>
  );
};

export default App;
