# Calculadora Garantías BYMA

Calculadora de garantías para cauciones en BYMA según:
- **Circular N°3567** — Garantías en USD
- **Circular N°3572** — Garantías en Pesos

Vigencia: 1/4/2026

## Features

- 🔍 Búsqueda y filtrado por tipo/lista
- 💱 Switch USD / Pesos (ambas circulares)
- ⟳ Actualización de cotizaciones vía API de IOL
- 📊 Cálculo automático de garantía con aforos correctos
- ↓ Exportar a Excel (.xlsx) con dos hojas: posición + nómina completa

## Stack

React + Vite + xlsx (SheetJS) · Deploy en Vercel

---

## Deploy en Vercel

### Opción 1 — GitHub + Vercel (recomendado)

1. Crear repo en GitHub y subir este código:
```bash
git init
git add .
git commit -m "init: calculadora garantias byma"
git remote add origin https://github.com/TU_USUARIO/garantias-byma.git
git push -u origin main
```

2. Ir a [vercel.com](https://vercel.com) → "New Project" → importar el repo
3. Vercel detecta Vite automáticamente. Click "Deploy"
4. ✅ Listo — URL pública en ~1 minuto

### Opción 2 — Vercel CLI

```bash
npm install -g vercel
npm install
vercel --prod
```

---

## Dev local

```bash
npm install
npm run dev
```

---

## Cómo funciona el cálculo

**Bonos y ONs** (b100 = true):
```
Garantía = Precio × Cantidad / 100 × Aforo
```
Precio expresado cada 100 VN (ej: AL30 a 61.45 = $61.45 c/100 VN)

**Acciones y CEDEARs** (b100 = false):
```
Garantía = Precio × Cantidad × Aforo
```
Precio directo por unidad (especie D en USD o ARS)

---

## Actualización de cotizaciones

El botón "Actualizar cotizaciones" intenta obtener precios via la API pública de InvertirOnline (IOL).
Si la API no responde o falla CORS, se usan los precios de referencia precargados.
Los precios siempre son editables manualmente en la tabla.

---

## Nota legal

Esta calculadora es de uso informativo. Verificar cupos máximos por especie y precios actuales en el broker antes de operar. Los aforos se actualizan según las circulares vigentes.
