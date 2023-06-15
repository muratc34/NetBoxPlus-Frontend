import React from 'react'
import './payment-complete.scss';
import {BsDownload} from 'react-icons/bs'
import { Link } from 'react-router-dom';
import Button from '../button/Button';
import invoicePDf from '../../assets/sample-invoice.pdf';

const PaymentComplete = () => {
  return (
    <div className='payment-complete'>
        <div className='payment-complete-header'>
            <h1 className='payment-complete-header-title'>Ödeme Başarılı!</h1>
        </div>
        <div className='payment-complete-body'>
            <div className='payment-complete-body-top'>
                <a href={invoicePDf} download>
                    <BsDownload/>
                    <span className='payment-complete-body-top-text'>E-Fatura indir</span>
                </a>
            </div>
            <div className="payment-complete-body-bottom">
                <Link to={"/"}>
                    <Button>Ana Sayfa</Button>
                </Link>
            </div>
        </div>
    </div>
  )
}

export default PaymentComplete