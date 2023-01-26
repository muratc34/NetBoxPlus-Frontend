import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import Button, { OutlineButton } from '../button/Button';
import logo from '../../assets/netboxplus-logo.png';

import './signin-form.scss';
// import authApi from '../../api/modules/auth.api';
import axios from 'axios';


const SigninForm = () => {
  const [email, setEmail] = useState()
  const [password, setPassword] = useState()

  async function login(){
    
    const response  = await axios.post("https://localhost:44332/api/Auth/login",{
      email: email,
      password: password
    });
    if (response.data)
    {
      localStorage.setItem("token", response.data.token)
      window.location.reload(true);
    }
  }
  

  return (
    <div className="login-wrapper">
      <div className="logo">
          <Link to="/"><img src={logo} alt="logo.png"/></Link>
        </div>

      <h1>Giriş Yap</h1>
      <form className='login-form'>
        <div className='input-wrap'>
          <label className='signin-input-text'>E-posta</label>
          <input  onChange={(e)=>setEmail(e.target.value)}  className='signin-input' type="email"/>
        </div>
        <div className='input-wrap'>
          <label className='signin-input-text'>Şifre</label>
          <input onChange={(e)=>setPassword(e.target.value)} className='signin-input' type="password" />
        </div>  
        <div className='login-btn'>
          <Link to="/"><Button onClick={()=> login()}>Giriş Yap</Button></Link>
          
          <Link to="/register"><OutlineButton>Kayıt ol</OutlineButton></Link>
        </div>
      </form>
    </div>
  )
}

export const SignupForm = () => {
  const [firstName, setFirstName] = useState()
  const [lastName, setLastName] = useState()
  const [email, setEmail] = useState()
  const [password, setPassword] = useState()

  async function register(){
    
    const response  = await axios.post("https://localhost:44332/api/Auth/register",{
      firstName: firstName,
      lastName: lastName,
      email: email,
      password: password
    });
    if (response.data)
    {
      localStorage.setItem("token", response.token)
      window.location.reload(true);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="logo">
          <Link to="/"><img src={logo} alt="logo.png"/></Link>
        </div>

      <h1>Kayıt ol</h1>
      <form className='login-form'>
      <div className='input-wrap'>
          <label className='signin-input-text'>Ad</label>
          <input onChange={(e)=>setFirstName(e.target.value)} className='signin-input' type="text"/>
        </div>
        <div className='input-wrap'>
          <label className='signin-input-text'>Soyad</label>
          <input onChange={(e)=>setLastName(e.target.value)} className='signin-input' type="text"/>
        </div>
        <div className='input-wrap'>
          <label className='signin-input-text'>E-posta</label>
          <input onChange={(e)=>setEmail(e.target.value)} className='signin-input' type="email"/>
        </div>
        <div className='input-wrap'>
        <label className='signin-input-text'>Şifre</label>
          <input onChange={(e)=>setPassword(e.target.value)}  className='signin-input' type="password" />
        </div>  
        <div className='login-btn'>
          <Link to="/"><Button onClick={()=> register()}>Kayıt ol</Button></Link>
          <Link to="/login"><OutlineButton>Giriş Yap</OutlineButton></Link>
        </div>
      </form>
    </div>
  )
}

export default SigninForm