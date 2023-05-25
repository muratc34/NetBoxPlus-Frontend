import React, { useRef } from 'react'
import { useEffect } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import movieApi from '../../api/modules/movie.api';
import config from '../../api/configs/config';
import Loader from '../loader/Loader';
import './nbp-movie-player.scss';
import {FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaExpand, FaCompress, FaArrowLeft} from 'react-icons/fa';
import {BiMessageAltDetail} from 'react-icons/bi';
import {MdReplay5, MdForward5} from 'react-icons/md';

const NbpMoviePlayer = () => {
  const [movie, setMovie] = useState([]);
  const [response, setResponse] = useState([])
  const {id} = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false)
  const [isVolumeBarVisible, setIsVolumeBarVisible] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  useEffect(() => {
    const getMovie = async () => {
      await movieApi.getMovie(id)
      .then(({response})=>{
          setResponse(response);
          setMovie(response.data);
      });
    };
      getMovie()
  },[id]);


  const togglePlay = () =>{
    const video = videoRef.current;
    if(video.paused)
    {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  const handleProgressBarClick = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const percent = (event.clientX - bounds.left)/bounds.width;
    const newTime = percent * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeBarChange = (event) => {
    const rect = event.target.getBoundingClientRect();
    const newVolume = (event.clientX - rect.left) / rect.width;
    if (newVolume === 0) {
      videoRef.current.volume = newVolume;
      setVolume(0)
      setIsMuted(true);
    }
    else{
      videoRef.current.volume = newVolume;
      setVolume(newVolume)
      setIsMuted(false);
    }
  }

  const volumeButtonHover = (isHovering) => {
    setIsVolumeBarVisible(isHovering);
  }

  const toggleVolumeMute = () => {
    if (!isMuted) {
      videoRef.current.volume = 0
      setVolume(0)
      setIsMuted(!isMuted)
    }
    else if(isMuted){
      videoRef.current.volume = 1
      setVolume(1)
      setIsMuted(!isMuted)
    }
  }

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    setCurrentTime(video.currentTime);
    setDuration(video.duration);
  };

  const handleBackward = () => {
    videoRef.current.currentTime -= 5;
    setCurrentTime(videoRef.current.currentTime);
  }

  const handleForward = () => {
    videoRef.current.currentTime += 5;
    setCurrentTime(videoRef.current.currentTime);
  }

  const toggleFullScreen = () => {
    if (!isFullScreen) {
      const videoElement = document.querySelector(".movie-player");
      if (videoElement.requestFullscreen) {
        videoElement.requestFullscreen();
      } else if (videoElement.webkitRequestFullscreen) {
        videoElement.webkitRequestFullscreen();
      }
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      setIsFullScreen(false);
    }
  };

  useEffect(() => {
    let timeoutId;

    function handleMouseMove() {
      setShowControls(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setShowControls(false), 3000);
    }

    function handleMouseLeave() {
      setShowControls(false);
      clearTimeout(timeoutId);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    if(showControls)
    {
      document.body.style.cursor = "default";
    }
    else if (!showControls)
    {
      document.body.style.cursor = "none";
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout(timeoutId);
    };
  }, [showControls]);

  return (
    <div>
      {
      response.success ? 
      (
        <div className="movie-player">
          {
            showControls && (
            <div className={'movie-player-top'}>
              <div className='movie-player-top-btn' onClick={()=>(navigate(-1))}>
                <FaArrowLeft/>
              </div>
              <div className='movie-player-top-text'>
                <span>{movie.title}</span>
              </div>
              <div className='movie-player-top-btn'>
                <BiMessageAltDetail/>
              </div>
            </div>
          )}
          <div className='movie-player-middle' onMouseMove={() => setShowControls(true)}>
            <video
              src={config.baseURL + movie.moviePath}
              ref={videoRef}
              onClick={togglePlay}
              onTimeUpdate={handleTimeUpdate}
              autoPlay
              className="video"
            />
          </div>
          {
            showControls && (
            <div className='movie-player-controls'>
              <div className='movie-player-controls-top'>
                <div className='movie-player-controls-top-text'>
                  <Duration currentTime={currentTime}/>
                </div>
                <div className='progress-bar' onClick={handleProgressBarClick}>
                  <div className='progress-bar-inner' style={{ width: `${(currentTime / duration) * 100}%` }}></div>
                </div>
                <div className='movie-player-controls-top-text'>
                  <Duration currentTime={duration}/>
                </div>
              </div>
              <div className='movie-player-controls-bottom'>
                <div className='movie-player-controls-volume'>
                  <div className='movie-player-controls-bottom-btn' onClick={toggleVolumeMute} onMouseEnter={volumeButtonHover} onMouseLeave={() => volumeButtonHover(false)} >
                    {
                      isMuted ? (<FaVolumeMute/>) : (<FaVolumeUp/>)
                    }
                  </div>
                  {
                  isVolumeBarVisible && (
                    <div className='vol-bar' onMouseEnter={() => volumeButtonHover(true)} onMouseLeave={() => volumeButtonHover(false)}>
                      <div className='volume-bar' onClick={handleVolumeBarChange}>
                        <div className='volume-bar-inner' style={{ width: `${(volume) * 100}%` }}></div>
                      </div>
                    </div>
                  )}
                  
                </div>
                <div className='movie-player-controls-bottom-cg'>
                  <div className='movie-player-controls-bottom-btn' onClick={handleBackward}>
                    <MdReplay5/>
                  </div>
                  <div className='movie-player-controls-bottom-btn' onClick={togglePlay}>
                    {playing ? <FaPause /> : <FaPlay />}
                  </div>
                  <div className='movie-player-controls-bottom-btn' onClick={handleForward}>
                    <MdForward5/>
                  </div>
                </div>
                <div className='movie-player-controls-bottom-btn' onClick={toggleFullScreen}>
                  {!isFullScreen ? (<FaExpand className='fullscreen'/>):(<FaCompress className='fullscreen'/>)}
                </div>
              </div>
            </div>
          )}
        </div>
      )
      :
      (
        <Loader/>
      )
    }
    </div>
  )
}

const Duration = ({ currentTime }) => {
  const formatTime = (time) => {
    const hours = Math.floor(time / 3600)
      .toString()
      .padStart(1, "0");
    const minutes = Math.floor((time / 60) % 60)
      .toString()
      .padStart(2, "0");;
    const seconds = Math.floor(time % 60)
      .toString()
      .padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  return <div className="time-counter">{formatTime(currentTime)}</div>;
}



export default NbpMoviePlayer