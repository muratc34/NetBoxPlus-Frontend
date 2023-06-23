import React from 'react';
import { useRef, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './header.scss';
import {FaHome, FaUserCircle} from 'react-icons/fa'
import {HiSearch} from 'react-icons/hi'
import {TbMovie} from 'react-icons/tb'
import logo from '../../assets/netboxplus-logo.svg';
import Button from '../button/Button';
import {  useAuth } from '../../context/AuthContext';
import jwtDecode from 'jwt-decode';
import movieApi from '../../api/modules/movie.api';
import Loader from '../loader/Loader';
import config from '../../api/configs/config';

const headerNav = [
  {
    display: 'Ana Sayfa',
    path:'/browse',
    icon:<FaHome className='header-icons'></FaHome>
  },
  {
    display: 'Filmler',
    path:'/browse/movies',
    icon:<TbMovie className='header-icons'></TbMovie>
  }
];

const Header = () => {

  const {pathname} = useLocation();
  const headerRef = useRef(null);
  const navigate = useNavigate()

  const {logout} = useAuth()

  const active =  headerNav.findIndex(e => e.path === pathname);

  function handleLogout()
  {
    logout();
    navigate("/");
  }

  useEffect(() => {
    const shrinkHeader = () => {
        if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
            headerRef.current.classList.add('shrink');
        } else {
            headerRef.current.classList.remove('shrink');
        }
    }
    window.addEventListener('scroll', shrinkHeader);
    return () => {
        window.removeEventListener('scroll', shrinkHeader);
    };
}, []);

  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };
  var token = localStorage.getItem("token");
  var decoded = jwtDecode(token);
  

  return (
    <div ref={headerRef} className='header'>
      <div className="header-wrap container">
        <div className="logo">
          <Link to="/"><img src={logo} alt="logo.png"/></Link>
        </div>
        <ul className='header-nav'>
          <li className='header-search'>
            <div>
              <SearchBar/>
            </div>
          </li>

          {
            headerNav.map((e,i)=>(
              <li key= {i} className={`nav-element ${i === active ? 'active': ''}`}>
                {e.icon}
                <Link to={e.path}>
                  {e.display}
                </Link>
              </li>
            ))
          }
          <li className='logout'>
            <div className="logout-dropdown">
              <div className='logout-dropdown-toggle' onClick={toggleMenu}>
                <FaUserCircle className='header-icons'/>
                <span>{decoded.Name}</span>
              </div>
            {isOpen && (
              <ul className="logout-dropdown-menu">
                <li onClick={()=> navigate("/account")}>Hesap Ayarları</li>
                <li onClick={()=> handleLogout()}>Çıkış Yap</li>
              </ul>
            )}
            </div>
            {/* <Button >Çıkış</Button> */}
          </li>
        </ul>
      </div>
    </div>
  );
}

const SearchBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [movies, setMovies] = useState([]);
  const [response, setResponse] = useState();

  const search = async (keyword) => {
    if (keyword !== null && keyword.trim() !== ''){
      await movieApi.search(keyword)
        .then(({response})=>{
          setMovies(response.data);
          setResponse(response.success);
        });
    }
  }

  useEffect(() => {
    search(searchTerm);
  }, [searchTerm])
  

  const toggleSearchBar = () => {
    setIsOpen(!isOpen);
    setSearchTerm('');
    setMovies([]);
  };

  return (
    <div className="search-bar">
      <div className={`search-bar-input ${isOpen ? 'open' : ''}`}>
        <input
          className='search-bar-input-field'
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            if (e.target.value === '') {
              setMovies([]);
            }
          }}
          placeholder="Arama yapın..."
        />
        {movies.length > 0 && (
          <div className="search-results">
            {response ? (
              movies?.map((movie, i) => (
                <div key={i}>
                  <Link to={"/movie/"+ movie.id}>
                    <div className="search-results-item">
                      <img className='search-results-item-img' src={config.baseURL + movie.posterPath } alt="" />
                      <span className='search-results-item-title'>{movie.title}</span>
                      <span className='search-results-item-info'>{movie.releaseYear}</span>
                    </div>
                  </Link>
                </div>
              ))):(
                <Loader/>
              )}
          </div>
        )}
      </div>
      <div className='search-bar-text' onClick={toggleSearchBar}>
        <HiSearch className='header-icons' />
        <span>İçerik Ara</span>
      </div>
    </div>
  );
};

export const WelcomeHeader = () => {

  const headerRef = useRef(null);

  useEffect(() => {
    const shrinkHeader = () => {
        if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
            headerRef.current.classList.add('shrink');
        } else {
            headerRef.current.classList.remove('shrink');
        }
    }
    window.addEventListener('scroll', shrinkHeader);
    return () => {
        window.removeEventListener('scroll', shrinkHeader);
    };
}, []);
  

  return (
    <div ref={headerRef} className='header'>
      <div className="header-wrap container">
        <div className="logo">
          <Link to="/"><img src={logo} alt="logo.png"/></Link>
        </div>
        <ul className='header-nav2'>
          {
            <li>
              <Link to="/login">
                <Button>Oturum Aç</Button>
              </Link>
            </li>
          }
        </ul>
      </div>
    </div>
  );
}

export const PaymentHeader = () =>
{
  return(
    <div>
      <div className="payment-logo">
        <img src={logo} alt="logo.png"/>
      </div>
    </div>
  )
}

  export default Header;

