import React from 'react'
import { WelcomeHeader } from '../components/header/Header'
import MainWelcome from '../components/main-welcome/MainWelcome'
import Footer from '../components/footer/Footer'

const Welcome = () => {
  return (
    <div>
        <WelcomeHeader/>
        <MainWelcome/>
        <Footer/>
    </div>
  )
}

export default Welcome