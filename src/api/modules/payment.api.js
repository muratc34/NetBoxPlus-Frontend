import publicClient from "../clients/public.client";

const creditCardEndpoint = "creditcard";

const creditCardApi = {
    addCreditCard: async (data) => {
        const response = await publicClient.post(creditCardEndpoint, data);
        return response;
    },
    getCCById: async (id) => {
        const response = await publicClient.get(creditCardEndpoint + '/' + id);
        return { response };
    }
};

export default creditCardApi;