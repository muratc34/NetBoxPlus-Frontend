import publicClient from "../clients/public.client";

const movieEndpoint = "movie";
const genreEndpoint = "genre";

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


export const genreApi = {
  getList: async () => {
    try {
      const response = await publicClient.get(genreEndpoint);

      return { response };
    } catch (err) { return { err }; }
  }
};

export default movieApi;