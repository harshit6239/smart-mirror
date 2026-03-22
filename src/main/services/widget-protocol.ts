import { protocol, app, net } from 'electron'
import { join, sep } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { pathToFileURL } from 'url'
import { is } from '@electron-toolkit/utils'

/**
 * Must be called before app.whenReady() to register the widget:// scheme with
 * the privileges required for ESM dynamic import in the renderer.
 */
export function registerWidgetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'widget',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

/**
 * Must be called inside app.whenReady() to install the file-serving handler.
 *
 * URL shape: widget://<widgetId>/<version>/bundle.esm.js
 * Serves files from: <userData>/widgets/<widgetId>/<version>/bundle.esm.js
 */
export function handleWidgetProtocol(): void {
  protocol.handle('widget', (request) => {
    try {
      const url = new URL(request.url)
      const widgetId = url.hostname
      // pathname is like /0.1.0/bundle.esm.js → ['0.1.0', 'bundle.esm.js']
      const pathParts = url.pathname.replace(/^\//, '').split('/')

      const widgetsDir = join(app.getPath('userData'), 'widgets')
      const filePath = join(widgetsDir, widgetId, ...pathParts)

      // Path traversal guard: resolved path must stay within the widgets directory.
      const safePrefix = widgetsDir + sep
      if (!filePath.startsWith(safePrefix)) {
        return new Response('Forbidden', { status: 403 })
      }

      return net.fetch(pathToFileURL(filePath).toString())
    } catch {
      return new Response('Bad Request', { status: 400 })
    }
  })

  // In dev mode, auto-seed a minimal test widget so Phase 15 can be verified
  // without needing to manually create the bundle file.
  if (is.dev) {
    seedTestWidget()
  }
}

function seedTestWidget(): void {
  const destDir = join(app.getPath('userData'), 'widgets', 'test-widget', '0.1.0')
  const destFile = join(destDir, 'bundle.esm.js')
  if (existsSync(destFile)) return

  mkdirSync(destDir, { recursive: true })
  writeFileSync(
    destFile,
    `// Phase 15 test widget — auto-seeded by smart-mirror dev mode
export default function TestWidget({ instanceId }) {
  return React.createElement(
    'div',
    {
      style: {
        color: 'rgba(255,255,255,0.5)',
        padding: '8px',
        fontSize: '11px',
        lineHeight: '1.6',
        fontFamily: 'inherit'
      }
    },
    React.createElement(
      'div',
      { style: { opacity: 0.4, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' } },
      'dynamic widget'
    ),
    '\\u2713 Loaded from userData',
    React.createElement('br', null),
    'id: ' + instanceId
  )
}
`,
    'utf-8'
  )
}
