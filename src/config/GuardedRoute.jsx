import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
// import {  useAuth } from '../context/AuthContext';

const GuardedRoute = () => {
  // const {isAuthed} = useAuth();

  return localStorage.getItem("token") ? (
    <Outlet/>
  ) : (
    <Navigate to="/login" replace />
  );
};

export const GuardedRouteForMain = () => {
  // const {isAuthed} = useAuth();

  return localStorage.getItem("token") ? (
    <Navigate to="/browse" replace />
  ) : (
    <Outlet/>
  );
}

export default GuardedRoute;