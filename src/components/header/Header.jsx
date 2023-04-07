import React from 'react';
import { useRef, useEffect } from 'react';

import { Link, useLocation, useNavigate } from 'react-router-dom';

import './header.scss';

import logo from '../../assets/netboxplus-logo.svg';
import Button from '../button/Button';

const headerNav = [
  {
    display: 'Ana Sayfa',
    path:'/'
  },
  {
    display: 'Filmler',
    path:'/browse'
  },
  {
    display: 'Hesap',
    path:'/account'
  }
];

const Header = () => {

  const {pathname} = useLocation();
  const headerRef = useRef(null);
  const navigate = useNavigate();

  const active =  headerNav.findIndex(e => e.path === pathname);

  function logout()
  {
    localStorage.removeItem("token"); 
    navigate("/");
    window.location.reload(true);
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
  

  return (
    <div ref={headerRef} className='header'>
      <div className="header-wrap container">
        <div className="logo">
          <Link to="/"><img src={logo} alt="logo.png"/></Link>
        </div>
        <ul className='header-nav'>
          {
            headerNav.map((e,i)=>(
              <li key= {i} className={`nav-element ${i === active ? 'active': ''}`}>
                <Link to={e.path}>
                  {e.display}
                </Link>
              </li>
            ))
          }
          <li className='logout'>
            <Button onClick={()=> logout()}>Çıkış</Button>
          </li>
        </ul>
      </div>
    </div>
  );
}

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


  export default Header;

