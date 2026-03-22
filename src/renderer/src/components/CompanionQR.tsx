import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function CompanionQR(): React.JSX.Element {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [companionUrl, setCompanionUrl] = useState<string>('')
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    window.api
      .getCompanionUrl()
      .then((url) => {
        setCompanionUrl(url)
        return QRCode.toDataURL(url, {
          width: 72,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        })
      })
      .then(setQrDataUrl)
      .catch(() => {})
  }, [])

  if (!qrDataUrl) return <></>

  return (
    <div className="absolute bottom-3 right-3 z-50">
      {visible ? (
        <button
          onClick={() => setVisible(false)}
          title={`Open companion: ${companionUrl}`}
          className="block"
        >
          <div className="bg-white rounded p-1 shadow-lg opacity-70 hover:opacity-100 transition-opacity">
            <img src={qrDataUrl} alt="Companion QR" width={64} height={64} />
          </div>
        </button>
      ) : (
        <button
          onClick={() => setVisible(true)}
          className="bg-white/10 hover:bg-white/20 rounded-full px-2 py-1 text-white/40 hover:text-white/70 text-xs transition-colors"
        >
          QR
        </button>
      )}
    </div>
  )
}
