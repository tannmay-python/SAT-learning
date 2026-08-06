import type { ReactNode } from 'react'
import { Link, useLocation } from 'wouter'
import { GearSix, Moon, Sun } from '@phosphor-icons/react'
import { useAppState } from '../state/AppState'

const navigation = [
  { to: '/', label: 'Today', end: true },
  { to: '/learn', label: 'Learn' },
  { to: '/practice', label: 'Practice' },
  { to: '/mocks', label: 'Mocks' },
  { to: '/insights', label: 'Analysis' },
  { to: '/mistakes', label: 'Mistakes' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { settings, updateSettings, aiStatus } = useAppState()
  const [location] = useLocation()
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const analystLabel = aiStatus.state === 'working' ? 'Analysing' : aiStatus.queued ? `${aiStatus.queued} queued` : aiStatus.available ? 'Analyst ready' : 'Analyst offline'

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="SATLAS home"><span>S</span>SATLAS</Link>
          <nav className="top-nav" aria-label="Primary navigation">
            {navigation.map(({ to, label, end }) => {
              const active = end ? location === to : location.startsWith(to)
              return <Link key={to} href={to} className={active ? 'active' : ''}>{label}</Link>
            })}
          </nav>
          <div className="header-tools">
            <span className={`analyst-pill ${aiStatus.state}`}><i />{analystLabel}</span>
            <button className="icon-button" aria-label={dark ? 'Use light theme' : 'Use dark theme'} onClick={() => void updateSettings({ theme: dark ? 'light' : 'dark' })}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
            <Link href="/settings" className={`icon-button ${location === '/settings' ? 'active' : ''}`} aria-label="Settings"><GearSix size={18} /></Link>
          </div>
        </div>
      </header>
      <main className="page-wrap">{children}</main>
    </div>
  )
}
