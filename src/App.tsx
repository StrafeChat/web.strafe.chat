import type { Component } from 'solid-js';
import { AppRouter } from './routes';
import { DocumentLangSync } from './i18n';

const App: Component = () => {
  return (
    <>
      <DocumentLangSync />
      <AppRouter />
    </>
  );
};

export default App;
