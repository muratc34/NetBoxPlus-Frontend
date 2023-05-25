import 'swiper/swiper.min.css';
import './App.scss';

import { BrowserRouter } from 'react-router-dom';
import Dashboard from './config/Dashboard';


function App() {
  
  return (
    <BrowserRouter>
        <Dashboard/>
    </BrowserRouter>
  );
}

export default App;