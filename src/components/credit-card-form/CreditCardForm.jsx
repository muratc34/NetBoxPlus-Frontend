import React, { useEffect } from 'react';
import './credit-card-form.scss';
import { PaymentPlan } from '../plan-card/PlanCard';
import Input, { CCNumberInput, CVVInput, DateInput } from '../input-field/Input';
import { useState } from 'react';
import {RiVisaLine} from 'react-icons/ri';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../button/Button';
import creditCardApi from '../../api/modules/payment.api';
import jwtDecode from 'jwt-decode';
import subscriptionApi from '../../api/modules/subscription.api';

const CreditCardForm = () => {
  const [cardNumber, setCardNumber] = useState();
  const [cardOwner, setCardOwner] = useState();
  const [cardExpireYear, setCardExpireYear] = useState();
  const [cardExpireMonth, setCardExpireMonth] = useState();
  const [cardExpireValid, setCardExpireValid] = useState();
  const [cardCVV, setCardCVV] = useState();
  
  const [isCCVFocused, setIsCCVFocused] = useState(false);
  
  const location = useLocation();
  const data = location.state;

  const navigate = useNavigate()

  var token = localStorage.getItem("token");
  var decoded = jwtDecode(token);

  const cardBrands = [
    { brand: 'Visa', pattern: /^4/ },
    { brand: 'Mastercard', pattern: /^5[1-5]/ }
  ];

  async function completePayment(e){
    e.preventDefault();
    expireYearAndMonthDivider();

    await creditCardApi.addCreditCard({
      userId: decoded.Id,
      cardBrand: findCardBrand(cardNumber),
      cardName: cardOwner,
      cardNumber: cardNumber,
      expireYear: cardExpireYear,
      expireMonth: cardExpireMonth,
      cvv: cardCVV
    }).then( 
      await subscriptionApi.addSubs({
        userId: decoded.Id,
        planId: data.planId
      }).then((response) => {
        if(response.success)
        {
          setTimeout(() => {
            navigate("/payment/complete")
          }, 2000);
        }
      })
    )
  }

  const findCardBrand = (cardNumber) => {
    for (let i = 0; i < cardBrands.length; i++) {
      if (cardNumber.match(cardBrands[i].pattern)) {
        return cardBrands[i].brand;
      }
    }
    return 'Unknown';
  };

  const expireYearAndMonthDivider = () =>
  {
    if (cardExpireValid.length === 5) {
      var month = cardExpireValid.slice(0,2);
      var year = cardExpireValid.slice(3,5);
  
      setCardExpireMonth(month);
      setCardExpireYear(year);
    }
  }
  const handleCCVFocus = () => {
    setIsCCVFocused(true);
  };

  const handleCCVBlur = () => {
    setIsCCVFocused(false);
  };
  
  return (
    <div className='cc container'>
      <div className='cc-plan'>
        <PaymentPlan planName={data.planName} amount={data.amount} profilPiece={data.profilPiece} quality={data.quality} />
      </div>
      <div className='cc-bottom'>
        <div className='cc-bottom-left-form'>
          <form className='cc-form'>
              <CCNumberInput data={cardNumber} setDataState={setCardNumber} placeHolder="Kart Numarası"/>
              <Input data={cardOwner} setDataState={setCardOwner} placeHolder="Kart Sahibinin Adı" type={"text"}/>
              <div className='cc-form-date-cvv'>
                <DateInput data={cardExpireValid} setDataState={setCardExpireValid} placeHolder="SKT(MM/YY)" type={"text"}/>
                <CVVInput focus={handleCCVFocus} blur={handleCCVBlur} customCss={"input-sec"} data={cardCVV} setDataState={setCardCVV} placeHolder="CVV" type={"text"}/>
              </div>
          </form>
        </div>
        <div className='cc-bottom-card'>
          <CreditCard isCCVFocused={isCCVFocused} cardNumber={cardNumber} cardHolder={cardOwner} expireDate={cardExpireValid} cardCVV={cardCVV}/>
          <div className='cc-btn'>
            <Button onClick={(e)=>completePayment(e)}>Onayla</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const CreditCard = ({cardNumber, cardHolder, expireDate, cardCVV ,isCCVFocused}) =>{
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  useEffect(() => {
    setIsCardFlipped(isCCVFocused);
  }, [isCCVFocused]);

  const handleCardFlip = () => {
    setIsCardFlipped(!isCardFlipped);
  };

  return (
    <div onClick={handleCardFlip} className={`credit-card ${isCardFlipped ? 'flipped' : ''}`}>
      <div className="credit-card-front">
        <div className="credit-card-front-logo"><RiVisaLine/></div>
        <div className="credit-card-front-number">
          <span className='credit-card-front-number-label'>Card Number</span>
          <span className='credit-card-front-number-text'>{cardNumber}</span>
        </div>
        <div className="credit-card-front-info">
          <div className="credit-card-front-info-holder">
            <span className='credit-card-front-info-holder-label'>Holder</span>
            <span className='credit-card-front-info-holder-text'>{cardHolder}</span>
          </div>
          <div className="credit-card-front-info-expiry-date">
            <div className='expiry-date'>
              <span className='expiry-date-label'>Valid</span>
              <span className='expiry-date-label'>THRU</span>
            </div>
            <span>{expireDate}</span>
          </div>
        </div>
      </div>
      <div className="credit-card-back">
        <div className="credit-card-back-stripe"></div>
        <div className="credit-card-back-cvv">{cardCVV}</div>
      </div>
    </div>
  );
}

export default CreditCardForm