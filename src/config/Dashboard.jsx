import React from 'react';

import {Route, Routes } from 'react-router-dom';

import Home from '../pages/Home';
import Catalog from '../pages/Catalog';
import Detail from '../pages/Detail';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Watch from '../pages/Watch';
import Account from '../pages/Account';
import PaymentDashboard from './PaymentDashboard';
import GuardedRoute, { GuardedRouteForMain } from './GuardedRoute';
import Welcome from '../pages/Welcome';

const Dashboard = () => {
  return (
    <Routes>
      <Route element={<GuardedRouteForMain />}>
        <Route path='/' exact element={<Welcome/>}/>
      </Route>
      <Route path='login' exact element={<Login/>}/>
      <Route path='register' exact element={<Register/>}/>
      <Route element={<GuardedRoute/>}>
        <Route path='browse/' element={<Home/>}/>
        <Route path='browse/movies' element={<Catalog/>}/>
        <Route path='movie/:id' element={<Detail />}/>
        <Route path='watch/:id' element={<Watch/>}/>
        <Route path='account' element={<Account/>}/>
        <Route path='payment/*' element={<PaymentDashboard/>}/>
      </Route>
    </Routes>
  )
}

export default Dashboard;