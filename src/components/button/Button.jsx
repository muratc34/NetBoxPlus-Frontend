import React from 'react';
import PropTypes from 'prop-types';

import './button.scss';

const Button = props => {
  return (
    <button 
        className={`btn ${props.className}`} 
        onClick={props.onClick ? (e)=> props.onClick(e): null}
        form={props.form}
    >
        {props.children}
    </button>
  )
}

export const OutlineButton = props => {
    return (
        <Button
            className={`btn-outline ${props.className}`}
            onClick={props.onClick ? (e) => props.onClick(e) : null}
        >
            {props.children}
        </Button>
    );
}

Button.propTypes = {
    onClick: PropTypes.func
}

export default Button;