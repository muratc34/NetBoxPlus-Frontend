import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { SwiperSlide, Swiper } from 'swiper/react';
import MovieContext from '../../context/MovieContext';
import config from '../../api/configs/config';
import { OutlineButton } from '../button/Button';

import './movie-list.scss';
import { useState } from 'react';
import movieApi from '../../api/modules/movie.api';
import { useEffect } from 'react';
import Loader from '../loader/Loader';
const MostViewed = () => {

    const movies = useContext(MovieContext)

    const orderByClickCount = [...movies].sort((a,b)=> b.movieClickCount - a.movieClickCount).slice(0, 10);
    
  return (
    <div className="section mb-3">
        <div className="section-header mb-2">
          <h2>En Çok İzlenenler</h2>
          <Link to="/browse/movies">
            <OutlineButton className="small">Daha fazla</OutlineButton>
          </Link>
        </div>
        <div className='movie-list'>
          <Swiper
            grabCursor={true}
            autoPlay={{delay: 3000}}
            slidesPerView={5}
          >
            {
              orderByClickCount?.map((item, i) => (
                <SwiperSlide key={i}>
                  <Link to={`/movie/${item.movieId}`}>
                    <img src={config.baseURL + item.posterPath} alt="poster.png" />
                  </Link>
                </SwiperSlide>
              ))
            }
          </Swiper>
        </div>
      </div>
  )
}

export const RecentlyAdded = () => {

  const movies = useContext(MovieContext)
  
  return (
    <div className="container-header">
      <div className="section mb-3">
        <div className="section-header mb-2">
          <h2>En Son Eklenenler</h2>
          <Link to="/browse/movies">
            <OutlineButton className="small">Daha fazla</OutlineButton>
          </Link>
        </div>
        <div className='movie-list'>
          <Swiper
            grabCursor={true}
            slidesPerView={5}
          >
            {
              movies?.map((item, i) => (
                <SwiperSlide key={i}>
                  <Link to={`/movie/${item.id}`}>
                    <img src={config.baseURL + item.posterPath} alt="poster.png" />
                  </Link>
                </SwiperSlide>
              ))
            }
          </Swiper>
        </div>
      </div>
    </div>
  )
}

export const SimilarityByGenre = ({genreIds, movieId}) => {
  const [movies, setMovies] = useState();
  const [response, setResponse] = useState();

  useEffect(() => {
    const getByGenreSimilarity = async (data) =>{
      const { response } = await movieApi.getByGenreSimilarity(data)

      if (response.success) {
        setMovies(response.data);
        setResponse(response)
        setMovies(prevData => prevData.filter(item => item.movieId !== movieId));
      }
    }

    if (genreIds && movieId) {
      getByGenreSimilarity(genreIds)
    } 
    
  }, [genreIds, movieId])

  
  
  return (
    <div className="container-header">
      <div className="section mb-3">
        <div className="section-header mb-2">
          <h2>Bu Türe Benzer Filmler</h2>
        </div>
        {
          response ? (
            <div className='movie-list'>
            <Swiper
              grabCursor={true}
              slidesPerView={5}
            >
              {
                movies?.map((item, i) => (
                  <SwiperSlide key={i}>
                    <Link to={`/movie/${item.movieId}`}>
                      <img src={config.baseURL + item.posterPath} alt="poster.png" />
                    </Link>
                  </SwiperSlide>
                ))
              }
            </Swiper>
          </div>
          ):(
            <Loader/>
          )
        }       
      </div>
    </div>
  )
}

export default MostViewed