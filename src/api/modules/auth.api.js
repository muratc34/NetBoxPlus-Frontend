import publicClient from '../clients/public.client';

const loginEndpoint = "login";
const registerEndpoint = "register";

const authApi = {
    login: async (data) => {
      const response = await publicClient.post(loginEndpoint, data);
      return response;
    },
    register: async (data) => {
        const response = await publicClient.post(registerEndpoint, data);
        return response ;
    }
  };

export default authApi;