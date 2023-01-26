import publicClient from '../clients/public.client';

const loginEndpoint = "login";
const registerEndpoint = "register";

const authApi = {
    login: async (data) => {
      try {
        const response = await publicClient.post(loginEndpoint, data);
        return { response };
      } catch (err) { return { err }; }
    },
    register: async (data) => {
        try {
          const response = await publicClient.post(registerEndpoint, data);
          return { response };
        } catch (err) { return { err }; }
      }
  };

export default authApi