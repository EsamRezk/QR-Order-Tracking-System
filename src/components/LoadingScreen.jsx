import logo from '../assets/img/KebbaZone Logo.png'
import './LoadingScreen.css'

export default function LoadingScreen({ text = 'جاري التحميل...', fullScreen = false }) {
  return (
    <div className={`loading-screen-container ${fullScreen ? 'fullscreen' : ''}`}>
      <div className="loading-bounce-wrapper">
        <img src={logo} alt="كبة زون" className="loading-logo-bounce" />
        <div className="loading-shadow"></div>
      </div>
      {text && <div className="loading-text">{text}</div>}
    </div>
  )
}
