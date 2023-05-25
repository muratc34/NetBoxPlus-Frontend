import publicClient from "../clients/public.client";

const genreEndpoint = "genre"

const genreApi = {
  getList: async () => {
    try {
      const response = await publicClient.get(genreEndpoint);

      return { response };
    } catch (err) { return { err }; }
  }
};

export default genreApi;