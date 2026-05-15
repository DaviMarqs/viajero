import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/login/login'
import Register from './pages/register/register'
import "./index.css"
import Onboard from './pages/onboarding/onboarding'
import Test from './pages/tests/test'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/cadastro" element={<Register />} />
        <Route path="/onboard" element={<Onboard />} />
        <Route path="/test" element={<Test />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App