import React, { useEffect, useState } from 'react'
import Footer from '../components/footer/Footer';
import Header from '../components/header/Header';
import MovieCard from '../components/movie-card/MovieCard';
import movieApi from '../api/modules/movie.api';
import MovieContext from '../context/MovieContext';

const Catalog = () => {

  const [movies, setMovies] = useState([]);
  const [response, setResponse] = useState();
  
  const getMovies = async () => {
    await movieApi.getList()
    .then(({response})=>{
      setMovies(response.data);
      setResponse(response.success);
    });
  };

  useEffect(() => {
    getMovies()
  },[]);

  return (
    <div>
      <Header/>
      <MovieContext.Provider value={movies}>
        <MovieCard/>
      </MovieContext.Provider>
      <Footer/>
    </div>
  )
}

export default Catalog;