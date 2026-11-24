// Colores: los marcadores van todos de un mismo color (la versión pública no tiene estados) y cada decanato tiene su pastel.

export interface Nivel { id: number; color: string; relleno: 'vacio' | 'medio' | 'lleno'; tilde: boolean }
export const COLOR_MARCA = '#003c71' // el azul de la Guía diocesana
export const NIVELES: Nivel[] = [{ id: 0, color: COLOR_MARCA, relleno: 'lleno', tilde: false }]
export const NIVEL_NEUTRO: Nivel = { id: -1, color: '#475569', relleno: 'lleno', tilde: false }
export const nivelInfo = (_n: number): Nivel => NIVELES[0]

const aRgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const aHex = (c: number[]) => '#' + c.map(x => Math.round(x).toString(16).padStart(2, '0')).join('')
// mezcla de un color con un fondo (por defecto blanco)
export const mezcla = (color: string, alpha: number, fondo = '#ffffff') => {
  const [c, f] = [aRgb(color), aRgb(fondo)]
  return aHex(c.map((x, i) => x * alpha + f[i] * (1 - alpha)))
}
export const tinte = (color: string) => mezcla(color, 0.22)

// Zonas de decanato: pasteles
export interface EstiloZona { base: string; alpha: number; borde: string }
export const ZONAS: Record<string, EstiloZona> = {
  'Avellaneda Norte': { base: '#E86A92', alpha: 0.4, borde: '#B5486D' },
  'Avellaneda Sur': { base: '#F5E3A1', alpha: 0.55, borde: '#A8923E' },
  'Lanús Este': { base: '#5BAEDC', alpha: 0.4, borde: '#2F7FA8' },
  'Lanús Oeste': { base: '#6FAF3D', alpha: 0.45, borde: '#4B7F26' },
}
const RESERVA: EstiloZona[] = [
  { base: '#B0A8A0', alpha: 0.45, borde: '#6E665E' },
  { base: '#9FB8C8', alpha: 0.45, borde: '#5C7686' },
]
export function estiloZona(decanato: string, i = 0): EstiloZona {
  return ZONAS[decanato] ?? RESERVA[i % RESERVA.length]
}
// color con el que se ve la zona sobre el mapa base (para los chips del panel)
export const rellenoZona = (decanato: string, i = 0) => {
  const z = estiloZona(decanato, i)
  return mezcla(z.base, z.alpha, '#ededed')
}
