import React from 'react'
import { PaymentHeader } from '../components/header/Header'
import { PaymentFooter } from '../components/footer/Footer'
import Steps from '../components/steps/Steps'

const Payment = ({element, step}) => {
  return (
    <div>
        <PaymentHeader/>
        <Steps step={step}/>
        {element}
        <PaymentFooter/>
    </div>
  )
}

export default Payment