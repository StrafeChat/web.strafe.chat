import type { Component } from 'solid-js';
import { AppRouter } from './routes';
import { DocumentLangSync } from './i18n';
import { initAppearance } from './stores/appearance';
import { initAccessibility } from './stores/accessibility';
import { TooltipHost } from './components/ui/TooltipHost';

// Apply the saved theme / styling options before the first paint of any route.
initAppearance();
initAccessibility();

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
