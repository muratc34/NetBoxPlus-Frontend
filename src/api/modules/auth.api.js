import publicClient from '../clients/public.client';

const loginEndpoint = "login";
const registerEndpoint = "register";
const userEndpoint = "user";
const changePasswordEndpoint = "changepassword";

const authApi = {
    login: async (data) => {
      const response = await publicClient.post(loginEndpoint, data);
      return response;
    },
    register: async (data) => {
        const response = await publicClient.post(registerEndpoint, data);
        return response;
    },
    changePassword: async(data) => {
      const response = await publicClient.post(changePasswordEndpoint, data);
      return response;
    },
    getUser: async(id) => {
        const response = await publicClient.get(userEndpoint + '/' + id);
        return response;
    }
  };

export default authApi;