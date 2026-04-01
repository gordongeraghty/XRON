import { Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'
import Playground from './pages/Playground'
import Spec from './pages/Spec'
import { useState, useEffect } from 'react'

export default function App() {
  const [darkMode, setDarkMode] = useState(true)

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <Header darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
      <Routes>
        <Route path="/" element={<Navigate to="/playground" replace />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/spec" element={<Spec />} />
      </Routes>
    </div>
  )
}
