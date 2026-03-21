import { useCallback, useEffect, useState } from 'react'
import type { Page } from '../../../../main/config/app-config'
import { useConfig } from '../../hooks/useConfig'
import { useGesture } from '../../hooks/useGesture'
import PageDots from './PageDots'
import WidgetGrid from '../WidgetGrid/WidgetGrid'

const DEFAULT_PAGES: Page[] = [
  { id: 'page-home', name: 'Home', widgetIds: [] },
  { id: 'page-media', name: 'Media', widgetIds: [] },
  { id: 'page-info', name: 'Info', widgetIds: [] }
]

export default function PageSystem(): React.JSX.Element {
  const [pages, setPages] = useConfig('pages')
  const [activeIndex, setActiveIndex] = useState(0)

  // Seed default pages on first run
  useEffect(() => {
    if (pages !== undefined && pages.length === 0) {
      setPages(DEFAULT_PAGES)
    }
  }, [pages, setPages])

  const resolvedPages = pages && pages.length > 0 ? pages : DEFAULT_PAGES

  // Notify main process whenever the active page changes (companion WS broadcast)
  useEffect(() => {
    window.api.notifyPageChange(activeIndex)
  }, [activeIndex])

  const goNext = useCallback(() => {
    setActiveIndex((i) => Math.min(i + 1, resolvedPages.length - 1))
  }, [resolvedPages.length])

  const goPrev = useCallback(() => {
    setActiveIndex((i) => Math.max(i - 1, 0))
  }, [])

  useGesture(
    useCallback(
      (gesture) => {
        if (gesture === 'SWIPE_LEFT') goNext()
        else if (gesture === 'SWIPE_RIGHT') goPrev()
      },
      [goNext, goPrev]
    )
  )

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-black">
      {/* Slide viewport */}
      <div className="relative flex-1 overflow-hidden">
        <div
          className="flex h-full transition-transform duration-400 ease-in-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {resolvedPages.map((page) => (
            <div
              key={page.id}
              className="h-full w-screen shrink-0 flex items-center justify-center"
            >
              <WidgetGrid pageId={page.id} widgetIds={page.widgetIds} />
            </div>
          ))}
        </div>
      </div>

      {/* Page dots — always visible, bottom centre */}
      <div className="flex justify-center pb-4">
        <PageDots count={resolvedPages.length} active={activeIndex} />
      </div>
    </div>
  )
}
