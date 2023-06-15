import React from 'react'
import { useState, useEffect } from 'react';
import HeroSlide from '../components/hero-slide/HeroSlide';
import MostViewed, { RecentlyAdded } from '../components/movie-list/MovieList';
import Footer from '../components/footer/Footer';
import Header from '../components/header/Header';
import movieApi from '../api/modules/movie.api';
import MovieContext from '../context/MovieContext';
import Loader from '../components/loader/Loader';

const Home = () => {

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
      {
        response ? 
        (
          <div>
            <Header/>
            <MovieContext.Provider value={movies}>
              <HeroSlide/>
              <MostViewed/>
              <RecentlyAdded/>
            </MovieContext.Provider>
            <Footer/>
          </div>
        )
        : 
        (
          <div>
            <Loader/>
          </div>
        )
      }
    </div>
    
  )
}

export default Home;