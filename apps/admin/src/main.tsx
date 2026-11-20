import '@fontsource-variable/inter/wght.css';
// Only the subsets Turkish and English need; the browser fetches a file only when its unicode range is on the page.
import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-800.css';
import '@fontsource/montserrat/latin-ext-600.css';
import '@fontsource/montserrat/latin-ext-700.css';
import '@fontsource/montserrat/latin-ext-800.css';
import './index.css';
import { createAppQueryClient } from '@netboxplus/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { App } from './app';
import { createAdminGateway } from './data/gateway';
import { sessionKey } from './data/session';
import { gatewayUrl } from './env';
import { routes } from './routes';

// A request that finds the session gone signs the panel out; the shell then asks for signing in.
const queryClient = createAppQueryClient({
  onSessionEnded: () => {
    queryClient.setQueryData(sessionKey, null);
  },
});
const gateway = createAdminGateway(gatewayUrl);
const router = createBrowserRouter(routes);

const root = document.getElementById('root');
if (!root) {
  throw new Error('The #root element is missing from index.html.');
}

createRoot(root).render(
  <StrictMode>
    <App router={router} queryClient={queryClient} gateway={gateway} />
  </StrictMode>,
);
