import React, { useEffect } from 'react'
import './account-setting.scss';
import Input, { DisabledInput } from '../input-field/Input';
import Button from '../button/Button';
import { useState } from 'react';
import jwtDecode from 'jwt-decode';
import authApi from '../../api/modules/auth.api';
import Loader from '../loader/Loader';
import { ToastContainer, toast } from 'react-toastify';
import creditCardApi from '../../api/modules/payment.api';

const AccountSetting = () => {
  const [currentPassword, setCurrentPassword] = useState();
  const [newPassword, setNewPassword] = useState();
  const [user, setUser] = useState();
  const [response, setResponse] = useState(false);
  const [CCResponse, setCCResponse] = useState(false);
  const [CCInfo, setCCInfo] = useState();
 
  var token = localStorage.getItem("token");
  var decoded = jwtDecode(token);

  const getUser = async (id) => {
    await authApi.getUser(id)
    .then(({data})=>{
      setUser(data);
      setResponse(true);
    });
  };

  const getCreditCard = async (id) => {
    await creditCardApi.getCCById(id)
      .then(({response})=>{
        setCCInfo(response.data);
        setCCResponse(response)
      })
  }

  useEffect(() => {
    getUser(decoded.Id)
  }, [decoded.Id]);

  useEffect(()=>{
    if (user) {
      getCreditCard(user.paymentId)
    }
  },[user])

  async function changePassword(){
    await authApi.changePassword({
      id: decoded.Id,
      currentPassword: currentPassword,
      newPassword: newPassword
    }).then((response)=>{
      if (response.success) {
        toast.success(response.message);
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
      else
      {
        toast.error(response.message);
      }
    });
  };

  
  
  return (
    response ? 
    (
      <div>
        <div className="container-mt-5 account">
          <div className='account-info'>
            <h2 className='account-title'>Hesabım</h2>
            <hr className='account-line'/>
            <div className='account-info-group'>
              <DisabledInput labelTxt={"Ad"} placeHolder={user.firstName} type={"text"}/>
              <DisabledInput labelTxt={"Soyad"} placeHolder={user.lastName} type={"text"}/>
              <DisabledInput labelTxt={"Email"} placeHolder={user.email} type={"text"}/>
            </div>
          </div>
          <div className='account-password'>
            <h2 className='account-title'>Şifre</h2>
            <hr className='account-line'/>
            <div className='account-password-group'>
              <Input data={currentPassword} setDataState={setCurrentPassword} placeHolder="Mevcut Şifre" type={"password"}/>
              <Input data={newPassword} setDataState={setNewPassword} placeHolder="Yeni Şifre" type={"password"}/>
              <Button onClick={()=> changePassword()} className="account-password-group-btn">Kaydet</Button>
              <ToastContainer 
              position="bottom-center"
              autoClose={1000}
              hideProgressBar={true}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="dark"/>
            </div>
          </div>
          {
            CCResponse ? 
            (
              <div className='account-payment'>
                <h2 className='account-title'>Ödeme</h2>
                <hr className='account-line'/>
                <div className='account-payment-group'>
                    <DisabledInput placeHolder={CCInfo.cardName} type={"text"} labelTxt={"Kart Sahibinin Adı"} />
                    <DisabledInput placeHolder={CCInfo.cardNumber} type={"text"} labelTxt={"Kart Numarası"}/>
                </div>
              </div>
            )
            :
            (
              <Loader/>
            )
          }
        </div>
    </div>
    ) :
    (
      <Loader/>
    )
  )
}

export default AccountSetting