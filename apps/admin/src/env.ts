/** The gateway's address; the admin build is told it (`VITE_GATEWAY_URL`), development uses the local one. */
export const gatewayUrl: string = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:5100';
