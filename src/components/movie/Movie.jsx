import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import config from '../../api/configs/config';
import movieApi from '../../api/modules/movie.api';
import Button from '../button/Button';
import './movie.scss';
import Loader from '../loader/Loader';
import NbpTrailerPlayer from '../video-player/NbpTrailerPlayer';
import { SimilarityByGenre } from '../movie-list/MovieList';

const Movie = () => {
    const [movie, setMovie] = useState([]);
    const [response, setResponse] = useState([])
    const {id} = useParams();
    
    useEffect(() => {
      const getMovie = async () => {
        await movieApi.getMovie(id)
        .then(({response})=>{
          setResponse(response);
          setMovie(response.data);
        });
      };
        getMovie()
    },[id]);
    
  return (
    <div>
      {
        response.success === true ? 
        (
          <div className='movie'>
            <NbpTrailerPlayer videoSrc={config.baseURL + movie.trailerPath} poster={config.baseURL + movie.backdropPicPath}/>
             <div className='movie-content container'>
              <h1 className='movie-title'>{movie.title}</h1>
              <div className='movie-content-ryear-pg'>
                <h3 className='movie-pg'>{movie.ageRating.rating}</h3>
                <span>•</span>
                <h3 className='movie-ryear'>{movie.releaseYear}</h3>
              </div>
              <Link to={"/watch/" + movie.movieId}><Button className="movie-content-btn">Şimdi İzle</Button></Link>
              <div className='movie-genres'>
                {movie.genres?.map((item, i) => (
                  <div key={i}>
                    <Link to={'/' + item.genreTitle} className='movie-genres-link'>
                      <span className='movie-genres-item'>{item.genreTitle}</span>
                    </Link>
                    <span className='movie-genres-dot'>•</span>
                  </div>
                ))}
              </div>
              <p className='movie-description'>{movie.movieDescription}</p>
            </div>
            <div className='movie-wrapper'>
            </div>
          </div>
        ) :
        (
          <Loader/>
        )
        
      }
      <div>
        <SimilarityByGenre genreIds={movie.genres} movieId={movie.movieId}/>
      </div>
    </div>
  )
}

export default Movie