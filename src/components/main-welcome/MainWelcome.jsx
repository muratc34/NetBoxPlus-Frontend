import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import Button from '../button/Button';
import logo from '../../assets/netboxplus-logo.png';
import './main-welcome.scss';

const MainWelcome = () => {
    const [registerEmail, setRegisterEmail] = useState()
  return (
    <div className="container">
        <div className="section">
            <div className='welcome'>
                <p className='welcome-title'>Sınırsız film keyfi 
                    <img className='welcome-logo' src={logo} alt="logo.png"/>'da.
                </p>
                <p className='welcome-text'>Üye olmak için e-postanı gir.</p>
                <form className='form'>
                    <input onChange={(e)=> setRegisterEmail(e.target.value)} className='email-input' type="email" placeholder='E-Posta'/>
                    <Link to="/register"><Button onClick={localStorage.setItem("registerEmail", registerEmail)}>Devam Et</Button></Link>
                </form>
                <div>
                </div>
            </div>
        </div>
    </div>
  )
}

export default MainWelcome