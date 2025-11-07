import { useEffect } from 'react'

function App(): React.JSX.Element {
  const ipcRenderer = window.electron.ipcRenderer

  useEffect(() => {
    const cleanup = window.api.onGesture((data) => {
      console.log('Gesture data received in renderer:', data)
    })

    return cleanup
  }, [])

  const sendGesture = (): void => {
    const gesture = { type: 'gesture', name: 'swipe-right' }
    ipcRenderer.send('send-gesture', JSON.stringify(gesture))
  }

  return (
    <>
      <div className="">Powered by electron-vite</div>
      <button onClick={sendGesture}>send</button>
    </>
  )
}

export default App
