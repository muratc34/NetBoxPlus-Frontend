import React from 'react';
import './input.scss'

const Input = ({placeHolder, type, customCss, setDataState, data, maxLength,}) => {

  return (
    <div>
        <div className='input-box'>
            <input maxLength={maxLength} onChange={(e)=>setDataState(e.target.value)}  className={`input-field ${customCss}`} type={type}/>
            <label className={`input-label ${data ? "top-label":""}`}>{placeHolder}</label>
        </div>
    </div>
  )
}

export const DisabledInput = ({placeHolder, labelTxt, customCss}) => {
    return (
        <div>
            <div className='input-box-disabled'>
                <input className={`input-field ${customCss}`} type="text" placeholder={placeHolder} disabled/>
                <label className='input-label'>{labelTxt}</label>
            </div>
        </div>
    )
}

export const DateInput = ({placeHolder, data, setDataState}) => {
    if (data == null) {
        data = '';
    }

    const handleExpiryChange = (e) => {
        const {value} = e.target;

        // Sadece sayısal değerleri kabul etmek için regex kullanılıyor.
        const newValue = value.replace(/[^\d/]/g, '');

        // Ay kısmı için 0 veya 1 dışında bir değer girilmesini engelle
        if (newValue.length === 1 && parseInt(newValue, 10) > 1) {
        return;
        }

        // Ay 12'den büyük olmasını engelle
        if (newValue.length === 2 && parseInt(newValue, 10) > 12) {
        return;
        }

        // Ay ve yılın son iki hanesi arasına slash (/) ekle
        if (newValue.length === 2 && data.length === 1) {
            setDataState(newValue + '/');
            return;
        }

        setDataState(newValue);
    };

    return (
        <div>
            <div className='input-box'>
                <input value={data} pattern="[0-9]*" inputMode="numeric" maxLength={5} onChange={handleExpiryChange} className="input-field input-sec" type="text"/>
                <label className={`input-label ${data ? "top-label":""}`}>{placeHolder}</label>
            </div>
        </div>
    )
}

export const CCNumberInput = ({placeHolder, setDataState, data}) => {

    if (data == null) {
        data = '';
    }

    const handleCardNumberChange = (event) => {
        const input = event.target.value;

        const formattedInput = input.replace(/\D/g, '');
        let newCardNumber = '';
        
        for (let i = 0; i < formattedInput.length; i++) {
            if (i > 0 && i % 4 === 0) {
            newCardNumber += ' ';
            }
            newCardNumber += formattedInput[i];
        }
        
        setDataState(newCardNumber);
    };

    return(
        <div>
            <div className='input-box'>
                <input value={data} maxLength={19} onChange={handleCardNumberChange} id="cardNum" className="input-field" type="text"/>
                <label className={`input-label ${data ? "top-label":""}`}>{placeHolder}</label>
            </div>
        </div>
    )
}

export const CVVInput = ({placeHolder, setDataState, data, customCss, focus, blur}) => {
    if(data == null)
    {
        data = '';
    }

    const handleCVVChange = (event) => {
        const input = event.target.value;

        const formattedInput = input.replace(/\D/g, '');
        
        setDataState(formattedInput);
    };
    
    return(
    <div>
        <div className='input-box'>
            <input onFocus={focus} onBlur={blur} value={data} className={`input-field ${customCss}`} maxLength={3} onChange={handleCVVChange} type="text"/>
            <label className={`input-label ${data ? "top-label":""}`}>{placeHolder}</label>
        </div>
    </div>
)
}

export default Input