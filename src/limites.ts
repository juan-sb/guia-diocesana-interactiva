// Contorno de Avellaneda y Lanús, datos de la máscara semitransparente de afuera y límites de navegación.
// El contorno viene de data/geo/partidos.geojson (© OpenStreetMap contributors, ODbL, `npm run limites`), ya unido en data.json.
import type { Map as MapaGL } from 'maplibre-gl'

type Anillo = number[][]
// caja [[oeste, sur], [este, norte]] (el formato de LngLatBoundsLike de MapLibre)
export type Caja = [[number, number], [number, number]]

export interface Limites {
  bounds: Caja // los dos partidos
  navegable: Caja // bounds + margen: de ahí no se puede salir
  mascara: any // Feature GeoJSON: el mundo con los dos partidos como agujeros
  contorno: any // Feature GeoJSON: solo el contorno exterior
}

// caja de cualquier geometría GeoJSON (coordenadas anidadas)
export function cajaDe(coords: unknown): Caja {
  let o = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  const rec = (c: any) => { if (typeof c[0] === 'number') { o = Math.min(o, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]) } else for (const x of c) rec(x) }
  rec(coords)
  return [[o, s], [e, n]]
}
export const unirCajas = (a: Caja, b: Caja): Caja => [[Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])], [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])]]
export const contiene = (c: Caja, lon: number, lat: number) => lon >= c[0][0] && lon <= c[1][0] && lat >= c[0][1] && lat <= c[1][1]
const agrandar = (c: Caja, f: number): Caja => { const dx = (c[1][0] - c[0][0]) * f, dy = (c[1][1] - c[0][1]) * f; return [[c[0][0] - dx, c[0][1] - dy], [c[1][0] + dx, c[1][1] + dy]] }

const area = (r: Anillo) => r.reduce((s, [x, y], i) => { const [x2, y2] = r[(i + 1) % r.length]; return s + (x * y2 - x2 * y) }, 0) / 2

// Calcula los límites; el dibujo (máscara y contorno) lo hace MapLibre junto con el fondo, ver mapa/capas.ts
export function calcularLimites(contornoExterior: number[][][][]): Limites {
  // máscara: un rectángulo enorme con los dos partidos (ya unidos, así los agujeros no se superponen) como agujeros (los agujeros van con giro contrario al del borde)
  const mundo: Anillo = [[-61, -37], [-56, -37], [-56, -33], [-61, -33], [-61, -37]]
  const horario = area(mundo) < 0
  const agujero = (r: Anillo) => ((area(r) < 0) === horario ? [...r].reverse() : r)
  const mascara = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [mundo, ...contornoExterior.map(p => agujero(p[0]))] } }

  // solo el contorno exterior: el límite entre partidos pasa a ser borde de zona
  const contorno = { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: contornoExterior } }
  const bounds = cajaDe(contornoExterior)
  return { bounds, navegable: agrandar(bounds, 0.06), mascara, contorno }
}

// No se puede salir de la zona: MapLibre no deja que la vista pase de la caja navegable (eso también limita cuánto se puede alejar).
export function limitarNavegacion(mapa: MapaGL, lim: Limites, extraSur = 0) {
  // en el celular la hoja inferior tapa parte del mapa: se deja margen al sur para poder subir la zona por encima de la hoja
  const n = lim.navegable
  const navegable: Caja = extraSur ? [[n[0][0], n[0][1] - (n[1][1] - n[0][1]) * extraSur], n[1]] : n
  mapa.setMaxBounds(navegable)
}
