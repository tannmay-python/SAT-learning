import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowsOutCardinal, Calculator, FileText, MagnifyingGlassMinus, MagnifyingGlassPlus, X } from '@phosphor-icons/react'

type Tool = 'calculator' | 'reference'
type CalculatorMode = 'scientific' | 'graphing'

interface MathToolsProps {
  className?: string
}

const DESMOS_URLS: Record<CalculatorMode, string> = {
  scientific: 'https://www.desmos.com/testing/collegeboard/scientific',
  graphing: 'https://www.desmos.com/testing/collegeboard/graphing',
}

function Diagram({ kind }: { kind: 'circle' | 'rectangle' | 'triangle' | 'pythagorean' | 'special' | 'prism' | 'cylinder' | 'sphere' | 'cone' | 'pyramid' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (kind === 'circle') return <svg viewBox="0 0 130 82" aria-hidden="true"><circle cx="64" cy="40" r="29" {...common} /><circle cx="64" cy="40" r="2.7" fill="currentColor" /><line x1="64" y1="40" x2="93" y2="40" {...common} /><text x="78" y="35">r</text></svg>
  if (kind === 'rectangle') return <svg viewBox="0 0 130 82" aria-hidden="true"><rect x="22" y="20" width="82" height="43" {...common} /><text x="61" y="16">ℓ</text><text x="108" y="45">w</text></svg>
  if (kind === 'triangle') return <svg viewBox="0 0 130 82" aria-hidden="true"><path d="M20 65 L64 12 L110 65 Z" {...common} /><line x1="64" y1="12" x2="64" y2="65" {...common} /><path d="M64 55 h10 v10" {...common} /><text x="69" y="39">h</text><text x="61" y="78">b</text></svg>
  if (kind === 'pythagorean') return <svg viewBox="0 0 130 82" aria-hidden="true"><path d="M20 65 L20 15 L109 65 Z" {...common} /><path d="M20 55 h10 v10" {...common} /><text x="10" y="41">b</text><text x="62" y="78">a</text><text x="66" y="34">c</text></svg>
  if (kind === 'special') return <svg viewBox="0 0 235 82" aria-hidden="true"><path d="M5 67 L112 67 L112 14 Z" {...common} /><path d="M102 67 v-10 h10" {...common} /><text x="33" y="60">30°</text><text x="85" y="28">60°</text><text x="112" y="47">x</text><text x="43" y="79">x√3</text><text x="48" y="32">2x</text><path d="M145 67 L145 12 L218 67 Z" {...common} /><path d="M145 57 h10 v10" {...common} /><text x="149" y="31">45°</text><text x="190" y="62">45°</text><text x="135" y="45">s</text><text x="176" y="79">s</text><text x="181" y="31">s√2</text></svg>
  if (kind === 'prism') return <svg viewBox="0 0 130 82" aria-hidden="true"><path d="M18 29 h72 v39 H18 Z M90 29 l21-15 v39 L90 68 M18 29 l21-15 h72" {...common} /><text x="55" y="80">ℓ</text><text x="100" y="68">w</text><text x="115" y="39">h</text></svg>
  if (kind === 'cylinder') return <svg viewBox="0 0 130 82" aria-hidden="true"><ellipse cx="61" cy="20" rx="38" ry="12" {...common} /><path d="M23 20 v43 c0 7 17 12 38 12s38-5 38-12V20" {...common} /><ellipse cx="61" cy="63" rx="38" ry="12" {...common} /><circle cx="61" cy="20" r="2.7" fill="currentColor" /><line x1="61" y1="20" x2="88" y2="12" {...common} /><text x="76" y="14">r</text><text x="104" y="47">h</text></svg>
  if (kind === 'sphere') return <svg viewBox="0 0 130 82" aria-hidden="true"><circle cx="62" cy="41" r="34" {...common} /><path d="M28 41 c9-15 59-15 68 0 c-9 15-59 15-68 0" {...common} strokeDasharray="5 4" /><path d="M28 41 c9 14 59 14 68 0" {...common} /><circle cx="62" cy="41" r="2.7" fill="currentColor" /><line x1="62" y1="41" x2="90" y2="41" {...common} /><text x="77" y="36">r</text></svg>
  if (kind === 'cone') return <svg viewBox="0 0 130 82" aria-hidden="true"><path d="M63 6 L22 66 M63 6 L104 66" {...common} /><path d="M22 66 c8-12 74-12 82 0 c-8 12-74 12-82 0" {...common} /><path d="M22 66 c8 12 74 12 82 0" {...common} strokeDasharray="5 4" /><line x1="63" y1="6" x2="63" y2="66" {...common} /><line x1="63" y1="66" x2="95" y2="66" {...common} /><path d="M63 56 h10 v10" {...common} /><text x="68" y="39">h</text><text x="79" y="62">r</text></svg>
  return <svg viewBox="0 0 130 82" aria-hidden="true"><path d="M64 7 L17 66 L88 66 Z M64 7 L113 55 L88 66 M17 66 L45 50 L113 55 M64 7 L45 50" {...common} /><path d="M45 50 L88 66" {...common} strokeDasharray="5 4" /><line x1="64" y1="7" x2="64" y2="59" {...common} strokeDasharray="5 4" /><path d="M64 50 h9 v9" {...common} /><text x="69" y="39">h</text><text x="47" y="79">ℓ</text><text x="98" y="69">w</text></svg>
}

interface FormulaProps {
  kind: Parameters<typeof Diagram>[0]['kind']
  label: string
  formula: React.ReactNode
  wide?: boolean
}

function Formula({ kind, label, formula, wide = false }: FormulaProps) {
  return <figure className={`reference-formula ${wide ? 'wide' : ''}`} aria-label={label}><Diagram kind={kind} /><figcaption>{formula}</figcaption></figure>
}

export function SatReferenceSheet({ scale = 1, compact = false }: { scale?: number; compact?: boolean }) {
  return (
    <div className="reference-viewport">
      <section className={`sat-reference-sheet ${compact ? 'compact-sheet' : ''}`} style={{ transform: `scale(${scale})`, width: `${100 / scale}%` }} aria-label="SAT Math reference sheet">
        <span className="reference-label">REFERENCE</span>
        <div className="reference-formula-grid plane-formulas">
          <Formula kind="circle" label="Circle area and circumference" formula={<><span>A = πr<sup>2</sup></span><span>C = 2πr</span></>} />
          <Formula kind="rectangle" label="Rectangle area" formula={<span>A = ℓw</span>} />
          <Formula kind="triangle" label="Triangle area" formula={<span>A = <span className="stacked-fraction"><i>1</i><i>2</i></span>bh</span>} />
          <Formula kind="pythagorean" label="Pythagorean theorem" formula={<span>c<sup>2</sup> = a<sup>2</sup> + b<sup>2</sup></span>} />
          <Formula kind="special" label="Special right triangles" wide formula={<span>Special Right Triangles</span>} />
        </div>
        <div className="reference-formula-grid solid-formulas">
          <Formula kind="prism" label="Rectangular prism volume" formula={<span>V = ℓwh</span>} />
          <Formula kind="cylinder" label="Cylinder volume" formula={<span>V = πr<sup>2</sup>h</span>} />
          <Formula kind="sphere" label="Sphere volume" formula={<span>V = <span className="stacked-fraction"><i>4</i><i>3</i></span>πr<sup>3</sup></span>} />
          <Formula kind="cone" label="Cone volume" formula={<span>V = <span className="stacked-fraction"><i>1</i><i>3</i></span>πr<sup>2</sup>h</span>} />
          <Formula kind="pyramid" label="Rectangular pyramid volume" formula={<span>V = <span className="stacked-fraction"><i>1</i><i>3</i></span>ℓwh</span>} />
        </div>
        <div className="reference-notes">
          <p>The number of degrees of arc in a circle is 360.</p>
          <p>The number of radians of arc in a circle is 2π.</p>
          <p>The sum of the measures in degrees of the angles of a triangle is 180.</p>
        </div>
      </section>
    </div>
  )
}

export function MathTools({ className = '' }: MathToolsProps) {
  const [tool, setTool] = useState<Tool | null>(null)
  const [calculatorMode, setCalculatorMode] = useState<CalculatorMode>('graphing')
  const [position, setPosition] = useState({ x: 24, y: 74 })
  const [referenceScale, setReferenceScale] = useState(1)
  const [compactReference, setCompactReference] = useState(false)
  const windowRef = useRef<HTMLElement>(null)
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)
  const positioned = useRef(false)

  const toggleTool = (next: Tool) => {
    setTool((current) => {
      if (current === next) return null
      if (!positioned.current) {
        const width = Math.min(860, window.innerWidth - 32)
        setPosition({ x: Math.max(16, window.innerWidth - width - 18), y: Math.min(78, Math.max(12, window.innerHeight * 0.08)) })
        positioned.current = true
      }
      return next
    })
  }

  useEffect(() => {
    if (!tool) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setTool(null) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tool])

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
    const rect = windowRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const drag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current || !windowRef.current) return
    const rect = windowRef.current.getBoundingClientRect()
    const x = Math.max(8, Math.min(window.innerWidth - Math.min(280, rect.width), event.clientX - dragRef.current.dx))
    const y = Math.max(8, Math.min(window.innerHeight - 90, event.clientY - dragRef.current.dy))
    setPosition({ x, y })
  }

  const stopDrag = () => { dragRef.current = null }

  return (
    <>
      <div className={`math-tool-triggers ${className}`.trim()} aria-label="Math tools">
        <button type="button" className={tool === 'calculator' ? 'active' : ''} aria-pressed={tool === 'calculator'} onClick={() => toggleTool('calculator')}><Calculator size={18} />Calculator</button>
        <button type="button" className={tool === 'reference' ? 'active' : ''} aria-pressed={tool === 'reference'} onClick={() => toggleTool('reference')}><FileText size={17} />Reference</button>
      </div>
      {tool && (
        <aside ref={windowRef} className={`math-tool-window ${tool}`} style={{ left: position.x, top: position.y }} role="dialog" aria-label={tool === 'calculator' ? 'SAT calculator' : 'SAT reference sheet'}>
          <header className="math-tool-titlebar" onPointerDown={startDrag} onPointerMove={drag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
            <span><ArrowsOutCardinal size={16} /><strong>{tool === 'calculator' ? 'Calculator' : 'Reference sheet'}</strong></span>
            {tool === 'calculator' ? (
              <div className="calculator-mode" aria-label="Calculator type">
                <button className={calculatorMode === 'scientific' ? 'active' : ''} onClick={() => setCalculatorMode('scientific')}>Scientific</button>
                <button className={calculatorMode === 'graphing' ? 'active' : ''} onClick={() => setCalculatorMode('graphing')}>Graphing</button>
              </div>
            ) : (
              <div className="reference-controls">
                <button aria-label="Zoom out" disabled={referenceScale <= 0.7} onClick={() => setReferenceScale((value) => Math.max(0.7, value - 0.1))}><MagnifyingGlassMinus size={16} /></button>
                <span>{Math.round(referenceScale * 100)}%</span>
                <button aria-label="Zoom in" disabled={referenceScale >= 1.4} onClick={() => setReferenceScale((value) => Math.min(1.4, value + 0.1))}><MagnifyingGlassPlus size={16} /></button>
                <button className={compactReference ? 'active' : ''} onClick={() => setCompactReference((value) => !value)}>Compact</button>
              </div>
            )}
            <button className="tool-close" onClick={() => setTool(null)} aria-label="Close tool"><X size={19} /></button>
          </header>
          {tool === 'calculator' ? (
            <div className="desmos-frame-stack">
              {(Object.keys(DESMOS_URLS) as CalculatorMode[]).map((mode) => <iframe key={mode} className={calculatorMode === mode ? 'active' : ''} title={`Desmos ${mode} calculator configured for College Board`} src={DESMOS_URLS[mode]} loading="eager" allow="clipboard-read; clipboard-write" />)}
            </div>
          ) : <SatReferenceSheet scale={referenceScale} compact={compactReference} />}
        </aside>
      )}
    </>
  )
}
