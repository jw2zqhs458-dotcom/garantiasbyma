import { useState, useCallback } from 'react'

// IOL public quotes endpoint (no auth needed for last price)
// Falls back to PPI scraping via CORS proxy
const CORS = 'https://corsproxy.io/?'
const IOL_BASE = 'https://api.invertironline.com/api/v2'

// Known reference prices (updated manually as fallback)
const FALLBACK_PRICES = {
  // Bonos soberanos (precio c/100 VN, especie D)
  AL30: 61.45, GD35: 72.10, GD30: 64.20, GD38: 74.68, GD41: 71.50,
  AL29: 61.94, AL35: 74.62, AL41: 69.15, AE38: 77.60, GD29: 62.40,
  GD46: 67.80, CO26: 99.50, AO27: 101.70, TY30P: 98.00, BPY26: 99.20,
  BPOC7: 97.50, BPOD7: 95.00, BPOB7: 98.20, T30A7: 99.00,
  // ONs (precio c/100 VN)
  BACGO: 104.50, CS48O: 100.50, CS49O: 99.80, MGCQO: 101.20,
  PLC4O: 102.00, YM40O: 101.50, YM41O: 100.80, YM42O: 99.50,
  RCCRO: 101.00, TSC3O: 103.00, TTCBO: 102.50, VSCHO: 100.00,
  TTC9O: 103.50, TTCAO: 102.00, RC1CO: 101.50, RC2CO: 100.80,
  PN40O: 101.20, PN41O: 100.90, PN42O: 100.40, PAMP: 16.20,
  // LECAPs (precio c/100 VN)
  S17A6: 100.50, D30A6: 100.80, T30J6: 101.20, TZXD6: 102.50,
  // Acciones (precio por unidad, especie D)
  GGAL: 4.55, YPFD: 19.80, BBAR: 5.04, BMA: 7.46, CEPU: 1.57,
  LOMA: 2.30, PAMP: 16.20, SUPV: 4.20, TGSU2: 8.90, TRAN: 1.85,
  VALO: 4.10, COME: 0.03, EDN: 1.46, METR: 3.52, TXAR: 12.40,
  ALUA: 0.57, CRES: 1.21, ECOG: 0.85, TGNO4: 1.85, IRSA: 1.57,
  TECO2: 2.10,
  // CEDEARs (precio por unidad, especie D)
  AAPL: 198.50, MSFT: 365.20, NVDA: 880.00, AMZN: 190.40, META: 480.00,
  GOOG: 155.30, TSLA: 265.00, MELI: 78.30, VIST: 27.40, JPM: 240.00,
  GS: 510.00, SPY: 495.00, QQQ: 420.00, BRKB: 455.00, AVGO: 185.00,
  LLY: 750.00, V: 280.00, MA: 510.00, NFLX: 920.00, AMD: 95.00,
  COIN: 175.00, PLTR: 76.00, GLD: 225.00, IBIT: 52.00, ETHA: 22.00,
  MSTR: 285.00, XOM: 108.00, CVX: 152.00, VALE: 8.50, TQQQ: 38.00,
  SPXL: 95.00, GLOB: 100.00, BABA: 105.00, UBER: 68.00, WMT: 92.00,
  COST: 910.00, UNH: 462.00, EWZ: 25.00, IWM: 192.00, EEM: 38.00,
}

export function usePrices() {
  const [prices, setPrices] = useState({ ...FALLBACK_PRICES })
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [errors, setErrors] = useState({})

  const fetchPriceIOL = useCallback(async (ticker) => {
    try {
      // IOL endpoint: last known price for Argentine market
      const url = `${CORS}${encodeURIComponent(`${IOL_BASE}/cotizaciones/acciones/merval/ultima/${ticker}`)}`
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // IOL returns { ultimoPrecio, simbolo, ... }
      const price = data?.ultimoPrecio ?? data?.precio ?? data?.last
      if (price && !isNaN(price)) return parseFloat(price)
    } catch {
      // silent
    }
    return null
  }, [])

  const fetchAll = useCallback(async (tickers) => {
    setLoading(true)
    setErrors({})
    const newPrices = { ...FALLBACK_PRICES }
    const newErrors = {}

    // Batch fetch with concurrency limit
    const BATCH = 5
    const unique = [...new Set(tickers)]
    for (let i = 0; i < unique.length; i += BATCH) {
      const batch = unique.slice(i, i + BATCH)
      await Promise.all(batch.map(async (ticker) => {
        const p = await fetchPriceIOL(ticker)
        if (p !== null) {
          newPrices[ticker] = p
        } else {
          newErrors[ticker] = true
        }
      }))
    }

    setPrices(newPrices)
    setErrors(newErrors)
    setLastUpdate(new Date())
    setLoading(false)
  }, [fetchPriceIOL])

  const updatePrice = useCallback((ticker, value) => {
    setPrices(prev => ({ ...prev, [ticker]: parseFloat(value) || 0 }))
  }, [])

  return { prices, loading, lastUpdate, errors, fetchAll, updatePrice }
}
