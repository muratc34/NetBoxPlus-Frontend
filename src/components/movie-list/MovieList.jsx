import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { SwiperSlide, Swiper } from 'swiper/react';
import MovieContext from '../../context/MovieContext';
import config from '../../api/configs/config';
import { OutlineButton } from '../button/Button';

import './movie-list.scss';
const MostViewed = () => {

    const movies = useContext(MovieContext)
    
  return (
    <div className="section mb-3">
        <div className="section-header mb-2">
          <h2>En Çok İzlenenler</h2>
          <Link to="/movie">
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
  )
}

export const RecentlyAdded = () => {

  const movies = useContext(MovieContext)
  
return (
  <div className="container-header">
    <div className="section mb-3">
      <div className="section-header mb-2">
        <h2>En Son Eklenenler</h2>
        <Link to="/movie">
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

export default MostViewed