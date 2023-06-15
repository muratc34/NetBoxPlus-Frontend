import React from 'react';
import {Route, Routes } from 'react-router-dom';
import Payment from '../pages/Payment';
import { Plan } from '../components/plan-card/PlanCard';
import CreditCardForm from '../components/credit-card-form/CreditCardForm';
import PaymentComplete from '../components/payment-complete/PaymentComplete';

const PaymentDashboard = () => {
  return (
    <Routes>
        <Route path='/' exact element={<Payment element={<Plan/>}/>}/>
        <Route path='/:id' exact element={<Payment element={<CreditCardForm/>} step={"plan"}/>}/>
        <Route path='/complete' exact element={<Payment element={<PaymentComplete/>} step={"done"}/>}/>
    </Routes>
  )
}

export default PaymentDashboard