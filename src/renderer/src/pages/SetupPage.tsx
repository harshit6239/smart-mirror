import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

const AP_IP = '10.42.0.1'
const COMPANION_PORT = 8080
const COMPANION_URL = `http://${AP_IP}:${COMPANION_PORT}`
const HOTSPOT_SSID = 'SmartMirror-Setup'
const HOTSPOT_PASSWORD = 'mirror1234'

export default function SetupPage(): React.JSX.Element {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  useEffect(() => {
    QRCode.toDataURL(COMPANION_URL, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrDataUrl)
  }, [])

  useEffect(() => {
    const unsub = window.api.onWifiConnected(() => {
      // App.tsx will re-read config and switch to MirrorPage
    })
    return unsub
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Smart Mirror</h1>
          <p className="mt-1 text-white/60">WiFi Setup Required</p>
        </div>

        {/* QR Code */}
        <div className="rounded-2xl bg-white p-4">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR code to companion setup page" width={200} height={200} />
          ) : (
            <div className="flex h-[200px] w-[200px] items-center justify-center">
              <span className="text-black/40 text-sm">Generating…</span>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="w-full rounded-xl border border-white/10 p-4 text-sm space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-slate-950">
              1
            </span>
            <span>
              Connect your phone to the&nbsp;
              <span className="font-semibold text-sky-400">{HOTSPOT_SSID}</span>
              &nbsp;hotspot
            </span>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-slate-950">
              2
            </span>
            <span>
              Password:&nbsp;
              <span className="font-mono font-semibold text-sky-400">{HOTSPOT_PASSWORD}</span>
            </span>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-slate-950">
              3
            </span>
            <span>
              Scan the QR code or go to&nbsp;
              <span className="font-mono text-sky-400">{COMPANION_URL}</span>
            </span>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-slate-950">
              4
            </span>
            <span>Choose your home WiFi network and enter the password</span>
          </div>
        </div>

        {/* Waiting indicator */}
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-400" />
          Waiting for connection…
        </div>
      </div>
    </div>
  )
}
