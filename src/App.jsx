import { useState, useMemo, useCallback } from 'react'
import { SPECIES, TIPOS, VIGENCIA } from './data/species'
import { usePrices } from './hooks/usePrices'
import './App.css'
import * as XLSX from 'xlsx'

function fmt(n, dec = 2) {
  if (isNaN(n) || n === 0) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function TipoBadge({ tipo }) {
  const colors = {
    'Título Público': { bg: '#1a6ef520', color: '#1a6ef5', border: '#1a6ef540' },
    'ON':             { bg: '#16a34a20', color: '#16a34a', border: '#16a34a40' },
    'LECAP':          { bg: '#d9770620', color: '#d97706', border: '#d9770640' },
    'Acción':         { bg: '#dc262620', color: '#dc2626', border: '#dc262640' },
    'CEDEAR':         { bg: '#7c3aed20', color: '#7c3aed', border: '#7c3aed40' },
    'FCI':            { bg: '#0891b220', color: '#0891b2', border: '#0891b240' },
  }
  const c = colors[tipo] || { bg: '#6b728020', color: '#6b7280', border: '#6b728040' }
  return (
    <span className="lista-badge" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {tipo === 'Título Público' ? 'T.Pub.' : tipo}
    </span>
  )
}

export default function App() {
  const [search, setSearch]            = useState('')
  const [filterTipo, setFilterTipo]    = useState('')
  const [cart, setCart]                = useState([])
  const [selectedSpecies, setSelected] = useState('')
  const [cantInput, setCantInput]      = useState('')

  const { prices, loading, lastUpdate, errors, fetchAll, updatePrice } = usePrices()

  const filtered = useMemo(() => {
    const q = search.toUpperCase().trim()
    return SPECIES.filter(sp => {
      const matchQ = !q || sp.s.includes(q) || sp.cod.includes(q) || sp.desc.toUpperCase().includes(q)
      const matchT = !filterTipo || sp.tipo === filterTipo
      return matchQ && matchT
    })
  }, [search, filterTipo])

  const addToCart = useCallback(() => {
    if (!selectedSpecies) return
    const sp = SPECIES.find(s => s.s === selectedSpecies)
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
    setSelected('')
  }, [selectedSpecies, cantInput])

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
      bruto    += b
      garantia += b * r.aforo
    })
    const haircut = bruto > 0 ? (1 - garantia / bruto) * 100 : 0
    return { bruto, garantia, haircut }
  }, [cart, prices])

  const handleFetchPrices = () => {
    const tickers = cart.map(r => r.s)
    if (tickers.length > 0) fetchAll(tickers)
  }

  const handleExport = () => {
    if (cart.length === 0) return
    const now = new Date()
    const header = ['Especie','Descripción','Tipo','Cód. CVSA','Cantidad','Precio','Tipo Precio','Aforo %','Valor Bruto','Garantía']
    const rows = cart.map(r => {
      const p = prices[r.s] || 0
      const b = r.b100 ? p * r.cant / 100 : p * r.cant
      const g = b * r.aforo
      return [r.s, r.desc, r.tipo, r.cod, r.cant, p, r.b100 ? 'c/100 VN' : 'x unidad',
        Math.round(r.aforo * 100), Math.round(b * 100) / 100, Math.round(g * 100) / 100]
    })
    rows.push([])
    rows.push(['TOTAL','','','','','','','', Math.round(summary.bruto*100)/100, Math.round(summary.garantia*100)/100])
    rows.push(['Haircut prom. pond.','','','','','','',`${summary.haircut.toFixed(1)}%`,'',''])

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    ws['!cols'] = [{wch:10},{wch:36},{wch:16},{wch:10},{wch:12},{wch:12},{wch:12},{wch:8},{wch:16},{wch:16}]

    const refHeader = ['Especie','Descripción','Tipo','Aforo','Margen','Cód. CVSA']
    const refRows = SPECIES.map(s => [s.s, s.desc, s.tipo, `${Math.round(s.aforo*100)}%`, `${Math.round((1-s.aforo)*100)}%`, s.cod])
    const ws2 = XLSX.utils.aoa_to_sheet([refHeader, ...refRows])
    ws2['!cols'] = [{wch:10},{wch:40},{wch:16},{wch:8},{wch:8},{wch:10}]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Garantías')
    XLSX.utils.book_append_sheet(wb, ws2, 'Especies Elegibles')
    XLSX.writeFile(wb, `garantias_byma_${now.toISOString().slice(0,10)}.xlsx`)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="logo-mark">BYMA</div>
          <div>
            <h1>Calculadora de Garantías</h1>
            <p className="subtitle">Circular N°3572 · Lista única ARS/USD · Vigencia {VIGENCIA}</p>
          </div>
        </div>
        <div className="header-right">
          <span className="vigencia-badge">Circ. 3572 · {VIGENCIA}</span>
        </div>
      </header>

      <div className="main-layout">
        <aside className="sidebar">
          <div className="search-box">
            <input type="text" placeholder="Buscar ticker, código o nombre…"
              value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
          </div>
          <div className="filters-row">
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="filter-sel">
              <option value="">Todos los tipos</option>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="species-count">{filtered.length} especie{filtered.length !== 1 ? 's' : ''}</div>

          <div className="species-list">
            {filtered.map(sp => (
              <div key={sp.s}
                className={`species-item ${selectedSpecies === sp.s ? 'selected' : ''}`}
                onClick={() => setSelected(sp.s === selectedSpecies ? '' : sp.s)}
              >
                <div className="species-item-left">
                  <span className="species-ticker">{sp.s}</span>
                  <span className="species-tipo">{sp.desc.slice(0, 28)}</span>
                </div>
                <div className="species-item-right">
                  <TipoBadge tipo={sp.tipo} />
                  <span className="species-aforo">{Math.round(sp.aforo * 100)}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="add-panel">
            <div className="add-panel-selected">
              {selectedSpecies
                ? <span className="add-selected-label">{selectedSpecies} seleccionado</span>
                : <span className="add-placeholder">← Seleccioná una especie</span>}
            </div>
            <div className="add-row">
              <input type="number" className="cant-input" placeholder="Cantidad"
                value={cantInput} onChange={e => setCantInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addToCart()} min="0" step="1" />
              <button className="btn-add" onClick={addToCart} disabled={!selectedSpecies}>+ Agregar</button>
            </div>
          </div>
        </aside>

        <main className="calculator">
          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-label">Valor bruto</div>
              <div className="summary-value">USD {fmt(summary.bruto)}</div>
              <div className="summary-sub">sin aforo</div>
            </div>
            <div className="summary-card accent">
              <div className="summary-label">Garantía disponible</div>
              <div className="summary-value">USD {fmt(summary.garantia)}</div>
              <div className="summary-sub">aforos aplicados</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Haircut promedio</div>
              <div className="summary-value">{summary.bruto > 0 ? summary.haircut.toFixed(1) + '%' : '—'}</div>
              <div className="summary-sub">ponderado por valor</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Activos</div>
              <div className="summary-value">{cart.length}</div>
              <div className="summary-sub">especies en cartera</div>
            </div>
          </div>

          <div className="action-bar">
            <button className="btn-fetch" onClick={handleFetchPrices} disabled={loading || cart.length === 0}>
              {loading ? '⟳ Actualizando…' : '⟳ Actualizar cotizaciones'}
            </button>
            {lastUpdate && (
              <span className="last-update">
                Actualizado: {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <button className="btn-export" onClick={handleExport} disabled={cart.length === 0}>↓ Exportar Excel</button>
            {cart.length > 0 && <button className="btn-clear" onClick={() => setCart([])}>Limpiar</button>}
          </div>

          {cart.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <p>Seleccioná especies del panel izquierdo para calcular garantías</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="calc-table">
                <thead>
                  <tr>
                    <th>Especie</th><th>Descripción</th><th>Tipo</th><th>Aforo</th>
                    <th>Cantidad</th>
                    <th>Precio <span className="th-sub">c/100VN ó x u.</span></th>
                    <th>Valor bruto</th><th>Garantía</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(r => {
                    const p = prices[r.s] || 0
                    const b = r.b100 ? p * r.cant / 100 : p * r.cant
                    const g = b * r.aforo
                    return (
                      <tr key={r.s}>
                        <td><div className="ticker-cell"><span className="ticker">{r.s}</span></div></td>
                        <td className="desc-cell">{r.desc}</td>
                        <td><TipoBadge tipo={r.tipo} /></td>
                        <td className="aforo-cell">{Math.round(r.aforo * 100)}%</td>
                        <td>
                          <input type="number" className="table-input" value={r.cant}
                            min="0" step="1" onChange={e => updateCant(r.s, e.target.value)} />
                        </td>
                        <td>
                          <div className="price-cell-wrap">
                            <input type="number"
                              className={`table-input price-input ${errors[r.s] ? 'price-err' : ''}`}
                              value={p || ''} min="0" step="0.0001" placeholder="0.00"
                              onChange={e => updatePrice(r.s, e.target.value)} />
                            <span className="price-hint">{r.b100 ? 'c/100VN' : 'x u.'}</span>
                          </div>
                        </td>
                        <td className="num-cell">{p > 0 ? `USD ${fmt(b)}` : '—'}</td>
                        <td className="garantia-cell">{p > 0 ? `USD ${fmt(g)}` : '—'}</td>
                        <td><button className="btn-remove" onClick={() => removeFromCart(r.s)}>×</button></td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td colSpan={6}><strong>TOTAL</strong></td>
                    <td className="num-cell"><strong>USD {fmt(summary.bruto)}</strong></td>
                    <td className="garantia-cell"><strong>USD {fmt(summary.garantia)}</strong></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="notes">
            <div className="note"><strong>Bonos/ONs/LECAPs:</strong> precio cada 100 VN → garantía = precio × cantidad / 100 × aforo.</div>
            <div className="note"><strong>Acciones/CEDEARs:</strong> precio por unidad → garantía = precio × cantidad × aforo.</div>
            <div className="note warn">Calculadora de uso informativo. Verificar aforos y precios vigentes antes de operar.</div>
          </div>
        </main>
      </div>

      <footer className="app-footer">
        <span>Calculadora Garantías BYMA · Circular N°3572 · {VIGENCIA}</span>
        <span>Precios referenciales — verificar en broker antes de operar</span>
      </footer>
    </div>
  )
}
