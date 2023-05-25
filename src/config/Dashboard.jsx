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

const Dashboard = () => {
  return (
    <Routes>
        <Route
        path='/'
        exact
        element={<Home/>}
        />
        <Route 
            path='browse/' 
            element={<Catalog />}
        />
        <Route 
            path='movie/:id'
            element={<Detail />}
        />
        <Route
            path='login'
            exact
            element={<Login/>}
        />
        <Route
            path='register'
            exact
            element={<Register/>}
        />
        <Route 
            path='watch/:id' 
            element={<Watch/>}
        />
        <Route
            path='account'
            element={<Account/>}
        />
        <Route
            path='payment/*'
            element={<PaymentDashboard/>}
        />
    </Routes>
  )
}

export default Dashboard;