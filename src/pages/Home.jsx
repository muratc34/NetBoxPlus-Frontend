import React from 'react'
import { Link } from 'react-router-dom';

import HeroSlide from '../components/hero-slide/HeroSlide';
import { OutlineButton } from '../components/button/Button';
import MovieList from '../components/movie-list/MovieList';
import Footer from '../components/footer/Footer';
import Header from '../components/header/Header';

const Home = () => {
  
  return (
    <div>
        <div>
          <Header/>
          <HeroSlide/>
          <div className="container">
            <div className="section mb-3">
              <div className="section-header mb-2">
                <h2>En Çok İzlenenler</h2>
                <Link to="/movie">
                  <OutlineButton className="small">Daha fazla</OutlineButton>
                </Link>
              </div>
              <MovieList/>
            </div>
          </div>
        <Footer/>
        </div>
    </div>
  )
}

export default Home;