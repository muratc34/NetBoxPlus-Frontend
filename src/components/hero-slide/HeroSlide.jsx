import React, { useState, useEffect, useRef  } from 'react';

import SwiperCore, { Autoplay } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";

import Button, { OutlineButton } from '../button/Button';
import Modal, { ModalContent } from '../modal/Modal';

// import movieApi from '../../api/modules/movie.api';
import config from '../../api/configs/config';

import './hero-slide.scss';
import { useNavigate } from 'react-router';
import axios from 'axios';



const HeroSlide = () => {

  SwiperCore.use([Autoplay]);

  const [movies, setMovies] = useState([]);

  // const getMovies= async () => {
  //     const { response } = await movieApi.getList();
  //     if (response) setMovies(response.data);
  // };
    
  const getMovies = async () => {
    const {data} = await axios.get("https://localhost:44372/api/movies")
    if(data) setMovies(data.data)
  }

  useEffect(() => {
    getMovies();
  },[]);
        
  return (
    <div className='hero-slide'>
        <Swiper
          modules={[Autoplay]}
          grabCursor={true}
          spaceBetween={0}
          slidesPerView={1}
          autoplay={{delay: 5000}}
        >
          {
            movies?.map((item, i) =>(
              <SwiperSlide key={i}>
                {({isActive}) =>(
                  <HeroSlideItem item={item} className={`${isActive ? 'active': ''}`}/>
                )}
              </SwiperSlide>
            ))
          }
        </Swiper>
        {
          movies?.map((item, i) => <TrailerModal key={i} item={item}/>)
        }
    </div>
  );
}

const HeroSlideItem = props => {
  const navigate = useNavigate()
  
  const item = props.item;

  const background = config.baseURL + item.backdropPicPath;

  const setModalActive = async () =>{
    const modal = document.querySelector(`#modal-${item.id}`);

    const videoSrc = config.baseURL + item.trailerPath;
    modal.querySelector('.modal-content > iframe').setAttribute('src', videoSrc);
    modal.classList.toggle('active');
  }

  return(
    <div className={`hero-slide-item ${props.className}`}
         style={{backgroundImage: `url(${background})`}}
    >
      <div className="hero-slide-item-content container">
        <div className="hero-slide-item-content-info">
          <h2 className="title">{item.title}</h2>
          <div className="description">{item.movieDescription}</div>
          <div className="btns">
            <Button onClick={()=> navigate('/movie/'+ item.id)}>
              Şimdi İzle
            </Button>

            <OutlineButton onClick={setModalActive}>
              Fragmanı İzle
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

const TrailerModal = props => {
  const item = props.item;

  const iframeRef = useRef(null);

  const onClose = () => iframeRef.current.setAttribute('src', '');

  return(
    <Modal active={false} id={`modal-${item.id}`}>
      <ModalContent onClose={onClose}>
        <iframe ref={iframeRef} width="100%" height="500px" title="trailer"></iframe>
      </ModalContent>
    </Modal>
  )
}

export default HeroSlide;