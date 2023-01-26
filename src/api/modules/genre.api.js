import publicClient from "../clients/public.client";

const genreEndpoints = "genre"

const genreApi = {
  getList: async () => {
    try {
      const response = await publicClient.get(genreEndpoints);

      return { response };
    } catch (err) { return { err }; }
  }
};

export default genreApi;