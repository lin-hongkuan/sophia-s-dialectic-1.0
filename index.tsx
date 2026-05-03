import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/400-italic.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';

import App from './App';

declare global {
  interface Window {
    __bootStart?: number;
    __bootSlowTimer?: ReturnType<typeof setTimeout>;
  }
}

const showBootError = (error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[Sophia] boot failed:', error);
  const slowHint = document.getElementById('boot-slow-hint');
  if (slowHint) slowHint.style.display = 'none';
  const errorBox = document.getElementById('boot-error');
  if (errorBox) errorBox.removeAttribute('hidden');
  const detail = document.getElementById('boot-error-detail');
  if (detail) {
    if (error instanceof Error) {
      detail.textContent = `${error.name}: ${error.message}\n\n${error.stack || ''}`;
    } else {
      detail.textContent = String(error);
    }
  }
  if (window.__bootSlowTimer) {
    clearTimeout(window.__bootSlowTimer);
    window.__bootSlowTimer = undefined;
  }
};

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Could not find root element to mount to');
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  showBootError(error);
}
