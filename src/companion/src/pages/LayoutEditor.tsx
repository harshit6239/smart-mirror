import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GridLayout, useContainerWidth, noCompactor } from 'react-grid-layout'
import type { Layout, LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { api } from '../lib/api'
import { WIDGET_CATALOG } from '../lib/widgets-catalog'

const COLS = 12
const MAX_ROWS = 8
const ROW_HEIGHT = 42
const MAX_WIDGETS_PER_PAGE = 8
const MAX_PAGES = 5

// ─── Local types (mirror AppConfig shapes, no Electron import needed) ─────────

type LocalPage = { id: string; name: string; widgetIds: string[] }
type LocalLayout = { col: number; row: number; colSpan: number; rowSpan: number }
type LocalInstance = {
  id: string
  widgetId: string
  version: string
  config: Record<string, unknown>
  layout: LocalLayout
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type Snapshot = { pages: LocalPage[]; instances: Record<string, LocalInstance> }

// ─── Layout conversion helpers ─────────────────────────────────────────────────

function toRgl(inst: LocalInstance): LayoutItem {
  return {
    i: inst.id,
    x: inst.layout.col - 1,
    y: inst.layout.row - 1,
    w: inst.layout.colSpan,
    h: inst.layout.rowSpan,
    minW: 1,
    minH: 1
  }
}

// ─── Find first non-overlapping grid slot ────────────────────────────────────

function findFreeSlot(layout: Layout, w: number, h: number): { x: number; y: number } | null {
  const occupied = new Set<string>()
  for (const item of layout) {
    for (let r = item.y; r < item.y + item.h; r++) {
      for (let c = item.x; c < item.x + item.w; c++) {
        occupied.add(`${c},${r}`)
      }
    }
  }
  for (let r = 0; r <= MAX_ROWS - h; r++) {
    for (let c = 0; c <= COLS - w; c++) {
      let fits = true
      outer: for (let dr = 0; dr < h; dr++) {
        for (let dc = 0; dc < w; dc++) {
          if (occupied.has(`${c + dc},${r + dr}`)) {
            fits = false
            break outer
          }
        }
      }
      if (fits) return { x: c, y: r }
    }
  }
  return null
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function LayoutEditor(): React.JSX.Element {
  const [pages, setPages] = useState<LocalPage[]>([])
  const [instances, setInstances] = useState<Record<string, LocalInstance>>({})
  const [activeTab, setActiveTab] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [dirty, setDirty] = useState(false)
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [undoStack, setUndoStack] = useState<Snapshot[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 380 })
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get<{ pages: LocalPage[]; widgetInstances: Record<string, LocalInstance> }>('/api/layouts')
      .then(({ pages: p, widgetInstances: w }) => {
        setPages(p)
        setInstances(w)
      })
      .catch(() => {})
  }, [])

  const mark = useCallback(() => setDirty(true), [])

  const showToast = (msg: string): void => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const pushSnapshot = useCallback((): void => {
    setUndoStack((prev) => [...prev.slice(-9), { pages, instances }])
  }, [pages, instances])

  const undo = (): void => {
    if (undoStack.length === 0) return
    const snap = undoStack[undoStack.length - 1]
    setUndoStack((s) => s.slice(0, -1))
    setPages(snap.pages)
    setInstances(snap.instances)
    setDirty(true)
  }

  const currentPage = pages[activeTab] ?? { id: '', name: '', widgetIds: [] }
  const rglLayout: Layout = currentPage.widgetIds
    .map((id) => instances[id])
    .filter(Boolean)
    .map(toRgl)
  const widgetCount = currentPage.widgetIds.length
  const isPageFull = widgetCount >= MAX_WIDGETS_PER_PAGE
  const widgetsOnPage = new Set(
    currentPage.widgetIds.map((id) => instances[id]?.widgetId).filter(Boolean)
  )

  // ── Grid drag/resize ────────────────────────────────────────────────────────

  const onLayoutChange = useCallback(
    (layout: Layout) => {
      setInstances((prev) => {
        const next = { ...prev }
        for (const item of layout) {
          if (next[item.i]) {
            next[item.i] = {
              ...next[item.i],
              layout: { col: item.x + 1, row: item.y + 1, colSpan: item.w, rowSpan: item.h }
            }
          }
        }
        return next
      })
      mark()
    },
    [mark]
  )

  // Push snapshot at drag/resize START (before the move), not on every frame
  const onDragStart = useCallback((): void => pushSnapshot(), [pushSnapshot])
  const onResizeStart = useCallback((): void => pushSnapshot(), [pushSnapshot])

  // ── Widget add/remove ───────────────────────────────────────────────────────

  const addWidget = (widgetId: string): void => {
    if (isPageFull) {
      showToast(`Page full — max ${MAX_WIDGETS_PER_PAGE} widgets per page`)
      return
    }
    const alreadyAdded = currentPage.widgetIds.some((id) => instances[id]?.widgetId === widgetId)
    if (alreadyAdded) {
      showToast('Widget already on this page — remove it first to re-add')
      return
    }
    const entry = WIDGET_CATALOG.find((w) => w.widgetId === widgetId)
    if (!entry) return
    const slot = findFreeSlot(rglLayout, entry.defaultLayout.colSpan, entry.defaultLayout.rowSpan)
    if (!slot) {
      showToast('No free space on this page — rearrange existing widgets')
      return
    }
    pushSnapshot()
    const instanceId = `instance-${widgetId}-${Date.now()}`
    const inst: LocalInstance = {
      id: instanceId,
      widgetId,
      version: '1.0.0',
      config: { ...entry.defaultConfig },
      layout: {
        col: slot.x + 1,
        row: slot.y + 1,
        colSpan: entry.defaultLayout.colSpan,
        rowSpan: entry.defaultLayout.rowSpan
      }
    }
    setInstances((prev) => ({ ...prev, [instanceId]: inst }))
    setPages((prev) =>
      prev.map((p, i) => (i === activeTab ? { ...p, widgetIds: [...p.widgetIds, instanceId] } : p))
    )
    mark()
  }

  const removeWidget = (instanceId: string): void => {
    pushSnapshot()
    setPages((prev) =>
      prev.map((p, i) =>
        i === activeTab ? { ...p, widgetIds: p.widgetIds.filter((id) => id !== instanceId) } : p
      )
    )
    setInstances((prev) => {
      const next = { ...prev }
      delete next[instanceId]
      return next
    })
    mark()
  }

  // ── Page management ─────────────────────────────────────────────────────────

  const addPage = (): void => {
    if (pages.length >= MAX_PAGES) {
      showToast(`Maximum ${MAX_PAGES} pages allowed`)
      return
    }
    pushSnapshot()
    const id = `page-${Date.now()}`
    setPages((prev) => [...prev, { id, name: 'New Page', widgetIds: [] }])
    setActiveTab(pages.length) // new page will be at this index
    mark()
  }

  const deletePage = (idx: number): void => {
    if (pages.length <= 1) return
    const pageToDelete = pages[idx]
    if (
      pageToDelete.widgetIds.length > 0 &&
      !window.confirm(
        `Delete "${pageToDelete.name}" and its ${pageToDelete.widgetIds.length} widget(s)?`
      )
    ) {
      return
    }
    pushSnapshot()
    const removingIds = pageToDelete.widgetIds
    const keepIds = new Set(pages.flatMap((p, i) => (i !== idx ? p.widgetIds : [])))
    setInstances((prev) => {
      const next = { ...prev }
      for (const id of removingIds) {
        if (!keepIds.has(id)) delete next[id]
      }
      return next
    })
    setPages((prev) => prev.filter((_, i) => i !== idx))
    setActiveTab((prev) => Math.min(prev, pages.length - 2))
    mark()
  }

  const commitRename = (): void => {
    if (renamingIdx === null) return
    setPages((prev) =>
      prev.map((p, i) => (i === renamingIdx ? { ...p, name: renameVal.trim() || p.name } : p))
    )
    setRenamingIdx(null)
    mark()
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const save = async (): Promise<void> => {
    setSaveState('saving')
    try {
      await api.put('/api/layouts', { pages, widgetInstances: instances })
      setSaveState('saved')
      setDirty(false)
      setUndoStack([]) // clear undo history after a successful save
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 3000)
    }
  }

  // Always persist the current layout to the server before opening the config page.
  // This guarantees the instance exists in the store even when the user hasn't manually
  // clicked Save — GET /api/widget-config/:id would 404 otherwise.
  const openConfig = async (instanceId: string): Promise<void> => {
    setSaveState('saving')
    try {
      await api.put('/api/layouts', { pages, widgetInstances: instances })
      setSaveState('saved')
      setDirty(false)
      setUndoStack([])
    } catch {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 3000)
      return
    }
    // Pass the full instance as location state so WidgetConfig has a fallback
    // even if the GET somehow fails (e.g. a race with the store flush).
    navigate(`/widget-config/${instanceId}`, { state: { instance: instances[instanceId] } })
  }

  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? '✓ Saved'
        : saveState === 'error'
          ? 'Error — retry'
          : 'Save Layout'

  // ── Render ──────────────────────────────────────────────────────────────────

  if (pages.length === 0) return <p className="text-slate-400 py-8 text-center">Loading…</p>

  return (
    <div className="space-y-4 pb-6">
      <h1 className="text-xl font-bold">Layout Editor</h1>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-700 border border-slate-600 text-white text-sm px-4 py-2 rounded-xl shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* ── Page tabs ── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {pages.map((p, i) => (
          <div key={p.id} className="shrink-0 flex items-center">
            {renamingIdx === i ? (
              <input
                autoFocus
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setRenamingIdx(null)
                }}
                className="w-24 bg-slate-700 text-white text-sm rounded px-2 py-1 outline-none border border-sky-500"
              />
            ) : (
              <button
                onClick={() => setActiveTab(i)}
                onDoubleClick={() => {
                  setRenamingIdx(i)
                  setRenameVal(p.name)
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === i
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {p.name}
                {p.widgetIds.length > 0 && (
                  <span className="ml-1.5 text-xs opacity-60">{p.widgetIds.length}</span>
                )}
              </button>
            )}
            {pages.length > 1 && (
              <button
                onClick={() => deletePage(i)}
                className="ml-0.5 px-1 text-slate-500 hover:text-red-400 text-sm leading-none"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addPage}
          disabled={pages.length >= MAX_PAGES}
          title={pages.length >= MAX_PAGES ? `Maximum ${MAX_PAGES} pages` : 'Add page'}
          className="shrink-0 px-2 py-1.5 rounded-lg text-sm bg-slate-700 text-sky-400 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Page
        </button>
      </div>

      {/* ── Grid ── */}
      <div
        ref={containerRef}
        className="bg-slate-800/60 rounded-xl overflow-hidden border border-slate-700 relative"
        style={{ minHeight: ROW_HEIGHT * MAX_ROWS + 4 * 9 }}
      >
        {widgetCount === 0 && mounted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
            <p className="text-slate-600 text-sm">Empty page</p>
            <p className="text-slate-700 text-xs">Tap &ldquo;+ Widget&rdquo; below to add one</p>
          </div>
        )}
        {mounted && (
          <GridLayout
            key={currentPage.id}
            layout={rglLayout}
            width={width}
            gridConfig={{
              cols: COLS,
              rowHeight: ROW_HEIGHT,
              maxRows: MAX_ROWS,
              margin: [4, 4],
              containerPadding: [4, 4]
            }}
            dragConfig={{ enabled: true, bounded: true, threshold: 3 }}
            resizeConfig={{ enabled: true, handles: ['se'] }}
            compactor={noCompactor}
            onLayoutChange={onLayoutChange}
            onDragStart={onDragStart}
            onResizeStart={onResizeStart}
          >
            {currentPage.widgetIds
              .map((id) => instances[id])
              .filter(Boolean)
              .map((inst) => {
                const meta = WIDGET_CATALOG.find((w) => w.widgetId === inst.widgetId)
                return (
                  <div
                    key={inst.id}
                    className="bg-sky-900/50 border border-sky-600/40 rounded flex items-center justify-center relative select-none overflow-hidden"
                  >
                    <span className="text-xs font-medium text-sky-200 text-center px-1 leading-tight pointer-events-none">
                      {meta?.name ?? inst.widgetId}
                    </span>
                    {meta && Object.keys(meta.configSchema).length > 0 && (
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={() => void openConfig(inst.id)}
                        title="Configure widget"
                        className="absolute top-0.5 left-0.5 text-sky-400 hover:text-sky-200 text-xs w-4 h-4 flex items-center justify-center leading-none"
                      >
                        ⚙
                      </button>
                    )}
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onClick={() => removeWidget(inst.id)}
                      className="absolute top-0.5 right-0.5 text-sky-500 hover:text-red-400 text-xs w-4 h-4 flex items-center justify-center leading-none"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
          </GridLayout>
        )}
      </div>

      {/* ── Add widget ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-slate-400">Add Widget</p>
          <span
            className={`text-xs tabular-nums ${isPageFull ? 'text-amber-400' : 'text-slate-500'}`}
          >
            {widgetCount} / {MAX_WIDGETS_PER_PAGE}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {WIDGET_CATALOG.map((w) => {
            const isDuplicate = widgetsOnPage.has(w.widgetId)
            const isDisabled = isPageFull || isDuplicate
            return (
              <button
                key={w.widgetId}
                onClick={() => addWidget(w.widgetId)}
                disabled={isDisabled}
                title={
                  isDuplicate ? 'Already on this page' : isPageFull ? 'Page is full' : undefined
                }
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-sm rounded-lg text-white active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {isDuplicate ? '✓' : '+'} {w.name}
              </button>
            )
          })}
        </div>
        {isPageFull && (
          <p className="mt-2 text-xs text-amber-400/70">
            Page is full — remove a widget to add more.
          </p>
        )}
      </div>

      {/* ── Undo + Save ── */}
      <div className="flex gap-2">
        <button
          onClick={undo}
          disabled={undoStack.length === 0}
          title="Undo last change"
          className="px-4 py-3 bg-slate-700 text-slate-300 font-medium rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
        >
          ↩ Undo
        </button>
        <button
          onClick={save}
          disabled={!dirty || saveState === 'saving'}
          className={`flex-1 py-3 font-semibold rounded-xl transition-all ${
            dirty
              ? 'bg-sky-500 text-white hover:bg-sky-400 active:scale-95'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          } disabled:opacity-60`}
        >
          {saveLabel}
        </button>
      </div>

      {dirty && saveState === 'idle' && (
        <p className="text-xs text-center text-slate-500">Unsaved changes</p>
      )}
    </div>
  )
}
