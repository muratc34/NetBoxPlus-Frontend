import React from 'react';
import {BiPackage} from 'react-icons/bi';
import {HiOutlineCreditCard} from 'react-icons/hi';
import {TiTick} from 'react-icons/ti';
import './steps.scss';

const Steps = ({step}) => {
  return (
    <div className='steps container'>
        <div className="steps-content">
            <div className='steps-circle'>
                <div className='steps-circle-content'>
                    {step === "plan" || step ==="done" ?(
                        <TiTick className='steps-circle-content-icon'/>
                    ):(
                        <BiPackage className='steps-circle-content-icon'/>
                    )}
                </div>
            </div>
            <div>
                <span className='steps-circle-content-text'>Paket Seçimi</span>
            </div>
        </div>
        <div className='steps-line'></div>
        <div className="steps-content">
            <div className='steps-circle'>
                <div className='steps-circle-content'>
                {step === "payment" || step ==="done" ?(
                        <TiTick className='steps-circle-content-icon'/>
                    ):(
                        <HiOutlineCreditCard className='steps-circle-content-icon'/>
                    )}
                </div>
            </div>
            <div>
                <span className='steps-circle-content-text'>Ödeme</span>
            </div>
        </div>
    </div>
  )
}

export default Steps