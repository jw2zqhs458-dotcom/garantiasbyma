// Excel export using SheetJS (xlsx)
import * as XLSX from 'xlsx'
import { USD_SPECIES, ARS_SPECIES } from '../data/species'

export function exportToExcel(rows, mode, prices) {
  const currency = mode === 'USD' ? 'USD' : 'ARS'
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-AR')
  const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  // Build worksheet data
  const header = [
    'Especie', 'Descripción', 'Tipo', 'Circular', 'Lista', 'Cód. CVSA',
    'Cantidad', `Precio ${currency}`, 'Tipo Precio', 'Aforo', `Valor Bruto ${currency}`, `Garantía ${currency}`
  ]

  const data = rows.map(r => {
    const p = prices[r.s] || 0
    const bruto = r.b100 ? p * r.cant / 100 : p * r.cant
    const garantia = bruto * r.aforo
    return [
      r.s,
      r.desc,
      r.tipo,
      `Circular N°${r.circular === 'USD' ? '3567' : '3572'}`,
      r.lista,
      r.cod,
      r.cant,
      p,
      r.b100 ? 'c/100 VN' : 'x unidad',
      `${Math.round(r.aforo * 100)}%`,
      Math.round(bruto * 100) / 100,
      Math.round(garantia * 100) / 100,
    ]
  })

  // Summary row
  const totalBruto = rows.reduce((s, r) => {
    const p = prices[r.s] || 0
    return s + (r.b100 ? p * r.cant / 100 : p * r.cant)
  }, 0)
  const totalGarantia = rows.reduce((s, r) => {
    const p = prices[r.s] || 0
    const b = r.b100 ? p * r.cant / 100 : p * r.cant
    return s + b * r.aforo
  }, 0)
  const haircut = totalBruto > 0 ? ((1 - totalGarantia / totalBruto) * 100).toFixed(1) : 0

  const ws_data = [
    [`Calculadora de Garantías BYMA — Circular N°${mode === 'USD' ? '3567' : '3572'}`],
    [`Generado: ${dateStr} ${timeStr}`],
    [`Moneda: ${currency}`],
    [],
    header,
    ...data,
    [],
    ['RESUMEN'],
    [`Valor bruto total`, '', '', '', '', '', '', '', '', '', Math.round(totalBruto * 100) / 100, ''],
    [`Garantía disponible`, '', '', '', '', '', '', '', '', '', '', Math.round(totalGarantia * 100) / 100],
    [`Haircut promedio ponderado`, '', '', '', '', '', '', '', '', `${haircut}%`, '', ''],
  ]

  const ws = XLSX.utils.aoa_to_sheet(ws_data)

  // Column widths
  ws['!cols'] = [
    { wch: 10 }, { wch: 35 }, { wch: 16 }, { wch: 20 }, { wch: 8 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 8 },
    { wch: 18 }, { wch: 18 }
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Garantías')

  // Second sheet: full species list
  const listHeader = ['Especie', 'Descripción', 'Tipo', 'Lista', 'Aforo', 'Margen', 'Cod. CVSA']
  const speciesList = mode === 'USD' ? USD_SPECIES : ARS_SPECIES
  const listData = speciesList.map(s => [
    s.s, s.desc, s.tipo, s.lista,
    `${Math.round(s.aforo * 100)}%`,
    `${Math.round((1 - s.aforo) * 100)}%`,
    s.cod
  ])
  const ws2 = XLSX.utils.aoa_to_sheet([listHeader, ...listData])
  ws2['!cols'] = [{ wch: 10 }, { wch: 40 }, { wch: 16 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Especies Elegibles')

  const filename = `garantias_byma_${mode.toLowerCase()}_${now.toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
}
