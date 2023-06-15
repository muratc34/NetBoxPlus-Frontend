import React, { createContext, useState } from 'react'


const UserContext = createContext()

export const UserProvider = ({children}) =>{
    const [user] = useState();

    return (
        <UserContext.Provider value={user}>
            {children}
        </UserContext.Provider>
    )
}

export default UserContext