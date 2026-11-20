import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider, type DataRouter } from 'react-router';
import { AdminGatewayProvider, type AdminGateway } from './data/gateway';
import { LocaleProvider } from './i18n';

/** The panel with what every page needs: its language, the query cache and the gateway. */
export function App({
  router,
  queryClient,
  gateway,
}: Readonly<{ router: DataRouter; queryClient: QueryClient; gateway: AdminGateway }>) {
  return (
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        <AdminGatewayProvider gateway={gateway}>
          <RouterProvider router={router} />
        </AdminGatewayProvider>
      </QueryClientProvider>
    </LocaleProvider>
  );
}
