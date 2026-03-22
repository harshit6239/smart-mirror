import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LayoutEditor from './pages/LayoutEditor'
import WidgetConfig from './pages/WidgetConfig'
import SystemSettings from './pages/SystemSettings'
import WifiSetupPage from './pages/WifiSetupPage'
import NotificationsPage from './pages/NotificationsPage'
import WidgetStore from './pages/WidgetStore'

const navClass = ({ isActive }: { isActive: boolean }): string =>
  isActive ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-white'

export default function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <div className="min-h-dvh bg-slate-900 text-white flex flex-col">
        <header className="border-b border-slate-700/60 px-4 py-3 flex items-center justify-between sticky top-0 bg-slate-900/90 backdrop-blur-sm z-10">
          <span className="font-semibold tracking-tight">Smart Mirror</span>
          <nav className="flex gap-5 text-sm">
            <NavLink to="/" end className={navClass}>
              Home
            </NavLink>
            <NavLink to="/settings" className={navClass}>
              Settings
            </NavLink>
            <NavLink to="/layout" className={navClass}>
              Layout
            </NavLink>
            <NavLink to="/store" className={navClass}>
              Store
            </NavLink>
            <NavLink to="/notifications" className={navClass}>
              Notify
            </NavLink>
            <NavLink to="/wifi" className={navClass}>
              WiFi
            </NavLink>
          </nav>
        </header>

        <main className="flex-1 p-4 max-w-lg mx-auto w-full">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/settings" element={<SystemSettings />} />
            <Route path="/layout" element={<LayoutEditor />} />
            <Route path="/store" element={<WidgetStore />} />
            <Route path="/widget-config/:instanceId" element={<WidgetConfig />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/wifi" element={<WifiSetupPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
