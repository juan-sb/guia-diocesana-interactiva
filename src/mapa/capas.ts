// Todo lo propio del mapa son capas nativas de MapLibre (fuentes GeoJSON + capas): zonas de decanato, radios parroquiales, máscara exterior,
// contorno, etiquetas de los decanatos, marcadores, líneas a las capillas, mi ubicación y los puntos del modo ubicar.
// Se dibujan en la GPU en el mismo cuadro que el fondo, así que nada se atrasa ni se desfasa al arrastrar o hacer zoom.
// Ojo con el zoom: es el de MapLibre (teselas de 512 px), uno menos que el de Leaflet para la misma escala.
import type { Map as MapaGL } from 'maplibre-gl'
import type { Radio, Zona } from '../tipos'
import { estiloZona } from '../estado'
import type { Limites } from '../limites'

type Capa = Record<string, any>
const NADA = ['==', ['get', 'id'], ''] // filtro que no deja pasar ningún radio
const VACIO = { type: 'FeatureCollection', features: [] }
export const Z_ACLARA_DESDE = 13, Z_ACLARA_HASTA = 15 // de cerca el relleno de las zonas se aclara para que el mapa se lea

export function capasDecanatos(zonas: Zona[], lim: Limites, radios: Radio[], decanatoDe: (id: string) => string, movil: boolean): { fuentes: Record<string, any>; capas: Capa[] } {
  const col = (f: (z: Zona, i: number) => any, otro: any) => ['match', ['get', 'decanato'], ...zonas.flatMap((z, i) => [z.decanato, f(z, i)]), otro]
  const T = movil ? 0.8 : 1 // en el celular las etiquetas de los decanatos son un poco más chicas
  return {
    fuentes: {
      zonas: { type: 'geojson', data: { type: 'FeatureCollection', features: zonas.map(z => ({ type: 'Feature', properties: { decanato: z.decanato }, geometry: z.geometry })) } },
      radios: { type: 'geojson', data: { type: 'FeatureCollection', features: radios.map(r => ({ type: 'Feature', properties: { id: r.id, decanato: decanatoDe(r.id) }, geometry: r.geometry })) } },
      mascara: { type: 'geojson', data: lim.mascara },
      contorno: { type: 'geojson', data: lim.contorno },
      zonas_etq: { type: 'geojson', data: VACIO },
      relaciones: { type: 'geojson', data: VACIO },
      ubicar: { type: 'geojson', data: VACIO },
      yo: { type: 'geojson', data: VACIO },
      puntos: { type: 'geojson', data: VACIO },
    },
    // de abajo hacia arriba: relleno de zonas, radios del decanato (líneas finas), radio elegido, máscara de afuera, bordes de zona, contorno,
    // nombres de los decanatos, líneas a las capillas, puntos del modo ubicar, mi ubicación y los marcadores
    capas: [
      { id: 'zonas_relleno', type: 'fill', source: 'zonas', paint: { 'fill-color': col((z, i) => estiloZona(z.decanato, i).base, '#cccccc'), 'fill-opacity': col((z, i) => estiloZona(z.decanato, i).alpha, 0.3) } },
      { id: 'radios_linea', type: 'line', source: 'radios', filter: NADA, layout: { 'line-join': 'round' }, paint: { 'line-color': '#1f2937', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 14, 0.9, 17, 1.4], 'line-opacity': 0.6 } },
      { id: 'radio_sel_relleno', type: 'fill', source: 'radios', filter: NADA, paint: { 'fill-color': col((z, i) => estiloZona(z.decanato, i).base, '#cccccc'), 'fill-opacity': 0.3 } },
      { id: 'mascara', type: 'fill', source: 'mascara', paint: { 'fill-color': '#0b2540', 'fill-opacity': 0.25 } },
      { id: 'zonas_borde', type: 'line', source: 'zonas', layout: { 'line-join': 'round' }, paint: { 'line-color': col((z, i) => estiloZona(z.decanato, i).borde, '#666666'), 'line-width': 2.5, 'line-opacity': 0.95 } },
      { id: 'radio_sel_borde', type: 'line', source: 'radios', filter: NADA, layout: { 'line-join': 'round' }, paint: { 'line-color': col((z, i) => estiloZona(z.decanato, i).borde, '#333333'), 'line-width': 3.5, 'line-opacity': 1 } },
      { id: 'contorno', type: 'line', source: 'contorno', layout: { 'line-join': 'round' }, paint: { 'line-color': '#003c71', 'line-width': 1.8, 'line-opacity': 0.8 } },
      {
        // nombre del decanato y avance; de lejos (vista de la diócesis) el número es grande
        id: 'zonas_etq', type: 'symbol', source: 'zonas_etq',
        layout: {
          'text-field': ['format', ['get', 'nombre'], { 'text-font': ['literal', ['Noto Sans Bold']] }, '\n', {}, ['get', 'num'], { 'text-font': ['literal', ['Noto Sans Regular']], 'font-scale': 0.85 }],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['step', ['zoom'], ['case', ['get', 'activa'], 13 * T, 12 * T], 12.5, ['case', ['get', 'activa'], 14 * T, 13 * T]],
          'text-line-height': 1.15, 'text-max-width': 20, 'text-allow-overlap': true, 'text-ignore-placement': true,
        },
        paint: { 'text-color': '#003c71', 'text-halo-color': '#ffffff', 'text-halo-width': 2, 'text-halo-blur': 1, 'text-opacity': ['case', ['get', 'apagada'], 0.35, 0.8] },
      },
      { id: 'relaciones', type: 'line', source: 'relaciones', paint: { 'line-color': '#0f172a', 'line-width': 2, 'line-opacity': 0.55, 'line-dasharray': [2, 2.5] } },
      {
        id: 'ubicar', type: 'circle', source: 'ubicar',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'tipo'], 'fantasma'], 10, 6],
          'circle-color': ['case', ['==', ['get', 'tipo'], 'fantasma'], '#fbbf24', '#15803d'],
          'circle-opacity': ['case', ['==', ['get', 'tipo'], 'fantasma'], 0.35, 1],
          'circle-stroke-color': ['case', ['==', ['get', 'tipo'], 'fantasma'], '#b45309', '#ffffff'],
          'circle-stroke-width': 2,
        },
      },
      { id: 'yo', type: 'circle', source: 'yo', paint: { 'circle-radius': 8, 'circle-color': '#2563eb', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } },
      {
        // marcadores: cada uno trae el nombre de su imagen (marcadores.ts), su orden (el elegido arriba) y su opacidad (atenuado)
        id: 'puntos', type: 'symbol', source: 'puntos',
        layout: {
          'icon-image': ['get', 'icono'],
          // de lejos los íconos se achican para no taparse; el elegido y los puntitos quedan de su tamaño
          'icon-size': ['step', ['zoom'], ['case', ['get', 'fijo'], 1, 0.62], 11.5, ['case', ['get', 'fijo'], 1, 0.74], 12.5, ['case', ['get', 'fijo'], 1, 0.88], 14, 1],
          'icon-allow-overlap': true, 'icon-ignore-placement': true, 'symbol-sort-key': ['get', 'orden'],
        },
        paint: { 'icon-opacity': ['get', 'opacidad'] },
      },
    ],
  }
}

// valores por decanato (resaltado de la zona elegida y apagado de las otras)
export interface Aspecto { relleno: number; grosor: number; opacidad: number; aclara: boolean }
export function aplicarAspecto(gl: MapaGL, zonas: Zona[], aspecto: (z: Zona, i: number) => Aspecto) {
  const porZona = (f: (a: Aspecto) => number, otro: number) => ['match', ['get', 'decanato'], ...zonas.flatMap((z, i) => [z.decanato, f(aspecto(z, i))]), otro]
  // el aclarado al acercarse es una expresión de zoom: lo calcula MapLibre en cada cuadro, sin esperar a que termine el zoom
  gl.setPaintProperty('zonas_relleno', 'fill-opacity', ['interpolate', ['linear'], ['zoom'], Z_ACLARA_DESDE, porZona(a => a.relleno, 0.3), Z_ACLARA_HASTA, porZona(a => (a.aclara ? a.relleno * 0.22 : a.relleno), 0.07)] as any)
  gl.setPaintProperty('zonas_borde', 'line-width', porZona(a => a.grosor, 2.5) as any)
  gl.setPaintProperty('zonas_borde', 'line-opacity', porZona(a => a.opacidad, 0.95) as any)
  // donde dos decanatos comparten borde, la línea más gruesa (la del decanato elegido) va arriba; si no, el orden cambia de un tramo a otro
  gl.setLayoutProperty('zonas_borde', 'line-sort-key', porZona(a => a.grosor, 0) as any)
}

// Radios: con un decanato elegido, todos los suyos como líneas finas; con una parroquia elegida, su radio con borde marcado y relleno suave.
export function aplicarRadios(gl: MapaGL, decanato: string | null, radioId: string | null) {
  gl.setFilter('radios_linea', (decanato ? ['==', ['get', 'decanato'], decanato] : NADA) as any)
  const elegido = radioId ? ['==', ['get', 'id'], radioId] : NADA
  gl.setFilter('radio_sel_relleno', elegido as any)
  gl.setFilter('radio_sel_borde', elegido as any)
}

// datos de una fuente GeoJSON (si el estilo todavía no la tiene, no hace nada)
export function ponerDatos(gl: MapaGL, fuente: string, features: any[]) {
  const s = gl.getSource(fuente) as any
  if (s) s.setData({ type: 'FeatureCollection', features })
}
