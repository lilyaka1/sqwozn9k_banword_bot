import { Routes, Route } from 'react-router-dom'
import { UserProvider } from './api/hooks'
import HomePage from './pages/HomePage.jsx'
import HorseRacing from './pages/HorseRacing.jsx'
import Slots from './pages/Slots.jsx'
import BlockBlast from './pages/BlockBlast.jsx'
import RoverSmash from './pages/RoverSmash.jsx'
import Admin from './pages/Admin.jsx'
import './App.css'

function App() {
  return (
    <UserProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/horse-racing" element={<HorseRacing />} />
        <Route path="/slots" element={<Slots />} />
        <Route path="/block-blast" element={<BlockBlast />} />
        <Route path="/rover-smash" element={<RoverSmash />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </UserProvider>
  )
}

export default App
