export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// minúsculas y sin acentos, para buscar
export const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function parseFecha(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const mesAnio = (iso: string) => { const [y, m] = iso.split('-').map(Number); return `${MESES[m - 1]} ${y}` }
export const fechaLarga = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MESES[m - 1]} ${y}` }
export const fechaNum = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d}/${m}/${y}` }
export const hoyISO = () => {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
}

// Un lugar sin ninguna fecha cargada no cuenta como desactualizado: simplemente no tiene datos nuestros.
export function esDesactualizado(ultima: string | null, meses: number, hoy = new Date()): boolean {
  if (!ultima) return false
  const limite = new Date(hoy.getFullYear(), hoy.getMonth() - meses, hoy.getDate())
  return parseFecha(ultima) < limite
}

export const telHref = (t: string) => 'tel:' + t.replace(/[^\d+]/g, '')
export const waHref = (t: string) => 'https://wa.me/' + t.replace(/\D/g, '')
export const esUrl = (s: string) => /^https?:\/\//.test(s)

export const distanciaKm = (a: [number, number], b: [number, number]) => {
  const t = (x: number) => (x * Math.PI) / 180
  const dLat = t(b[0] - a[0]), dLon = t(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a[0])) * Math.cos(t(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
export const formatKm = (km: number) => (km < 1 ? `a ${Math.round(km * 10) * 100} m` : `a ${km.toFixed(1).replace('.', ',')} km`)
