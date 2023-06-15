import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import Button from '../button/Button';
import logo from '../../assets/netboxplus-logo.png';

import './signin-signup-form.scss';
import 'react-toastify/dist/ReactToastify.css';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';

const SigninForm = () => {
  const [email, setEmail] = useState()
  const [password, setPassword] = useState()

  const navigate = useNavigate()

  const {login} = useContext(AuthContext)

  async function handleLogin(e){
    e.preventDefault();
    
    const response = await login(email, password);
    if(response.success){
      toast.success("Giriş işlemi başarılı!")
      setTimeout(() => {
        navigate("/browse")
      }, 2000);
    }
    else
    {
      if(email == null || password == null)
        toast.error("Email veya Şifre alanı boş bırakılamaz!")
      else
        toast.error(response.message)
    }
  }

  return (
    <div className="sign-wrapper">
      <div className='sign-modal'>
        <div className="logo sign-form-logo">
            <Link to="/"><img src={logo} alt="logo.png"/></Link>
        </div>
        <h1 className='sign-form-title'>Giriş Yap</h1>
        <form className='sign-form'>
          <div className='input-wrap'>
            <label className='form-input-text'>E-posta</label>
            <input required onChange={(e)=>setEmail(e.target.value)} className='form-input' type="email" name='email'/>
          </div>
          <div className='input-wrap'>
            <label className='form-input-text'>Şifre</label>
            <input required onChange={(e)=>setPassword(e.target.value)} className='form-input' type="password" name='password' />
          </div>  
          <div className='input-wrap-link'>
            <label className='form-input-text'>
              <span className='register-logo'>
                <span className='register-logo-text'>Net</span>Box+
              </span> 'da yeni misiniz? 
              <Link className='link' to="/register" state={{from: {email}}} > Kayıt Ol </Link></label>
          </div>
          <div className='sign-btn'>
            <Button onClick={(e)=> handleLogin(e)}>Giriş Yap</Button>
            <ToastContainer 
              position="bottom-center"
              autoClose={1000}
              hideProgressBar={true}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="dark"/>
          </div>
        </form>
      </div>
    </div>
  )
}

export const SignupForm = () => {
  
  const navigate = useNavigate()
  const location = useLocation()
  const { from } = location.state
  
  const [email, setEmail] = useState(" ")
  const [firstName, setFirstName] = useState()
  const [lastName, setLastName] = useState()
  const [password, setPassword] = useState()

  const {register} = useContext(AuthContext)

  async function handleRegister(e){
    e.preventDefault();
    const response = await register(email, password, firstName, lastName)
    if(response.success){
      toast.success("Kayıt işlemi başarılı!")
      setTimeout(() => {
        navigate("/payment")
      }, 2000);
    }
    else
    {
      toast.error(response.message)
    }
  }

  useEffect(() => {
    if (from.email) {
      setEmail(from.email)
    }
  }, [from.email])
  

  return (
    <div className="sign-wrapper">
      <div className="sign-modal">
        <div className="logo sign-form-logo">
          <Link to="/"><img src={logo} alt="logo.png"/></Link>
        </div>
        <h1 className='sign-form-title'>Kayıt ol</h1>
        <form className='sign-form'>
          <div className='input-wrap'>
            <label className='form-input-text'>Ad</label>
            <input onChange={(e)=>setFirstName(e.target.value)} className='form-input' type="text" required/>
          </div>
          <div className='input-wrap'>
            <label className='form-input-text'>Soyad</label>
            <input onChange={(e)=>setLastName(e.target.value)} className='form-input' type="text" required/>
          </div>
          <div className='input-wrap'>
            <label className='form-input-text'>E-posta</label>
            <input value={email} onChange={(e)=>setEmail(e.target.value)} className='form-input' type="email" required/>
          </div>
          <div className='input-wrap'>
            <label className='form-input-text'>Şifre</label>
            <input onChange={(e)=>setPassword(e.target.value)} className='form-input' type="password"/>
          </div>  
          <div className='input-wrap-link'>
            <label className='form-input-text'>Zaten kayıtlı mısınız? <Link className='link' to="/login"> Giriş Yap</Link></label>
          </div>
          <div className='sign-btn'>
            <Button onClick={(e)=> handleRegister(e)}>Kayıt ol</Button>
            <ToastContainer 
              position="bottom-center"
              autoClose={1000}
              hideProgressBar={true}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="dark"/>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SigninForm