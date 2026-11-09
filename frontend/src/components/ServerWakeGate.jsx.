import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, WifiOff } from 'lucide-react'
import api from '../api/client'

// Render's free tier puts the backend to sleep after ~15 min idle, and a phone app that has been
// closed for a while wakes into a cold server. Previously the "wake up" step only ran on the login
// page, so an already signed-in app (installed on iPhone/Android) fired its requests straight into
// a sleeping server and looked broken until the site was opened elsewhere.
//
// This gate checks the server whenever the app opens or comes back to the foreground. If it answers
// fast, nothing is shown. If not, a "waking up" screen appears, and once the server is really up
// the page behind it is re-mounted so it fetches fresh data.
const AWAY_MS = 3 * 60 * 1000

export default function ServerWakeGate({ children }) {
  const [show, setShow] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [secs, setSecs] = useState(0)
  const [offline, setOffline] = useState(false)
  const busy = useRef(false)
  const stop = useRef(false)
  const hiddenAt = useRef(0)

  const check = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    stop.current = false
    const started = Date.now()
    let shown = false
    while (!stop.current) {
      const ok = await api.pingServer(2500)
      if (ok) { if (shown) { setShow(false); setEpoch(e => e + 1) } break }
      if (stop.current) break
      if (!shown) { shown = true; setShow(true) }          // only after the first ping misses → no flash when awake
      setSecs(Math.round((Date.now() - started) / 1000))
      setOffline(typeof navigator !== 'undefined' && navigator.onLine === false)
      await new Promise(r => setTimeout(r, 2000))
    }
    busy.current = false
  }, [])

  useEffect(() => {
    check()
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now()
      else if (hiddenAt.current && Date.now() - hiddenAt.current > AWAY_MS) { hiddenAt.current = 0; check() }
    }
    const onBack = () => check()                              // back online, or restored from the iOS page cache
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', onBack)
    window.addEventListener('pageshow', (e) => { if (e.persisted) onBack() })
    return () => { stop.current = true; document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', onBack) }
  }, [check])

  const dismiss = () => { stop.current = true; setShow(false) }

  return (
    <>
      <Fragment key={epoch}>{children}</Fragment>
      {show && (
        <div className="fixed inset-0 flex items-center justify-center p-6" style={{ zIndex: 9998, background: 'var(--bg-primary)' }}>
          <div className="text-center max-w-sm">
            {offline
              ? <WifiOff size={40} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
              : <Loader2 size={40} className="mx-auto mb-4 animate-spin" style={{ color: 'var(--accent)' }} />}
            <h2 className="text-lg font-bold text-white mb-1">{offline ? "You're offline" : 'Waking up the server…'}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {offline
                ? 'Check your internet connection. Saved pages may still be viewable.'
                : `This happens when the app has been idle for a while and can take up to a minute. Your data is safe. ${secs}s`}
            </p>
            {(offline || secs >= 8) && (
              <button onClick={dismiss} className="btn-secondary mt-5 text-sm">Continue anyway</button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
