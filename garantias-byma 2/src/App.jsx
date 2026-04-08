import { useState, useMemo, useCallback } from 'react'
import { USD_SPECIES, ARS_SPECIES } from './data/species'
import { usePrices } from './hooks/usePrices'
import './App.css'
import * as XLSX from 'xlsx'

const TIPOS = ['Título Público', 'ON', 'LECAP', 'Acción', 'CEDEAR', 'FCI']
const LISTAS = ['0', '1', '2', '3', '4', '5', '6', '7', '—']

function fmt(n, dec = 2) {
  if (isNaN(n) || n === 0) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function ListaBadge({ lista }) {
  const colors = {
    '0': '#1a6ef5', '1': '#16a34a', '2': '#d97706',
    '3': '#dc2626', '4': '#7c3aed', '5': '#0891b2',
    '6': '#be185d', '7': '#78716c', '—': '#6b7280'
  }
  return (
    <span className="lista-badge" style={{ background: colors[lista] + '20', color: colors[lista], border: `1px solid ${colors[lista]}40` }}>
      {lista === '—' ? '—' : `L${lista}`}
    </span>
  )
}

export default function App() {
  const [mode, setMode] = useState('USD')
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterLista, setFilterLista] = useState('')
  const [cart, setCart] = useState([]) // [{...species, cant}]
  const [selectedSpecies, setSelectedSpecies] = useState('')
  const [cantInput, setCantInput] = useState('')

  const { prices, loading, lastUpdate, errors, fetchAll, updatePrice } = usePrices()

  const allSpecies = mode === 'USD' ? USD_SPECIES : ARS_SPECIES

  const filtered = useMemo(() => {
    const q = search.toUpperCase().trim()
    return allSpecies.filter(sp => {
      const matchQ = !q || sp.s.includes(q) || sp.cod.includes(q) || sp.desc.toUpperCase().includes(q)
      const matchT = !filterTipo || sp.tipo === filterTipo
      const matchL = !filterLista || sp.lista === filterLista
      return matchQ && matchT && matchL
    })
  }, [allSpecies, search, filterTipo, filterLista])

  const addToCart = useCallback(() => {
    if (!selectedSpecies) return
    const sp = allSpecies.find(s => s.s === selectedSpecies)
    if (!sp) return
    const cant = parseFloat(cantInput) || 1
    setCart(prev => {
      const existing = prev.findIndex(r => r.s === sp.s)
      if (existing >= 0) {
        const next = [...prev]
        next[existing] = { ...next[existing], cant: next[existing].cant + cant }
        return next
      }
      return [...prev, { ...sp, cant }]
    })
    setCantInput('')
    setSelectedSpecies('')
  }, [selectedSpecies, cantInput, allSpecies])

  const removeFromCart = useCallback((ticker) => {
    setCart(prev => prev.filter(r => r.s !== ticker))
  }, [])

  const updateCant = useCallback((ticker, val) => {
    setCart(prev => prev.map(r => r.s === ticker ? { ...r, cant: parseFloat(val) || 0 } : r))
  }, [])

  const summary = useMemo(() => {
    let bruto = 0, garantia = 0
    cart.forEach(r => {
      const p = prices[r.s] || 0
      const b = r.b100 ? p * r.cant / 100 : p * r.cant
      bruto += b
      garantia += b * r.aforo
    })
    const haircut = bruto > 0 ? (1 - garantia / bruto) * 100 : 0
    return { bruto, garantia, haircut }
  }, [cart, prices])

  const currency = mode === 'USD' ? 'USD' : '$'

  const handleFetchPrices = () => {
    const tickers = cart.map(r => r.s)
    if (tickers.length > 0) fetchAll(tickers)
  }

  const handleExport = () => {
    if (cart.length === 0) return
    const now = new Date()
    const header = [
      'Especie', 'Descripción', 'Tipo', 'Lista', 'Cód. CVSA',
      'Cantidad', `Precio ${currency}`, 'Tipo Precio', 'Aforo %', `Valor Bruto ${currency}`, `Garantía ${currency}`
    ]
    const rows = cart.map(r => {
      const p = prices[r.s] || 0
      const b = r.b100 ? p * r.cant / 100 : p * r.cant
      const g = b * r.aforo
      return [r.s, r.desc, r.tipo, r.lista, r.cod, r.cant, p,
        r.b100 ? 'c/100 VN' : 'x unidad',
        Math.round(r.aforo * 100),
        Math.round(b * 100) / 100,
        Math.round(g * 100) / 100
      ]
    })
    rows.push([])
    rows.push(['TOTAL', '', '', '', '', '', '', '', '', Math.round(summary.bruto * 100) / 100, Math.round(summary.garantia * 100) / 100])
    rows.push(['Haircut prom. pond.', '', '', '', '', '', '', '', `${summary.haircut.toFixed(1)}%`, '', ''])

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    ws['!cols'] = [
      {wch:10},{wch:36},{wch:16},{wch:7},{wch:10},
      {wch:12},{wch:14},{wch:12},{wch:8},{wch:18},{wch:18}
    ]

    // Species reference sheet
    const refHeader = ['Especie','Descripción','Tipo','Lista','Aforo','Margen','Cód. CVSA']
    const refRows = allSpecies.map(s => [
      s.s, s.desc, s.tipo, s.lista,
      `${Math.round(s.aforo*100)}%`,
      `${Math.round((1-s.aforo)*100)}%`,
      s.cod
    ])
    const ws2 = XLSX.utils.aoa_to_sheet([refHeader, ...refRows])
    ws2['!cols'] = [{wch:10},{wch:40},{wch:16},{wch:8},{wch:8},{wch:8},{wch:10}]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Garantías')
    XLSX.utils.book_append_sheet(wb, ws2, `Especies Elegibles (${mode})`)

    const circ = mode === 'USD' ? '3567' : '3572'
    XLSX.writeFile(wb, `garantias_byma_circ${circ}_${now.toISOString().slice(0,10)}.xlsx`)
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo-mark">BYMA</div>
          <div>
            <h1>Calculadora de Garantías</h1>
            <p className="subtitle">Circulares N°3567 (USD) · N°3572 (Pesos) · Vigencia 1/4/2026</p>
          </div>
        </div>
        <div className="header-right">
          <div className="mode-toggle">
            <button className={mode === 'USD' ? 'active' : ''} onClick={() => { setMode('USD'); setCart([]); setSearch('') }}>
              USD · Circ. 3567
            </button>
            <button className={mode === 'ARS' ? 'active' : ''} onClick={() => { setMode('ARS'); setCart([]); setSearch('') }}>
              Pesos · Circ. 3572
            </button>
          </div>
        </div>
      </header>

      <div className="main-layout">
        {/* LEFT: Search + Species catalog */}
        <aside className="sidebar">
          <div className="search-box">
            <input
              type="text"
              placeholder="Buscar ticker, código o nombre…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filters-row">
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="filter-sel">
              <option value="">Todos los tipos</option>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterLista} onChange={e => setFilterLista(e.target.value)} className="filter-sel">
              <option value="">Todas las listas</option>
              {['0','1','2','3','4','5','6','7','—'].map(l => (
                <option key={l} value={l}>{l === '—' ? 'Sin lista' : `Lista ${l}`}</option>
              ))}
            </select>
          </div>
          <div className="species-count">{filtered.length} especie{filtered.length !== 1 ? 's' : ''}</div>
          <div className="species-list">
            {filtered.map(sp => (
              <div
                key={`${sp.s}-${sp.circular}`}
                className={`species-item ${selectedSpecies === sp.s ? 'selected' : ''}`}
                onClick={() => setSelectedSpecies(sp.s === selectedSpecies ? '' : sp.s)}
              >
                <div className="species-item-left">
                  <span className="species-ticker">{sp.s}</span>
                  <span className="species-tipo">{sp.tipo}</span>
                </div>
                <div className="species-item-right">
                  <ListaBadge lista={sp.lista} />
                  <span className="species-aforo">{Math.round(sp.aforo * 100)}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Add to cart panel */}
          <div className="add-panel">
            <div className="add-panel-selected">
              {selectedSpecies
                ? <span className="add-selected-label">{selectedSpecies} seleccionado</span>
                : <span className="add-placeholder">← Seleccioná una especie</span>
              }
            </div>
            <div className="add-row">
              <input
                type="number"
                className="cant-input"
                placeholder="Cantidad"
                value={cantInput}
                onChange={e => setCantInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addToCart()}
                min="0"
                step="1"
              />
              <button className="btn-add" onClick={addToCart} disabled={!selectedSpecies}>
                + Agregar
              </button>
            </div>
          </div>
        </aside>

        {/* RIGHT: Calculator */}
        <main className="calculator">
          {/* Summary cards */}
          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-label">Valor bruto</div>
              <div className="summary-value">{currency} {fmt(summary.bruto)}</div>
              <div className="summary-sub">sin aforo</div>
            </div>
            <div className="summary-card accent">
              <div className="summary-label">Garantía disponible</div>
              <div className="summary-value">{currency} {fmt(summary.garantia)}</div>
              <div className="summary-sub">aforos aplicados</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Haircut promedio</div>
              <div className="summary-value">{summary.bruto > 0 ? summary.haircut.toFixed(1) + '%' : '—'}</div>
              <div className="summary-sub">ponderado por valor</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Activos en cartera</div>
              <div className="summary-value">{cart.length}</div>
              <div className="summary-sub">especies</div>
            </div>
          </div>

          {/* Action bar */}
          <div className="action-bar">
            <button
              className="btn-fetch"
              onClick={handleFetchPrices}
              disabled={loading || cart.length === 0}
            >
              {loading ? '⟳ Actualizando…' : '⟳ Actualizar cotizaciones'}
            </button>
            {lastUpdate && (
              <span className="last-update">
                Última actualización: {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <button
              className="btn-export"
              onClick={handleExport}
              disabled={cart.length === 0}
            >
              ↓ Exportar Excel
            </button>
            {cart.length > 0 && (
              <button className="btn-clear" onClick={() => setCart([])}>
                Limpiar
              </button>
            )}
          </div>

          {/* Table */}
          {cart.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <p>Agregá especies desde el panel izquierdo para calcular garantías</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="calc-table">
                <thead>
                  <tr>
                    <th>Especie</th>
                    <th>Descripción</th>
                    <th>Lista</th>
                    <th>Aforo</th>
                    <th>Cantidad</th>
                    <th>Precio {currency} <span className="th-sub">{mode === 'USD' ? 'c/100 VN ó x u.' : 'c/100 VN ó x u.'}</span></th>
                    <th>Valor bruto</th>
                    <th>Garantía</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(r => {
                    const p = prices[r.s] || 0
                    const b = r.b100 ? p * r.cant / 100 : p * r.cant
                    const g = b * r.aforo
                    const hasErr = errors[r.s]
                    return (
                      <tr key={r.s}>
                        <td>
                          <div className="ticker-cell">
                            <span className="ticker">{r.s}</span>
                            <span className="tipo-tag">{r.tipo}</span>
                          </div>
                        </td>
                        <td className="desc-cell">{r.desc}</td>
                        <td><ListaBadge lista={r.lista} /></td>
                        <td className="aforo-cell">{Math.round(r.aforo * 100)}%</td>
                        <td>
                          <input
                            type="number"
                            className="table-input"
                            value={r.cant}
                            min="0"
                            step="1"
                            onChange={e => updateCant(r.s, e.target.value)}
                          />
                        </td>
                        <td>
                          <div className="price-cell-wrap">
                            <input
                              type="number"
                              className={`table-input price-input ${hasErr ? 'price-err' : ''}`}
                              value={p || ''}
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              onChange={e => updatePrice(r.s, e.target.value)}
                            />
                            <span className="price-hint">{r.b100 ? 'c/100VN' : 'x u.'}</span>
                          </div>
                        </td>
                        <td className="num-cell">
                          {p > 0 ? `${currency} ${fmt(b)}` : '—'}
                        </td>
                        <td className="garantia-cell">
                          {p > 0 ? `${currency} ${fmt(g)}` : '—'}
                        </td>
                        <td>
                          <button className="btn-remove" onClick={() => removeFromCart(r.s)}>×</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td colSpan={6}><strong>TOTAL</strong></td>
                    <td className="num-cell"><strong>{currency} {fmt(summary.bruto)}</strong></td>
                    <td className="garantia-cell"><strong>{currency} {fmt(summary.garantia)}</strong></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Notes */}
          <div className="notes">
            <div className="note">
              <strong>Bonos/ONs:</strong> precio expresado cada USD 100 de VN → garantía = precio × cantidad / 100 × aforo.
            </div>
            <div className="note">
              <strong>Acciones/CEDEARs:</strong> precio por unidad (especie D) → garantía = precio × cantidad × aforo.
            </div>
            <div className="note warn">
              Los cupos máximos por especie no se verifican en esta calculadora. Consultá la circular vigente antes de operar.
            </div>
          </div>
        </main>
      </div>

      <footer className="app-footer">
        <span>Calculadora Garantías BYMA · Circ. N°3567/3572 · 1/4/2026</span>
        <span>Precios referenciales — verificar en broker antes de operar</span>
      </footer>
    </div>
  )
}
