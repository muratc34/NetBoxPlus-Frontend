import React from 'react'
import { createContext } from 'react';
import { useState } from 'react';

const MovieContext = createContext();

export const MovieProvider = ({ children }) =>{
    const [movies] = useState([])
    
    return (
        <MovieContext.Provider value={movies}>
            {children}
        </MovieContext.Provider>
    )
}

export default MovieContext