import React, {useState, useEffect} from 'react';
// import PropTypes from 'prop-types';

import './movie-list.scss';

import { SwiperSlide, Swiper } from 'swiper/react';
import { Link } from 'react-router-dom';

// import Button from '../button/Button';
// import movieApi from '../../api/modules/movie.api';
import config from '../../api/configs/config';
import axios from 'axios';
const MovieList = () => {

    const [movies, setMovies] = useState([]);

    // const getMovies = async () =>{
    //   const { response } = await movieApi.getList();
    //   if(response) setMovies(response.data);

    // }

    const getMovies = async () => {
      const {data} = await axios.get("https://localhost:44372/api/movies")
      if(data){
        setMovies(data.data)
      }
    }

    useEffect(() => {
      getMovies();
    }, [])
    
  return (
    <div className='movie-list'>
      <Swiper
        grabCursor={true}
        spaceBetween={10}
        slidesPerView={'auto'}
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
  )
}

export default MovieList