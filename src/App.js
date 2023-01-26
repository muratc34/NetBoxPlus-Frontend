import 'swiper/swiper.min.css';
import './App.scss';

import { BrowserRouter } from 'react-router-dom';


import PageRoutes from './config/PageRoutes';


function App() {
  
  return (
    <BrowserRouter>
        <PageRoutes/>
    </BrowserRouter>
  );
}

export default App;