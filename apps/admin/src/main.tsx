import '@fontsource-variable/inter/wght.css';
// Only the subsets Turkish and English need; the browser fetches a file only when its unicode range is on the page.
import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-800.css';
import '@fontsource/montserrat/latin-ext-600.css';
import '@fontsource/montserrat/latin-ext-700.css';
import '@fontsource/montserrat/latin-ext-800.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';

const root = document.getElementById('root');
if (!root) {
  throw new Error('The #root element is missing from index.html.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
