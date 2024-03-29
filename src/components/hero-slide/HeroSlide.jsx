import React from 'react';
import { useNavigate } from 'react-router';
import { useContext } from 'react';
import SwiperCore, { Autoplay } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import Button, { OutlineButton } from '../button/Button';
import MovieContext from '../../context/MovieContext';
import config from '../../api/configs/config';

import './hero-slide.scss';

const HeroSlide = () => {

  SwiperCore.use([Autoplay]);

  const movies = useContext(MovieContext)
  const fiveMovies = []
  
  while(fiveMovies.length < 5)
  {
    var x = movies[Math.floor(Math.random() * movies.length)]
    if(fiveMovies.indexOf(x) === -1) fiveMovies.push(x)
  }
    
        
  return (
    <div className='hero-slide'>
        <Swiper
          modules={[Autoplay]}
          grabCursor={true}
          spaceBetween={0}
          slidesPerView={1}
          autoPlay={{delay: 3000}}
        >
          {
            fiveMovies?.map((item, i) =>(
              <SwiperSlide key={i}>
                {({isActive}) =>(
                  <HeroSlideItem item={item} className={`${isActive ? 'active': ''}`}/>
                )}
              </SwiperSlide>
            ))
          }
        </Swiper>
    </div>
  );
}

const HeroSlideItem = props => {
  const navigate = useNavigate()
  
  const item = props.item;

  const background = config.baseURL + item.backdropPicPath;

  return(
    <div className={`hero-slide-item ${props.className}`}
         style={{backgroundImage: `url(${background})`}}
    >
      <div className='hero-slide-item-wrapper'></div>
      <div className="hero-slide-item-content container-mt-5">
        <div className="hero-slide-item-content-info">
          <h2 className="title">{item.title}</h2>
          <div className="description">{item.movieDescription}</div>
          <div className="btns">
            <Button className="watch-btn" onClick={()=> navigate('/watch/'+ item.movieId)}>
              Şimdi İzle
            </Button>

            <OutlineButton className="info-btn" onClick={()=> navigate('/movie/'+ item.movieId)}>
              Daha Fazla Bilgi
            </OutlineButton>
          </div>
        </div>
        <div className='hero-slide-item-content-poster'>
          <img src={config.baseURL + item.posterPath} alt="" />
        </div>
      </div>
    </div>
  )
}

export default HeroSlide;