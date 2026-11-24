import type { Map as MapaGL } from 'maplibre-gl'
import { NIVELES, NIVEL_NEUTRO, nivelInfo, tinte } from './estado'

const OSCURO = '#0f172a'

export type TipoMarca = 'parroquia' | 'capilla' | 'colegio'

export interface Estilo {
  tipo: TipoMarca
  nivel: number // 0 sin datos, 1 sabemos algo, 2 contactada
  desact?: boolean
  sel?: boolean
  resaltado?: boolean
  atenuado?: boolean
  neutro?: boolean // íconos de tipo en la leyenda: un solo color neutro, sin estado
}

// Tipo = silueta (círculo con cruz, casita, cuadrado con libro). Estado = color + relleno (vacío, medio, lleno) + tilde.
// Ninguna dimensión depende solo del color.
function forma(tipo: TipoMarca, c: number, D: number, attrs: string): string {
  if (tipo === 'parroquia') return `<circle cx="${c}" cy="${c}" r="${D / 2}" ${attrs}/>`
  if (tipo === 'colegio') return `<rect x="${c - D / 2}" y="${c - D / 2}" width="${D}" height="${D}" rx="${D * 0.2}" ${attrs}/>`
  const w = D * 0.86, h = D * 0.92, top = c - h / 2, hombro = top + h * 0.4
  const pts = [[c - w / 2, c + h / 2], [c - w / 2, hombro], [c, top], [c + w / 2, hombro], [c + w / 2, c + h / 2]].map(p => p.map(n => n.toFixed(2)).join(',')).join(' ')
  return `<polygon points="${pts}" stroke-linejoin="round" ${attrs}/>`
}

function glifo(tipo: TipoMarca, c: number, D: number, col: string): string {
  if (tipo === 'colegio') { // libro abierto
    const a = D * 0.28, t = D * 0.2, b = D * 0.18, g = D * 0.025
    return `<path d="M${c - g} ${c + b}L${c - a} ${c + b - D * 0.06}L${c - a} ${c - t}Q${c - a / 2} ${c - t - D * 0.02} ${c - g} ${c - t + D * 0.08}Z" fill="${col}"/>` +
      `<path d="M${c + g} ${c + b}L${c + a} ${c + b - D * 0.06}L${c + a} ${c - t}Q${c + a / 2} ${c - t - D * 0.02} ${c + g} ${c - t + D * 0.08}Z" fill="${col}"/>`
  }
  // cruz latina (en la capilla, más chica y un poco más baja por el techo)
  const k = tipo === 'parroquia' ? 1 : 0.78, dy = tipo === 'parroquia' ? 0 : D * 0.08
  const th = D * 0.14 * (tipo === 'parroquia' ? 1 : 1.15), len = D * 0.58 * k, brazo = D * 0.38 * k
  const y0 = c - len * 0.5 + dy
  return `<rect x="${c - th / 2}" y="${y0}" width="${th}" height="${len}" fill="${col}"/><rect x="${c - brazo / 2}" y="${y0 + len * 0.28}" width="${brazo}" height="${th}" fill="${col}"/>`
}

export function svgMarcador(e: Estilo, mostrarHalo = true): { svg: string; box: number } {
  const destacado = !!(e.sel || e.resaltado)
  const base = e.tipo === 'parroquia' ? 30 : e.tipo === 'colegio' ? 27 : destacado ? 24 : 20 // la capilla es más chica que la parroquia
  const D = e.sel ? Math.round(base * 1.3) : base // el seleccionado se ve claramente más grande
  const box = Math.max(D + 20, 44) // el área tocable es de al menos 44 px aunque el ícono sea chico
  const c = box / 2
  const n = e.neutro ? NIVEL_NEUTRO : nivelInfo(e.nivel)
  const color = n.color
  const lleno = n.relleno === 'lleno'
  const sw = lleno ? 2 : 4 // vacío y medio llevan borde grueso
  const Dm = D - sw // la silueta se dibuja a mitad del trazo, así el borde exterior mide D
  const relleno = lleno ? color : n.relleno === 'medio' ? tinte(color) : '#fff'
  const halo = destacado && mostrarHalo ? `<circle cx="${c}" cy="${c}" r="${D / 2 + (e.sel ? 9 : 6)}" fill="${color}" opacity="${e.sel ? 0.35 : 0.25}"/>` : ''
  const cuerpo =
    forma(e.tipo, c, Dm, `fill="${OSCURO}" stroke="${OSCURO}" stroke-width="${sw + 4.5}"`) + // contorno oscuro, separa del mapa
    forma(e.tipo, c, Dm, `fill="#fff" stroke="#fff" stroke-width="${sw + 2.5}"`) + // halo blanco
    forma(e.tipo, c, Dm, `fill="${relleno}" stroke="${color}" stroke-width="${sw}"`) +
    glifo(e.tipo, c, D, lleno ? '#fff' : color) +
    (n.id === 3 ? forma(e.tipo, c, Dm + 6, `fill="none" stroke="${color}" stroke-width="1.6"`) : '') // reservado: vínculo activo, doble borde
  const bx = box - 8, by = 8, cx2 = box - 8, cy2 = box - 8
  const reloj = e.desact
    ? `<circle cx="${bx}" cy="${by}" r="6.5" fill="#1e293b" stroke="#fff" stroke-width="1.6"/><path d="M${bx} ${by - 3.4}V${by}l2.8 1.7" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
    : ''
  const tilde = n.tilde
    ? `<circle cx="${cx2}" cy="${cy2}" r="6.5" fill="${color}" stroke="#fff" stroke-width="1.6"/><path d="M${cx2 - 3} ${cy2 + 0.2}l2.2 2.3l3.9-4.6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
    : ''
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">${halo}${cuerpo}${reloj}${tilde}</svg>`, box }
}

// Muestra del mismo símbolo para la leyenda y las listas (px = lado en pantalla).
export function miniSvg(e: Estilo, px: number): string {
  return svgMarcador(e, false).svg.replace(/width="\d+" height="\d+"/, `width="${px}" height="${px}"`)
}

// A zoom bajo (vista de decanatos) las parroquias son puntitos sin ícono; el área tocable sigue siendo de 44 px.
function svgPunto(nivel: number, colegio: boolean): string {
  const n = nivelInfo(nivel)
  const forma = colegio
    ? `<rect x="14" y="14" width="16" height="16" rx="3" fill="${n.color}" stroke="#fff" stroke-width="2.5"/>`
    : `<circle cx="22" cy="22" r="8" fill="${n.color}" stroke="#fff" stroke-width="2.5"/>`
  const fondo = colegio ? `<rect x="12.5" y="12.5" width="19" height="19" rx="4" fill="none" stroke="#0f172a" stroke-width="1" opacity="0.7"/>` : `<circle cx="22" cy="22" r="9.8" fill="none" stroke="#0f172a" stroke-width="1" opacity="0.7"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">${fondo}${forma}</svg>`
}

// ---------- marcadores como imágenes del mapa ----------
// Los marcadores no son elementos de la página: son una capa de símbolos de MapLibre, que se dibuja en la GPU en el mismo cuadro que el
// mapa (no se atrasan ni se desfasan al mover o hacer zoom). Cada variante de ícono se dibuja una sola vez al arrancar y se registra
// como imagen con un nombre; el atenuado es la opacidad de la capa, no una imagen aparte.
export const claveIcono = (e: Estilo) => `mk-${e.tipo}-${nivelInfo(e.nivel).id}-${e.desact ? 1 : 0}-${e.sel ? 's' : e.resaltado ? 'r' : 'n'}`
export const clavePunto = (nivel: number, colegio = false) => `pt-${colegio ? 'c' : 'p'}-${nivelInfo(nivel).id}`

async function registrar(mapa: MapaGL, clave: string, svg: string, box: number, sombra: boolean) {
  const r = Math.min(2, Math.max(1, Math.ceil(window.devicePixelRatio || 1)))
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await img.decode()
  const lado = box * r, c = document.createElement('canvas'); c.width = c.height = lado
  const ctx = c.getContext('2d')!
  // la sombra suave que antes hacía el CSS (drop-shadow), ahora dibujada una sola vez en la imagen
  if (sombra) { ctx.shadowColor = 'rgba(15, 23, 42, 0.35)'; ctx.shadowBlur = 2 * r; ctx.shadowOffsetY = 1 * r }
  ctx.drawImage(img, 0, 0, lado, lado)
  if (!mapa.hasImage(clave)) mapa.addImage(clave, ctx.getImageData(0, 0, lado, lado), { pixelRatio: r })
}

// todas las variantes: 3 tipos x (normal, resaltado, elegido), más los puntitos
export async function registrarIconos(mapa: MapaGL) {
  const tareas: Promise<void>[] = []
  for (const tipo of ['parroquia', 'capilla', 'colegio'] as TipoMarca[]) for (const n of NIVELES) for (const modo of ['n', 'r', 's']) {
    const e: Estilo = { tipo, nivel: n.id, sel: modo === 's', resaltado: modo === 'r' }
    const { svg, box } = svgMarcador(e)
    tareas.push(registrar(mapa, claveIcono(e), svg, box, true))
  }
  for (const n of NIVELES) for (const colegio of [false, true]) tareas.push(registrar(mapa, clavePunto(n.id, colegio), svgPunto(n.id, colegio), 44, false))
  await Promise.all(tareas)
}
