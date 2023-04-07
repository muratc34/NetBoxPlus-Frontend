import React, { useContext } from 'react';
import "./movie-card.scss";
import MovieContext from '../../context/MovieContext';
import config from '../../api/configs/config';
import { Link } from 'react-router-dom';

const MovieCard = () => {
    
    const movies = useContext(MovieContext)
    console.log(movies)
  return (
    <div className='test container-mt-5'>
        {
            movies?.map((item, i) => (
            <div key={i} className='movie-card-poster'>
                    <Link to={`/movie/${item.id}`}>
                    <img src={config.baseURL + item.posterPath} alt="poster.png" />
                    </Link>
            </div>
            ))
        }
    </div>
  )
}

export default MovieCard