
import './App.css'
import { Routes, Route } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import Login from './pages/Login.jsx';
import Chat from './pages/Chat.jsx';
import Register from './pages/Register.jsx';

function App() {


  return (
    <>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/register" element={<Register />} />
      </Routes>
     
    </>
  )
}

export default App
