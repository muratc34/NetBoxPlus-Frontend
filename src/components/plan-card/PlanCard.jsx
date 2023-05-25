import React from 'react';
import './plan-card.scss';
import Button from '../button/Button';
import {SlBasket} from 'react-icons/sl'
import { Link} from 'react-router-dom';

const PlanCard = ({planName, amount, profilPiece, quality}) => {

  return (
    <div className='plan-card'>
        <div className='plan-card-header'>
            <h2 className='plan-card-header-title'>{planName}</h2>
            <h1 className='plan-card-header-amount'>{amount} ₺</h1>
        </div>
        <div className='plan-card-options'>
            <ul className='plan-card-options-list'>
                <li className='plan-card-options-list-item'>30 gün kullanım süresi</li>
                <li className='plan-card-options-list-item'>{profilPiece} adet profil</li>
                <li className='plan-card-options-list-item'>{quality} video kalitesi</li>
            </ul>
        </div>
        <div className='plan-card-btn'>
            <Link className='plan-card-btn-link' to="1" state={{planName, amount, profilPiece, quality}}>
                <Button className="w100">
                    <SlBasket className='plan-card-btn-icon'/>
                </Button>
            </Link>
        </div>
    </div>
  )
}

export const PaymentPlan = ({planName, amount, profilPiece, quality}) =>{
    return(
        <div>
            <div className='cc-pc container'>
                <div className='cc-pc-content'>
                    <div className='cc-pc-content-header'>
                        <h2 className='cc-pc-content-header-title'>{planName}</h2>
                    </div>
                    <div className='cc-pc-content-options'>
                        <ul className='cc-pc-content-options-list'>
                            <li className='cc-pc-content-options-list-item'>30 gün kullanım süresi</li>
                            <li className='cc-pc-content-options-list-item'>{profilPiece} adet profil</li>
                            <li className='cc-pc-content-options-list-item'>{quality} video kalitesi</li>
                        </ul>
                    </div>
                </div>
                <div className='cc-pc-amount'>
                    <h1 className='cc-pc-amount-txt'>{amount} ₺</h1>
                </div>
            </div>
        </div>
    )
}

export const Plan = () =>{
    return(
        <div className='container plan'>
            <PlanCard planName={"Temel Paket"} amount={"39.99"} profilPiece={"1"} quality={"HD"} />
            <PlanCard planName={"Gelişmiş Paket"} amount={"64.99"} profilPiece={"2"} quality={"FHD"} />
            <PlanCard planName={"Lüks Paket"} amount={"99.99"} profilPiece={"3"} quality={"UHD"} />
        </div>
    )
}

export default PlanCard