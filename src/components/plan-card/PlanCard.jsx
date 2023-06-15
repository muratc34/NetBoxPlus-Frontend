import React from 'react';
import './plan-card.scss';
import Button from '../button/Button';
import {SlBasket} from 'react-icons/sl'
import { Link} from 'react-router-dom';
import { planApi } from '../../api/modules/subscription.api';
import { useState } from 'react';
import { useEffect } from 'react';
import Loader from '../loader/Loader';

const PlanCard = ({planId, planName, amount, profilCount, quality}) => {

  return (
    <div className='plan-card'>
        <div className='plan-card-header'>
            <h2 className='plan-card-header-title'>{planName}</h2>
            <h1 className='plan-card-header-amount'>{amount} ₺</h1>
        </div>
        <div className='plan-card-options'>
            <ul className='plan-card-options-list'>
                <li className='plan-card-options-list-item'>30 gün kullanım süresi</li>
                <li className='plan-card-options-list-item'>{profilCount} adet profil</li>
                <li className='plan-card-options-list-item'>{quality} video kalitesi</li>
            </ul>
        </div>
        <div className='plan-card-btn'>
            <Link className='plan-card-btn-link' to={planId} state={{planId, planName, amount, profilCount, quality}}>
                <Button className="w100">
                    <SlBasket className='plan-card-btn-icon'/>
                </Button>
            </Link>
        </div>
    </div>
  )
}

export const PaymentPlan = ({planName, amount, profilCount, quality}) =>{
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
                            <li className='cc-pc-content-options-list-item'>{profilCount} adet profil</li>
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
    const [response, setResponse] = useState()
    const [plans, setPlans] = useState()

    const getPlans = async () =>{
        await planApi.getPlans()
            .then(({response})=>{
                setResponse(response.success);
                const sortingData = response.data.sort((a, b) => a.amount - b.amount);
                setPlans(sortingData);
            });
    }

    useEffect(() => {
      getPlans()
    },[])

    return(
        response ? (
            <div className='container plan'>
            {
                plans?.map((item, key) =>(
                    <PlanCard key={key} planId={item.id} planName={item.planName} amount={item.amount} profilCount={item.profileCount} quality={item.quality} />
                ))
            }
            
        </div>
        ): 
        (
            <Loader/>
        )
    )
}

export default PlanCard