// Mapa de parroquias de la Diócesis de Avellaneda-Lanús: versión pública, de solo lectura.
// Un solo mapa de MapLibre: el fondo, los decanatos, los radios y los marcadores se dibujan juntos en la GPU.
// Los datos (public/datos.json) los arma `npm run publicar` en el repo interno.
import 'maplibre-gl/dist/maplibre-gl.css'
import './style.css'
import { AttributionControl, Map as MapaGL, NavigationControl, Popup, setWorkerUrl, type LngLatLike, type PointLike } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { estiloMapa } from './mapa/estilo'
import { capasDecanatos, ponerDatos } from './mapa/capas'
import type { Colegio, Datos, Lugar } from './tipos'
import { claveIcono, clavePunto, miniSvg, registrarIconos, type TipoMarca } from './marcadores'
import { calcularLimites, limitarNavegacion, type Caja, type Limites } from './limites'
import { crearZonas, type ControlZonas } from './zonas'
import { chipZona, fichaColegio, fichaLugar, plural, vistaAcerca, vistaBuscar, vistaCercanas, vistaDecanato, vistaInicio, type CtxVistas } from './vistas'
import { esc } from './util'
import { crearHoja, type Hoja, type PanelEstado } from './hoja'

type Vista = 'inicio' | 'decanato' | 'cercanas' | 'buscar' | 'ficha' | 'acerca'
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

// Zoom semántico (zooms de MapLibre):
//  - diócesis: los 4 decanatos con su cantidad de parroquias; las parroquias son puntitos, sin capillas
//  - barrio: íconos y capillas
//  - decanato elegido: sus parroquias y capillas, con los radios como líneas finas
//  - parroquia elegida: su radio marcado y sus capillas resaltadas, con la línea
// En la versión pública las parroquias y las capillas se ven con su ícono desde la vista de toda la diócesis (sin puntitos);
// de lejos los íconos se achican para no taparse (mapa/capas.ts, icon-size).
const Z_ICONOS = -1
const CAPILLAS_DESDE_ZOOM = -1
const Z_OTROS_DECANATOS = -1
const Z_BARRIO = 14
const DURACION = 600
const CLAVE_COLEGIOS = 'guia-colegios'

let datos: Datos
const porId = new Map<string, Lugar>()
const porIdCol = new Map<string, Colegio>()
let parroquias: Lugar[] = []

let vista: Vista = 'inicio'
let vistaAntes: Vista = 'inicio'
let decanatoSel: string | null = null
let sel: string | null = null
let texto = ''
let colegiosOn = false
let ubic: [number, number] | null = null
let estadoUbic: 'pidiendo' | 'error' | 'ok' = 'ok'
let mensajeUbic = ''
let vistaPrevia: { centro: LngLatLike; zoom: number } | null = null

let zonas: ControlZonas
let limites: Limites
let mapa: MapaGL
let tooltip: Popup
const conMouse = window.matchMedia('(hover: hover)').matches
setWorkerUrl(workerUrl)

const esMovil = () => window.matchMedia('(max-width: 768px)').matches
const tipoMarca = (l: Lugar): TipoMarca => (l.tipo === 'Capilla' ? 'capilla' : 'parroquia')
const colegiosPorDecanato = new Map<string, Colegio[]>()
const decanatoDeColegio = new Map<string, string>() // los colegios no traen decanato: el de la zona en la que caen
const ctxVistas = (): CtxVistas => ({ datos, parroquias, porId, porIdCol, colegiosOn, ubic, colegiosDe: d => colegiosPorDecanato.get(d) ?? [] })
const indiceDecanato = (d: string) => Math.max(0, datos.decanatos.indexOf(d))

// ---------- marcadores ----------
function relacionados(): { madre: string | null; ids: Set<string> } {
  const c = sel ? porIdCol.get(sel) : undefined
  if (c) return { madre: null, ids: new Set(c.lugares_vinculados) } // un colegio: la parroquia o capilla de su mismo edificio
  const l = sel ? porId.get(sel) : undefined
  if (!l) return { madre: null, ids: new Set() }
  if (l.tipo === 'Capilla') return { madre: l.parroquia_id, ids: new Set(l.parroquia_id ? [l.parroquia_id] : []) }
  return { madre: l.id, ids: new Set(l.capillas) }
}

function refrescarMarcadores() {
  if (!mapa) return
  const z = mapa.getZoom()
  const { madre, ids } = relacionados()
  const hayElegido = !!sel && (porId.has(sel) || porIdCol.has(sel))
  const puntos: any[] = []
  const punto = (id: string, lat: number, lon: number, p: Record<string, unknown>) => puntos.push({ type: 'Feature', properties: { id, ...p }, geometry: { type: 'Point', coordinates: [lon, lat] } })
  for (const l of datos.lugares) {
    if (l.lat == null || l.lon == null) continue
    const esCapilla = l.tipo === 'Capilla'
    const esSel = l.id === sel, esRel = ids.has(l.id)
    const enDecanato = !!decanatoSel && l.decanato === decanatoSel
    const forzado = esSel || esRel || (!!madre && l.parroquia_id === madre)
    const visible = !esCapilla || forzado || (decanatoSel ? enDecanato : z >= CAPILLAS_DESDE_ZOOM)
    if (!visible) continue
    const otro = !!decanatoSel && !enDecanato
    const atenuado = (hayElegido && !esSel && !esRel) || (!hayElegido && otro)
    const comoPunto = !esCapilla && !forzado && (decanatoSel ? otro && z < Z_OTROS_DECANATOS : z < Z_ICONOS)
    punto(l.id, l.lat, l.lon, {
      icono: comoPunto ? clavePunto(0) : claveIcono({ tipo: tipoMarca(l), nivel: 0, sel: esSel, resaltado: esRel }),
      fijo: comoPunto || esSel, orden: esSel ? 1000 : esRel ? 600 : esCapilla ? 0 : 100, opacidad: atenuado ? 0.35 : 1,
      nombre: l.nombre, sub: `${l.localidad || l.localidad_guia}${l.parroquia ? ' · de ' + l.parroquia : ''}`,
    })
  }
  for (const c of datos.colegios) {
    if (c.lat == null || c.lon == null) continue
    if (!colegiosOn && c.id !== sel) continue
    // elegido algo: todo apagado menos lo elegido; con un decanato elegido, los colegios de los otros decanatos apagados
    const atenuado = hayElegido ? c.id !== sel && !ids.has(c.id) : !!decanatoSel && decanatoDeColegio.get(c.id) !== decanatoSel
    const comoPunto = c.id !== sel && !decanatoSel && z < Z_ICONOS
    punto(c.id, c.lat, c.lon, {
      icono: comoPunto ? clavePunto(0, true) : claveIcono({ tipo: 'colegio', nivel: 0, sel: c.id === sel }),
      fijo: comoPunto || c.id === sel, orden: c.id === sel ? 1000 : 50, opacidad: atenuado ? 0.35 : 1,
      nombre: c.nombre, sub: `Colegio católico${c.localidad ? ' · ' + c.localidad : ''}`,
    })
  }
  ponerDatos(mapa, 'puntos', puntos)
  const s = sel ? porId.get(sel) : null
  const lineas = s?.lat != null ? [...ids].map(id => porId.get(id)!).filter(r => r?.lat != null).map(r => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[s.lon!, s.lat!], [r.lon!, r.lat!]] } })) : []
  ponerDatos(mapa, 'relaciones', lineas)
}

function puntoEn(p: { x: number; y: number }): any | null {
  const r = 4, caja: [PointLike, PointLike] = [[p.x - r, p.y - r], [p.x + r, p.y + r]]
  const fs = mapa.queryRenderedFeatures(caja, { layers: ['puntos'] })
  return fs.sort((a, b) => (b.properties.orden ?? 0) - (a.properties.orden ?? 0))[0] ?? null
}

// ---------- panel (en el celular es una hoja inferior) ----------
// hoja.ts: arrastre con el dedo y las tres alturas
let hoja: Hoja
const panelEstado = (e: PanelEstado) => hoja.poner(e)
const panelActual = (): PanelEstado => hoja.estado()
const altoHoja = (e: PanelEstado = panelActual()) => hoja.altura(e)
function areaLibre(e: PanelEstado): { arriba: number; abajo: number } {
  if (esMovil()) return { arriba: 0, abajo: altoHoja(e) } // en el celular no hay leyenda ni botones de zoom arriba
  const ley = $('leyenda').getBoundingClientRect(), mp = $('mapa').getBoundingClientRect()
  return { arriba: Math.max(0, Math.round(ley.bottom - mp.top)), abajo: 0 }
}
function volarA(lat: number, lon: number, zoom: number, e: PanelEstado = panelActual()) {
  const { arriba, abajo } = areaLibre(e)
  mapa.flyTo({ center: [lon, lat], zoom, offset: [0, (arriba - abajo) / 2], duration: DURACION, essential: true })
}
function opcionesEncuadre(e: PanelEstado) {
  const { arriba, abajo } = areaLibre(e)
  return { padding: { top: arriba + 12, bottom: abajo + 16, left: 16, right: 16 }, maxZoom: Z_BARRIO }
}
function encuadrar(b: Caja | null, e: PanelEstado = panelActual()) {
  if (b) mapa.fitBounds(b, { ...opcionesEncuadre(e), duration: DURACION, essential: true })
}

// ---------- navegación ----------
function render() {
  const cont = $('contenido')
  const ctx = ctxVistas()
  $('panel').classList.toggle('en-ficha', vista === 'ficha')
  $('panel').classList.toggle('buscando', vista === 'buscar') // en el celular el buscador aparece solo al buscar
  if (vista === 'inicio') cont.innerHTML = vistaInicio(ctx)
  else if (vista === 'decanato' && decanatoSel) cont.innerHTML = vistaDecanato(ctx, decanatoSel, indiceDecanato(decanatoSel))
  else if (vista === 'cercanas') cont.innerHTML = vistaCercanas(ctx, decanatoSel, estadoUbic, mensajeUbic)
  else if (vista === 'buscar') cont.innerHTML = vistaBuscar(ctx, texto)
  else if (vista === 'acerca') cont.innerHTML = vistaAcerca(ctx)
  else if (vista === 'ficha' && sel) {
    const l = porId.get(sel), c = porIdCol.get(sel)
    cont.innerHTML = l ? fichaLugar(l, ctx, chipZona(l.decanato, indiceDecanato(l.decanato))) : c ? fichaColegio(c, ctx) : ''
  }
  cont.scrollTop = 0
  $('menu-colegios').textContent = colegiosOn ? 'Ocultar los colegios del mapa' : 'Mostrar colegios en el mapa'
  zonas.actualizar(decanatoSel, radioElegido())
  hoja.medirMini()
  hoja.fijarMedio(vista === 'ficha' ? altoFicha() : vista === 'inicio' ? altoHasta($('contenido').lastElementChild) : null)
  hoja.revisarMas()
  refrescarMarcadores()
  sincronizarHistoria()
}

// ---------- botón "atrás" del teléfono ----------
// Fuera del inicio hay siempre una entrada de más en el historial: el "atrás" del teléfono (o del navegador)
// vuelve un paso dentro del mapa en vez de salir de la página. Al volver al inicio por los botones, se consume.
let trampa = false, ignorarPop = false
function sincronizarHistoria() {
  const fuera = vista !== 'inicio'
  if (fuera && !trampa) { history.pushState({ mapa: 1 }, ''); trampa = true }
  else if (!fuera && trampa) { trampa = false; ignorarPop = true; history.back() }
}
function atras() {
  if (!$('menu-mas').hidden) { cerrarMenu(); return }
  // en la búsqueda del celular, primero vuelve a la búsqueda vacía (con las localidades) y después la cierra
  if (vista === 'buscar' && texto && esMovil()) { texto = ''; ($('q') as HTMLInputElement).value = ''; panelEstado('alto'); render() }
  else if (vista === 'buscar') cerrarBusqueda()
  else if (vista === 'ficha') volverDeFicha()
  else if (vista === 'acerca') { vista = vistaAntes === 'acerca' || vistaAntes === 'ficha' ? (decanatoSel ? 'decanato' : 'inicio') : vistaAntes; panelEstado('medio'); render() }
  else if (vista === 'cercanas') { vista = decanatoSel ? 'decanato' : 'inicio'; panelEstado('medio'); render() }
  else if (vista === 'decanato') verTodo()
}
window.addEventListener('popstate', () => {
  if (ignorarPop) { ignorarPop = false; return }
  trampa = false
  if (!datos) return
  atras()
  sincronizarHistoria() // si quedó fuera del inicio, vuelve a poner la entrada de más
})

// ---------- búsqueda ----------
// En el celular se abre con la lupa de arriba: la hoja sube entera con el buscador y el teclado.
let selAntes: string | null = null // la ficha que estaba abierta al empezar a buscar: al cerrar la búsqueda se vuelve a ella
function abrirBusqueda() {
  cerrarMenu()
  if (vista !== 'buscar') { vistaAntes = vista; selAntes = vista === 'ficha' ? sel : null }
  vista = 'buscar'
  panelEstado('alto'); render()
  $('q').focus()
}
function cerrarBusqueda() {
  texto = ''; ($('q') as HTMLInputElement).value = ''; $('q').blur()
  if (vistaAntes === 'ficha' && selAntes && (porId.has(selAntes) || porIdCol.has(selAntes))) { const id = selAntes; selAntes = null; seleccionar(id); return }
  vista = vistaAntes === 'buscar' || vistaAntes === 'ficha' ? (decanatoSel ? 'decanato' : 'inicio') : vistaAntes
  panelEstado('medio'); render()
}

// en una ficha, la hoja a media altura muestra hasta los botones de contacto y el de Google Maps
// (en el inicio, hasta el final: así queda más mapa a la vista)
const altoHasta = (fin: Element | null) => (fin ? fin.getBoundingClientRect().bottom - $('panel').getBoundingClientRect().top + 14 : null)
const altoFicha = () => { const h = altoHasta($('contenido').querySelector('.acciones-ficha')); return h == null ? null : h + 22 }

function verTodo() {
  cerrarMenu()
  decanatoSel = null; sel = null; vistaPrevia = null; texto = ''; vista = 'inicio'
  ;($('q') as HTMLInputElement).value = ''
  panelEstado('medio'); render()
  encuadrar(zonas.todas ?? limites.bounds, 'medio')
}

function elegirDecanato(d: string) {
  decanatoSel = d; sel = null; vista = 'decanato'; vistaPrevia = null
  ;($('q') as HTMLInputElement).value = ''; texto = ''
  panelEstado('medio'); render()
  encuadrar(zonas.limites(d), 'medio')
}

function volverDeFicha() {
  sel = null
  vista = texto ? 'buscar' : decanatoSel ? 'decanato' : 'inicio'
  panelEstado('medio'); render()
  if (vistaPrevia) { mapa.flyTo({ center: vistaPrevia.centro, zoom: vistaPrevia.zoom, duration: DURACION, essential: true }); vistaPrevia = null }
}

function radioElegido(): string | null {
  const l = vista === 'ficha' && sel ? porId.get(sel) : undefined
  if (!l) return null
  const id = l.tipo === 'Capilla' ? l.parroquia_id : l.id
  return id && zonas.limitesRadio(id) ? id : null
}

function seleccionar(id: string) {
  const l = porId.get(id), c = porIdCol.get(id)
  const x = l ?? c; if (!x) return
  if (document.activeElement === $('q')) $('q').blur() // cierra el teclado
  if (vista !== 'ficha') vistaPrevia = { centro: mapa.getCenter(), zoom: mapa.getZoom() }
  if (c && !colegiosOn) colegiosOn = true
  const dec = l?.decanato || (c ? decanatoDeColegio.get(c.id) : undefined)
  if (dec) decanatoSel = dec
  sel = id; vista = 'ficha'
  panelEstado('medio'); render()
  const radio = radioElegido()
  const cajaRadio = radio ? zonas.limitesRadio(radio) : null
  if (cajaRadio) mapa.fitBounds(cajaRadio, { ...opcionesEncuadre('medio'), maxZoom: Z_BARRIO + 1, duration: DURACION, essential: true })
  else if (x.lat != null) volarA(x.lat, x.lon!, Z_BARRIO, 'medio')
}

function guardarColegios() { try { localStorage.setItem(CLAVE_COLEGIOS, colegiosOn ? '1' : '0') } catch { /* sin localStorage */ } }
function irAMenu(menu: string) {
  cerrarMenu()
  if (menu === 'todo') verTodo()
  else if (menu === 'colegios') { colegiosOn = !colegiosOn; guardarColegios(); render() }
  else if (menu === 'acerca') { if (vista !== 'acerca') vistaAntes = vista; vista = 'acerca'; panelEstado('alto'); render() }
}

// ---------- mi ubicación ----------
function pedirUbicacion(alTerminar: () => void) {
  if (!navigator.geolocation) { estadoUbic = 'error'; mensajeUbic = 'Este navegador no sabe dónde estás.'; alTerminar(); return }
  estadoUbic = 'pidiendo'; alTerminar()
  navigator.geolocation.getCurrentPosition(
    pos => {
      ubic = [pos.coords.latitude, pos.coords.longitude]; estadoUbic = 'ok'
      ponerDatos(mapa, 'yo', [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [ubic[1], ubic[0]] } }])
      alTerminar()
    },
    () => { estadoUbic = 'error'; mensajeUbic = ''; alTerminar() },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
  )
}

// ---------- menú ⋯ ----------
function cerrarMenu() { $('menu-mas').hidden = true; $('btn-mas').setAttribute('aria-expanded', 'false') }
function alternarMenu() {
  const abrir = $('menu-mas').hidden
  $('menu-mas').hidden = !abrir; $('btn-mas').setAttribute('aria-expanded', String(abrir))
}

// ---------- leyenda ----------
function renderLeyenda() {
  const t = (tipo: TipoMarca) => miniSvg({ tipo, nivel: 0 }, 24)
  $('leyenda').innerHTML = `
    <button id="ley-toggle" type="button" aria-expanded="false" aria-controls="ley-cuerpo">Leyenda <span aria-hidden="true">▾</span></button>
    <div id="ley-cuerpo">
      <div class="ley-fila"><span>${t('parroquia')}Parroquia</span><span>${t('capilla')}Capilla</span><span>${t('colegio')}Colegio</span></div>
    </div>`
  $('ley-toggle').addEventListener('click', () => {
    const abierta = $('leyenda').classList.toggle('abierta')
    $('ley-toggle').setAttribute('aria-expanded', String(abierta))
  })
}

// ---------- eventos ----------
function eventos() {
  $('q').addEventListener('input', e => {
    texto = (e.target as HTMLInputElement).value.trim()
    if (texto) { if (vista !== 'buscar' && vista !== 'ficha') vistaAntes = vista; vista = 'buscar'; sel = null }
    else if (vista === 'buscar' && !esMovil()) vista = decanatoSel ? 'decanato' : 'inicio' // en el celular queda abierto, con la ayuda
    render()
  })
  $('q').addEventListener('focus', () => { if (esMovil() && panelActual() !== 'alto') panelEstado('alto') })
  $('q').addEventListener('keydown', e => { if (e.key === 'Enter') $('q').blur() }) // "buscar" del teclado: lo baja para ver los resultados
  $('buscar-cerrar').addEventListener('click', () => atras())
  $('btn-buscar').addEventListener('click', abrirBusqueda)
  $('btn-todo').addEventListener('click', verTodo)
  $('btn-mas').addEventListener('click', e => { e.stopPropagation(); alternarMenu() })
  $('menu-mas').addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-menu]'); if (b) irAMenu(b.dataset.menu!) })
  document.addEventListener('click', e => { if (!(e.target as HTMLElement).closest('#menu-mas, #btn-mas')) cerrarMenu() })

  $('contenido').addEventListener('click', e => {
    const t = e.target as HTMLElement
    const copiar = t.closest<HTMLElement>('[data-copiar]')
    if (copiar) { const n = copiar.dataset.copiar!; navigator.clipboard?.writeText(n).catch(() => {}); const o = copiar.textContent; copiar.textContent = '¡Copiado!'; setTimeout(() => (copiar.textContent = o), 1400); return }
    const deca = t.closest<HTMLElement>('[data-deca]'); if (deca) { elegirDecanato(deca.dataset.deca!); return }
    const acc = t.closest<HTMLElement>('[data-accion]')
    if (acc) {
      e.preventDefault()
      const a = acc.dataset.accion
      if (a === 'cerrar' || a === 'volver') atras()
      else if (a === 'ir') seleccionar(acc.dataset.id!)
      else if (a === 'todos') verTodo()
      else if (a === 'decanato') { vista = 'decanato'; panelEstado('medio'); render() }
      else if (a === 'cerca') { vista = 'cercanas'; panelEstado('medio'); pedirUbicacion(render) }
      else if (a === 'cerca-aqui') { if (ubic) render(); else pedirUbicacion(render) }
      else if (a === 'colegios') { colegiosOn = !colegiosOn; guardarColegios(); render() }
      else if (a === 'buscar-en') { const q = acc.dataset.q ?? ''; ($('q') as HTMLInputElement).value = q; texto = q; render() }
      return
    }
    const it = t.closest<HTMLElement>('[data-id]'); if (it) seleccionar(it.dataset.id!)
  })
  mapa.on('click', e => {
    const p = puntoEn(e.point); if (p) { seleccionar(p.properties.id); return }
    const z = zonas.zonaEn(e.lngLat.lng, e.lngLat.lat); if (z) { elegirDecanato(z); return }
    if (vista === 'ficha') atras(); cerrarMenu()
  })
  mapa.on('mousemove', e => {
    if (!conMouse) return
    const p = puntoEn(e.point)
    if (p) {
      tooltip.setLngLat(p.geometry.coordinates).setHTML(`${esc(p.properties.nombre)}<br><small>${esc(p.properties.sub)}</small>`).addTo(mapa)
      mapa.getCanvas().style.cursor = 'pointer'
    } else {
      tooltip.remove()
      mapa.getCanvas().style.cursor = zonas.zonaEn(e.lngLat.lng, e.lngLat.lat) ? 'pointer' : ''
    }
  })
  mapa.getCanvas().addEventListener('mouseleave', () => tooltip.remove())
  let tramo = -1
  const tramoDe = (z: number) => (z < Z_ICONOS ? 0 : z < CAPILLAS_DESDE_ZOOM ? 1 : 2)
  mapa.on('zoom', () => {
    const z = mapa.getZoom(), t = tramoDe(z)
    if (t === tramo) return
    tramo = t; zonas.etiquetasGrandes(z < Z_ICONOS); refrescarMarcadores()
  })
  document.addEventListener('keydown', e => { if (e.key === 'Escape') atras() })
}

// ---------- arranque ----------
async function iniciar() {
  try {
    const r = await fetch('datos.json')
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    datos = await r.json()
  } catch (e) {
    $('contenido').innerHTML = `<p class="vacio">No se pudieron cargar los datos (${esc(String(e))}). Probá recargar la página.</p>`
    return
  }
  datos.lugares.forEach(l => porId.set(l.id, l))
  datos.colegios.forEach(c => porIdCol.set(c.id, c))
  parroquias = datos.lugares.filter(l => l.tipo !== 'Capilla')
  try { colegiosOn = localStorage.getItem(CLAVE_COLEGIOS) === '1' } catch { colegiosOn = false }

  limites = calcularLimites(datos.contorno)
  mapa = new MapaGL({
    container: 'mapa',
    style: estiloMapa(capasDecanatos(datos.zonas, limites, datos.radios, id => porId.get(id)?.decanato ?? '', esMovil())),
    bounds: limites.bounds,
    attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false, maxPitch: 0,
    renderWorldCopies: false, fadeDuration: 0,
  })
  mapa.touchZoomRotate.disableRotation(); mapa.keyboard.disableRotation()
  mapa.addControl(new NavigationControl({ showCompass: false }), 'top-right')
  mapa.addControl(new AttributionControl({ compact: true }), 'bottom-right')
  tooltip = new Popup({ closeButton: false, closeOnClick: false, offset: 18, className: 'tip-mapa', maxWidth: '280px' })
  if (import.meta.env.DEV) (window as any).__mapa = mapa
  await new Promise<void>(r => mapa.once('load', () => r()))
  await registrarIconos(mapa)

  zonas = crearZonas(mapa, datos.zonas, datos.radios, d => plural(parroquias.filter(p => p.decanato === d).length, 'parroquia', 'parroquias'))
  // los colegios no traen decanato: es el de la zona en la que caen
  for (const c of datos.colegios) { if (c.lat == null || c.lon == null) continue; const d = zonas.zonaEn(c.lon, c.lat); if (d) { colegiosPorDecanato.set(d, [...(colegiosPorDecanato.get(d) ?? []), c]); decanatoDeColegio.set(c.id, d) } }
  hoja = crearHoja($('panel'), $('handle'), $('contenido'), $('buscador'), $('top'), esMovil)
  renderLeyenda(); eventos()
  if (esMovil()) panelEstado('medio')
  render()
  zonas.etiquetasGrandes(mapa.getZoom() < Z_ICONOS)
  limitarNavegacion(mapa, limites, esMovil() ? 0.9 : 0)
  mapa.fitBounds(zonas.todas ?? limites.bounds, { ...opcionesEncuadre(panelActual()), duration: 0 })
  setTimeout(() => mapa.resize(), 100)
}
iniciar()
