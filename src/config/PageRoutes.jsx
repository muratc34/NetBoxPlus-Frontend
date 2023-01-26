import React from 'react';

import {Route, Routes } from 'react-router-dom';

import Home from '../pages/Home';
import Catalog from '../pages/Catalog';
import Detail from '../pages/Detail';
import Main from '../pages/Main';
import Login from '../pages/Login';
import Register from '../pages/Register';

const PageRoutes = () => {
  return (
    <Routes>
        <Route 
            path='browse/search/:id' 
            element={<Catalog />}
        />
        <Route 
            path='movie/id'
            element={<Detail />}
        />
        {
            localStorage.getItem("token") ? 
            <Route
            path='/'
            exact
            element={<Home/>}/>
            :
            <Route 
            path='/'
            exact
            element={<Main />}/>
        }
        
        
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
    </Routes>
  )
}

export default PageRoutes;