import positron from './positron.json'

// Estilo base: Positron de OpenFreeMap (tiles vectoriales gratis, sin key), ajustado para que el mapa sea una base calma:
// sin comercios ni iglesias de OSM (las únicas cruces son las nuestras), avenidas siempre, calles solo de cerca,
// trenes y estaciones marcados, barrios con más peso que las calles y colores suaves que no compiten con las zonas ni los estados.
type Capa = Record<string, any>

const SOLO_BARRIOS = ['suburb', 'neighbourhood', 'quarter', 'borough', 'city_block', 'isolated_dwelling', 'hamlet']
const TEXTO = ['coalesce', ['get', 'name:es'], ['get', 'name']]

export function estiloMapa(extra?: { fuentes: Record<string, any>; capas: Capa[] }): any {
  const e = JSON.parse(JSON.stringify(positron))
  const capas: Capa[] = e.layers
  const por = (id: string) => capas.find(c => c.id === id)!
  const pintar = (id: string, paint: Capa, extra: Capa = {}) => { const c = por(id); Object.assign(c.paint, paint); Object.assign(c, extra) }

  const ocultar = (id: string) => { const c = por(id); c.layout = { ...(c.layout ?? {}), visibility: 'none' } }

  // ---- colores suaves: tierra neutra, agua y parques apenas insinuados ----
  pintar('background', { 'background-color': '#f3f3ef' })
  pintar('park', { 'fill-color': '#e6ebe0' })
  pintar('water', { 'fill-color': '#d5e0e6' })
  pintar('landuse_residential', { 'fill-color': '#eeeeea' })
  pintar('building', { 'fill-color': '#e9e9e4', 'fill-outline-color': '#e9e9e4' }, { minzoom: 15 })

  // ---- calles: finas y claras; las avenidas se ven desde lejos ----
  pintar('highway_minor', { 'line-color': '#e2e2dd' }, { minzoom: 11 })
  pintar('highway_path', { 'line-color': '#e6e6e1' }, { minzoom: 15 })
  pintar('highway_major_casing', { 'line-color': '#cfcfc9' }, { minzoom: 9.5 })
  pintar('highway_major_inner', { 'line-color': '#ffffff' }, { minzoom: 9.5 })
  pintar('highway_major_subtle', {}, { minzoom: 8 })

  // ---- trenes: línea oscura con durmientes, desde que se ve el partido entero ----
  for (const id of ['railway', 'railway_dashline']) por(id).minzoom = 9.5
  pintar('railway', {
    'line-color': '#7a7f87',
    'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 10, 1.6, 14, 2.6, 18, 5, 20, 8],
  })
  pintar('railway_dashline', {
    'line-color': '#f3f3ef',
    'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 10, 0.9, 14, 1.4, 18, 3, 20, 5],
    'line-dasharray': [3, 3],
  })
  for (const id of ['railway_service', 'railway_service_dashline', 'railway_transit', 'railway_transit_dashline']) por(id).minzoom = 16

  // ---- nombres de calles: recién a escala de barrio ----
  pintar('highway-name-major', { 'text-color': '#6b7280', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 }, { minzoom: 14 })
  pintar('highway-name-minor', { 'text-color': '#7b8089', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 }, { minzoom: 15 })
  pintar('highway-name-path', {}, { minzoom: 16.5 })
  for (const id of ['highway-name-major', 'highway-name-minor']) por(id).layout['text-size'] = ['interpolate', ['linear'], ['zoom'], 14, 10.5, 17, 12.5]

  // ---- sin carteles de rutas ni aeropuertos ----
  for (const id of ['highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us', 'airport']) ocultar(id)

  // ---- barrios: más peso que las calles ----
  const barrio = por('label_other')
  barrio.minzoom = 11.5
  barrio.filter = ['match', ['get', 'class'], SOLO_BARRIOS, true, false]
  barrio.layout['text-field'] = TEXTO
  barrio.layout['text-font'] = ['Noto Sans Bold']
  barrio.layout['text-transform'] = 'uppercase'
  barrio.layout['text-letter-spacing'] = 0.08
  barrio.layout['text-max-width'] = 8
  barrio.layout['text-size'] = ['interpolate', ['linear'], ['zoom'], 11.5, 10, 14, 12.5, 17, 15]
  barrio.paint = { 'text-color': '#4b5563', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6, 'text-halo-blur': 0.5 }

  // ---- ciudades y localidades: discretas, solo hasta que aparecen los barrios (las zonas ya llevan su nombre) ----
  for (const id of ['label_village', 'label_town', 'label_city', 'label_city_capital']) {
    const c = por(id)
    c.maxzoom = 12
    c.filter = ['all', c.filter, ['!', ['in', ['get', 'name'], ['literal', ['Avellaneda', 'Lanús', 'Lanús Este', 'Lanús Oeste', 'Avellaneda Norte', 'Avellaneda Sur']]]]] // los dos partidos ya van con el nombre de sus zonas
    c.paint['text-color'] = '#6b7280'
    if (c.layout?.['icon-image']) c.layout['icon-image'] = ''
  }
  for (const id of ['label_state', 'label_country_1', 'label_country_2', 'label_country_3', 'boundary_2', 'boundary_3', 'boundary_disputed']) ocultar(id)

  // ---- estaciones: punto + nombre ----
  const estacion = ['all', ['==', ['get', 'class'], 'railway'], ['match', ['get', 'subclass'], ['station', 'halt'], true, false]]
  const i = capas.findIndex(c => c.id === 'label_other')
  capas.splice(i, 0,
    {
      id: 'estacion_punto', type: 'circle', source: 'openmaptiles', 'source-layer': 'poi', minzoom: 11.5, filter: estacion,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11.5, 3, 16, 5.5],
        'circle-color': '#ffffff', 'circle-stroke-color': '#4b5563', 'circle-stroke-width': 2,
      },
    },
    {
      id: 'estacion_nombre', type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi', minzoom: 12.5, filter: estacion,
      layout: {
        'text-field': ['get', 'name'], /* name:es trae "Estación" o "Apeadero" según el nodo */ 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 12.5, 10.5, 16, 13],
        'text-anchor': 'left', 'text-offset': [0.9, 0], 'text-max-width': 9, 'text-optional': true,
      },
      paint: { 'text-color': '#374151', 'text-halo-color': '#ffffff', 'text-halo-width': 1.8 },
    },
  )

  // ---- sin POI de OSM (comercios, iglesias, salud): el estilo base no trae capas poi, solo las de estaciones de arriba ----
  e.layers = capas.filter(c => !(c['source-layer'] === 'poi' && !c.id.startsWith('estacion')))
  // zonas, máscara y contorno van encima de todo, como capas nativas
  if (extra) { Object.assign(e.sources, extra.fuentes); e.layers.push(...extra.capas) }
  return e
}
