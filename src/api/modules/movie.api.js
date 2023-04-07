import publicClient from "../clients/public.client";

const movieEndpoint = "movie";

const movieApi = {
  getList: async () => {
      const response = await publicClient.get(movieEndpoint);
      return { response };
  },

  getMovie: async (id) => {
    const response = await publicClient.get(movieEndpoint + '/' + id);
    return { response };
}
};

export default movieApi;