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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-white focus:font-semibold focus:rounded focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-gray-900"
      >
        Skip to main content
      </a>
      <Header darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
      <Routes>
        <Route path="/" element={<Navigate to="/playground" replace />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/spec" element={<Spec />} />
      </Routes>
    </div>
  )
}
