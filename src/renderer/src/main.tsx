import './assets/main.css'

import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Make React available as a global so dynamically-loaded widget bundles can use
// React.createElement without needing to bundle their own copy of React.
;(globalThis as { React?: typeof React }).React = React

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
