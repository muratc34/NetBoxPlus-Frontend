import React, { useEffect, useState } from 'react';
import "./movie-card.scss";
import config from '../../api/configs/config';
import { Link } from 'react-router-dom';
import movieApi, { genreApi } from '../../api/modules/movie.api';
import { OutlineButton } from '../button/Button';

const MovieCard = () => {
  const [genres, setGenres] = useState();
  const [selectedGenre, setSelectedGenre] = useState();
  const [movies, setMovies] = useState();

  useEffect(() => {
    const getGenres = async () =>{
      await genreApi.getList()
      .then(({response}) =>{
        const sortedData = [...response.data].sort((a, b) => a.genreTitle.localeCompare(b.genreTitle));
        setGenres(sortedData)
      })
    }
    getGenres();
  }, [])

  const handleGenre = (index) =>{
    const selectedItem = genres[index];

    if (selectedGenre === selectedItem) {
      // Seçili butona tekrar tıklandığında seçimi sıfırla
      setSelectedGenre(null);
    } else {
      // Yeni bir butona tıklandığında seçimi güncelle
      setSelectedGenre(selectedItem);
    }
  }

  const getByGenre = async (genreId) =>
  {
    const {response} = await movieApi.getByGenre(genreId)
    if (response.success) {
      setMovies(response.data);
    }
  }

  useEffect(() => {
    getByGenre(selectedGenre ? selectedGenre.id : selectedGenre)
  }, [selectedGenre])
    
  return (
    <div className='container-mt-5'>
     <div className='movies-header'>
      <div className='movies-header-title'>
          <h1 className='movies-header-title-text'>Filmler</h1>
      </div>
      <div className='genres'>
        <ul className='genres-list'>
          {
            genres?.map((item,i) => (
              <li key={i} className='genres-list-item' onClick={() => handleGenre(i)}>
                <OutlineButton className={`${selectedGenre === item ? 'selected-btn': ''}`}>{item.genreTitle}</OutlineButton>
              </li>
            ))
          }
        </ul>
      </div>
     </div>
      <div className="grid">
        <div className="grid-outer">
          <div className="grid-inner">
            {
              movies?.map((item, i) => (
              <div key={i} className='movie-card-poster'>
                <Link to={`/movie/${item.movieId}`}>
                  <img className='movie-card-img' src={config.baseURL + item.posterPath} alt="poster.png" />
                </Link>
              </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}

export default MovieCard