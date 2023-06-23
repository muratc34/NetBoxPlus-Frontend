import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {LiaPlusSolid, LiaTimesSolid} from 'react-icons/lia';
import Button from '../button/Button';
import logo from '../../assets/netboxplus-logo.png';
import './main-welcome.scss';
import Input from '../input-field/Input';

const MainWelcome = () => {
    const QA = [
        {
            question: 'NetBox+ nedir?',
            answer:"NetBox+ dijital bir film izleme platformudur. Tek bir reklam olmadan,istediğiniz kadar, istediğiniz zaman izleyebilirsiniz - hepsi aylık düşük bir ücret karşılığında."
        },
        {
            question: "NetBox+'ın maliyeti nedir?",
            answer:"Aylık plan ücretleri 39,99 TL ile 99,99 TL arasında değişmektedir. Ekstra maliyet yok, sözleşme yok."
        },
        {
            question: "NetBox+'da ne izleyebilirim?",
            answer: "NetBox+, uzun metrajlı filmlerden oluşan kapsamlı bir kütüphaneye sahiptir. İstediğiniz her zaman, istediğiniz kadar çok şey izleyin."
        },
        {
            question: "NetBox+ üyeliğimi nasıl iptal ederim?",
            answer: "NetBox+ esnektir. Sinir bozucu hiçbir sözleşme ve taahhüt yoktur. Hesabınızı çevrimiçi olarak iki tıklamayla kolayca iptal edebilirsiniz. İptal ücreti yoktur - hesabınızı istediğiniz zaman başlatın veya durdurun."
        }
      ];

    const [email, setRegisterEmail] = useState()
    const [isOpen, setIsOpen] = useState(Array(QA.length).fill(false))

    const handleField = (index)=> {
        const newIsOpen = [...isOpen];
        newIsOpen[index] = !newIsOpen[index];
        setIsOpen(newIsOpen);
    }

    return (
        <div className="container">
            <div className="section">
                <div className='welcome'>
                    <p className='welcome-title'>Sınırsız film keyfi 
                        <img className='welcome-logo' src={logo} alt="logo.png"/>'da.
                    </p>
                    <p className='welcome-text'>Üye olmak için e-postanı gir.</p>
                    <form className='form'>
                        <Input data={email} setDataState={setRegisterEmail} customCss ="email-input" customLabelCss="email-input-label" type={email} placeHolder={"E-posta"} ></Input>
                        <Link to= "/register" state= {{from: {email} }}><Button className="welcome-register-btn">Devam Et {`>`}</Button></Link> 
                    </form>
                </div>
            </div>
            <hr className='welcome-line'/>
            <div className='section'>
                <div className='questions'>
                    <div className='questions-title'>
                        <h1>Sıkça Sorulan Sorular</h1>
                    </div>
                    {
                        QA.map((e,i) =>(
                            <div key={i} className='questions-field'>
                                <ul className='questions-field-list'>
                                    <li className='questions-field-list-item'>
                                        <div className="questions-field-list-item-q" onClick={() => handleField(i)}>
                                            <h3 className='question-title'>{e.question}</h3>
                                            {
                                                isOpen[i] ?
                                                (<LiaTimesSolid className='welcome-icons'/> )
                                                :
                                                (<LiaPlusSolid className='welcome-icons'/>)
                                            }
                                        </div>
                                        <div className={`questions-field-list-item-a ${isOpen[i] ? ("open"): ("")}`}>
                                            <p className='question-text'>
                                                {e.answer}
                                            </p>
                                        </div>
                                    </li>
                                </ul>
                            </div>   
                        ))
                    }
                </div>
            </div>
        </div>
    )
}

export default MainWelcome