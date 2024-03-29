import publicClient from "../clients/public.client";

const movieEndpoint = "movie";
const searchEndpoint = "search?keyword=";
const genreEndpoint = "genre";
const getAllForGenreEndpoint = "getbygenre";
const getByGenreIdEndpoint = "getbygenre?genreId=";
const getByGenreSimilarityEndpoint = "getbygenresimilarity?";

const movieApi = {
  getList: async () => {
      const response = await publicClient.get(movieEndpoint);
      return { response };
  },

  getMovie: async (id) => {
    const response = await publicClient.get(movieEndpoint + '/' + id);
    return { response };
  },

  search: async (keyword) => {
    const response = await publicClient.get(searchEndpoint + keyword);
    return { response };
  },

  getByGenre: async(genreId) => {
    const response = await publicClient.get(genreId ? getByGenreIdEndpoint + genreId: getAllForGenreEndpoint);
    return {response};
  },

  getByGenreSimilarity: async(data) => {
    var uri = "genreIds="
    console.log(data)
    data?.map((x, index) =>(
      uri = uri + x.id + (index !== data.length - 1 ? "&genreIds=" : "")
    ))
    const response = await publicClient.get(getByGenreSimilarityEndpoint + uri);
    return {response};
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