import { Link } from 'react-router-dom'
import styles from './GameCard.module.css'

function GameCard({ to, icon, title, description, variant, isNew, isHot }) {
  const handleClick = () => {
    if (navigator.vibrate) {
      navigator.vibrate(50)
    }
  }

  return (
    <Link 
      to={to} 
      className={`${styles.card} ${styles[variant]}`}
      onClick={handleClick}
    >
      <div className={styles.icon}>
        {isHot ? <span className={styles.hotIcon}>{icon}</span> : icon}
      </div>
      <div className={styles.info}>
        <div className={styles.title}>
          {title}
          {isNew && <span className={styles.newBadge}>🔥 Hot</span>}
        </div>
        <div className={styles.desc}>{description}</div>
      </div>
      <div className={styles.arrow}>→</div>
    </Link>
  )
}

export default GameCard
