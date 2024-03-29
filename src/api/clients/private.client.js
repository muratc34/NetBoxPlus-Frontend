import axios from "axios"
import queryString from "query-string"
import config from "../configs/config";

const baseURL = config.baseURL;

const privateClient = axios.create({
    baseURL,
    paramsSerializer: {
        encode: params => queryString.stringify(params)
    }
})

privateClient.interceptors.request(async config =>{
    return {
        ...config,
        headers:{
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
    }
})

privateClient.interceptors.response.use((response) =>{
    if(response && response.data) return response.data;
    return response;
}, (err) =>{
    throw err.response.data;
});

export default privateClient;