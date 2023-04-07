import React, { useRef, useState } from 'react';

import './nbp-trailer-player.scss';
import { BsFillVolumeMuteFill, BsFillVolumeUpFill} from 'react-icons/bs';
import { IoMdRefresh } from 'react-icons/io';

const NbpTrailerPlayer = ({ videoSrc, poster }) => {
  const [isMuted, setIsMuted] = useState(true);
  const [ended, setEnded] = useState(false)
  const videoRef = useRef(null);

  const revertPoster = () => {
    setEnded(true);
  }

  const playTrailer = () => {
    setEnded(false);
  }

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return(
    <div>
      {
        ended === true ?
        (
          <div>
            <img className='video poster' src={poster} alt='poster'/>
            <div className='movie-trailer-play'>
              <button onClick={playTrailer} className='movie-trailer-btn'>
                <IoMdRefresh/>
              </button>
            </div>
          </div>
        ):
        (
          <div>
            <video className='video'
            src={videoSrc}
            ref={videoRef}
            muted={isMuted}
            poster={poster}
            onEnded={() => revertPoster()}
            autoPlay
            /> 
            {
              isMuted === true ?
              (
                <div className='movie-trailer-volume'>
                  <button onClick={toggleMute} className='movie-trailer-btn'>
                    <BsFillVolumeMuteFill/>
                  </button>
                </div>
              ):
              (
                <div className='movie-trailer-volume'>
                  <button onClick={toggleMute} className='movie-trailer-btn'>
                    <BsFillVolumeUpFill/>
                  </button>
                </div>
              )
            }
          </div>
        )
      }
      
    </div> 
  )
};

export default NbpTrailerPlayer;