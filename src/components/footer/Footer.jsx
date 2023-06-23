import React from 'react';

import './footer.scss';

import { Link } from 'react-router-dom';

import logo from '../../assets/netboxplus-logo.png';

const Footer = () => {
    return (
        <div className="footer">
            <div className="footer-content container">
                <hr className='footer-line'/>
                <div className="footer-content-logo">
                    <div className="logo">
                        <Link to="/"><img src={logo} alt="" /></Link>
                    </div>
                </div>
                <div className='footer-content-menu'>
                    <ul className="footer-content-menu-list">
                        <li><Link to="/">Bize ulaşın</Link></li>
                        <li><Link to="/">Hizmet Şartları</Link></li>
                        <li><Link to="/">Hakkımızda</Link></li>
                        <li><Link to="/">Yardım</Link></li>
                        <li><Link to="/">Gizlilik politikası</Link></li>
                    </ul>
                </div>
                <div className='copyright'>
                    ©<span className='copyright-logo'><span className='copyright-logo-text'> Net</span>Box+ </span>2023. Tüm hakları saklıdır.
                </div>
            </div>
        </div>
    );
}

export const PaymentFooter = () =>
{
    return(
        <div className='payment-footer'>
            <div className="payment-logo footer-logo">
                <img src={logo} alt="" />
            </div>
            <div className='copyright'>
                ©<span className='copyright-logo'><span className='copyright-logo-text'> Net</span>Box+ </span>2023. Tüm hakları saklıdır.
            </div>
        </div>
    )
}

export default Footer;