import { useEffect, useState } from 'react'
import SetupPage from './pages/SetupPage'
import MirrorPage from './pages/MirrorPage'

function App(): React.JSX.Element {
  const [wifiConfigured, setWifiConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    // Apply theme from config on load, then watch for changes
    window.config.get().then((cfg) => {
      document.documentElement.dataset.theme = cfg.settings.theme
      setWifiConfigured(cfg.wifi.configured)
    })

    const unsubTheme = window.config.onChange((cfg) => {
      document.documentElement.dataset.theme = cfg.settings.theme
    })

    // Transition immediately when wifi-connected fires from main process
    const unsubWifi = window.api.onWifiConnected(() => setWifiConfigured(true))

    const unsubNotif = window.api.onNotification((note) => {
      console.log('[notification]', note)
    })

    return () => {
      unsubTheme()
      unsubWifi()
      unsubNotif()
    }
  }, [])

  if (wifiConfigured === null) {
    // Brief loading — avoid flash
    return <div className="min-h-screen bg-black" />
  }

  return wifiConfigured ? <MirrorPage /> : <SetupPage />
}

export default App
