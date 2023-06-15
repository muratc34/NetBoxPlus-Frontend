import React, { createContext, useState } from "react";
import authApi from "../api/modules/auth.api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthed, setIsAuthed] = useState(null)

  const login = async (email, password) => {
    
    const response = await authApi.login({
      email: email,
      password: password
    })

    if(response.success){
      const { token } = response.data;
      localStorage.setItem('token', token);
      setIsAuthed(true)
    }

    return response;
  };
  
  const register = async (email, password, firstName, lastName) =>{

    const response = await authApi.register({
      firstName: firstName,
      lastName: lastName,
      email: email,
      password: password
    })

    if(response.success){
      const { token } = response.data;
      localStorage.setItem('token', token);
      setIsAuthed(true);
    }

    return response
  }

  const logout = () => {
    setIsAuthed(false);
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{isAuthed, login, register, logout}}>
      {children}
    </AuthContext.Provider>
  );
};