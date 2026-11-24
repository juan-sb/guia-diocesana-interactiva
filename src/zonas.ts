// Zonas de decanato en el mapa: relleno pastel, borde marcado, nombre y avance en el centro. Tocar una zona elige el decanato.
// Todo se dibuja con capas de MapLibre (mapa/capas.ts); acá queda el estado: qué decanato y qué radio están elegidos.
import type { Map as MapaGL } from 'maplibre-gl'
import type { Radio, Zona } from './tipos'
import { estiloZona } from './estado'
import { aplicarAspecto, aplicarRadios, ponerDatos } from './mapa/capas'
import { cajaDe, contiene, unirCajas, type Caja } from './limites'

export interface ControlZonas {
  actualizar(seleccionado: string | null, radio?: string | null): void // radio: id de la parroquia cuyo radio se marca
  etiquetasGrandes(si: boolean): void // vista de la diócesis (de lejos): la cantidad de parroquias de cada decanato, más grande
  limitesRadio(id: string): Caja | null
  limites(decanato: string): Caja | null
  todas: Caja | null
  zonaEn(lon: number, lat: number): string | null // decanato de la zona que contiene el punto (para el toque)
}

type Anillo = number[][]
const dentro = (x: number, y: number, r: Anillo) => { // ray casting
  let c = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c
  return c
}
const enZona = (z: Zona, lon: number, lat: number) => z.geometry.coordinates.some(poli => dentro(lon, lat, poli[0]) && !poli.slice(1).some(h => dentro(lon, lat, h)))

export function crearZonas(gl: MapaGL, zonas: Zona[], radios: Radio[], cuenta: (decanato: string) => string): ControlZonas {
  const cajas = new Map<string, Caja>(zonas.map(z => [z.decanato, cajaDe(z.geometry.coordinates)]))
  const cajasRadio = new Map<string, Caja>(radios.map(r => [r.id, cajaDe(r.geometry.coordinates)]))
  let todas: Caja | null = null
  for (const c of cajas.values()) todas = todas ? unirCajas(todas, c) : c

  let actual: string | null = null, radioActual: string | null = null, grandes = false
  const etiquetas = () => ponerDatos(gl, 'zonas_etq', zonas.map(z => {
    return { type: 'Feature', properties: { nombre: z.decanato, num: cuenta(z.decanato), activa: actual === z.decanato, apagada: !!actual && actual !== z.decanato, grande: grandes }, geometry: { type: 'Point', coordinates: [z.etiqueta[1], z.etiqueta[0]] } } // etiqueta viene como [lat, lon]
  }))
  const aplicar = () => {
    aplicarRadios(gl, actual, radioActual)
    aplicarAspecto(gl, zonas, (z, i) => {
      const e = estiloZona(z.decanato, i)
      const activa = actual === z.decanato, apagada = !!actual && !activa
      // sutil: los decanatos son el fondo, lo importante son las parroquias
      return { relleno: apagada ? 0.03 : activa ? e.alpha * 0.45 : e.alpha * 0.3, aclara: !apagada, grosor: activa ? 2.5 : apagada ? 0.8 : 1.4, opacidad: apagada ? 0.35 : 0.75 }
    })
    etiquetas()
  }
  aplicar()

  return {
    todas,
    limites: d => cajas.get(d) ?? null,
    limitesRadio: id => cajasRadio.get(id) ?? null,
    zonaEn: (lon, lat) => zonas.find(z => contiene(cajas.get(z.decanato)!, lon, lat) && enZona(z, lon, lat))?.decanato ?? null,
    etiquetasGrandes(si) { if (si !== grandes) { grandes = si; etiquetas() } },
    // con un decanato elegido se apagan las otras zonas y se remarca la elegida
    actualizar(sel, radio = null) { actual = sel; radioActual = radio; aplicar() },
  }
}
