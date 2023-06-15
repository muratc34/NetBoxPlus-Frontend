import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const GuardedRoute = () => {
  const {isAuthed} = useContext(AuthContext);

  return isAuthed ? (
    <Outlet/>
  ) : (
    <Navigate to="/login" replace />
  );
};

export const GuardedRouteForMain = () => {
  const {isAuthed} = useContext(AuthContext);

  return isAuthed ? (
    <Navigate to="/browse" replace />
  ) : (
    <Outlet/>
  );
}


export default GuardedRoute;