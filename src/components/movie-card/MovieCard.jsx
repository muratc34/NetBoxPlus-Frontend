import React, { useContext } from 'react';
import "./movie-card.scss";
import MovieContext from '../../context/MovieContext';
import config from '../../api/configs/config';
import { Link } from 'react-router-dom';

const MovieCard = () => {
    
    const movies = useContext(MovieContext)
    
  return (
    <div className='container-mt-5'>
      <div className="grid">
        <div className="grid-outer-grid">
          <div className="grid-inner-grid">
            {
              movies?.map((item, i) => (
              <div key={i} className='movie-card-poster'>
                <Link to={`/movie/${item.id}`}>
                  <img className='movie-card-img' src={config.baseURL + item.posterPath} alt="poster.png" />
                </Link>
              </div>
              ))
            }
          </div>
        </div>
      </div>
      <div>
        
      </div>

    </div>
  )
}

export default MovieCard