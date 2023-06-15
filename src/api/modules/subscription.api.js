import publicClient from '../clients/public.client';

const subscriptionEndpoint = "subscription";
const planEndpoint = "plan";

const subscriptionApi = {
    addSubs: async (data) =>{
        const response = await publicClient.post(subscriptionEndpoint, data)
        return response;
    },

    getSubscriptions: async () => {
        const response = await publicClient.get(subscriptionEndpoint);
        return {response} ;
    }
};

export const planApi = {
    getPlans: async () => {
        const response = await publicClient.get(planEndpoint);
        return {response};
    }
}

export default subscriptionApi