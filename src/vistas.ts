// Vistas del panel (solo HTML): inicio, decanato, cercanas, búsqueda, fichas y "Acerca de".
import type { Colegio, Datos, Lugar } from './tipos'
import { estiloZona, rellenoZona } from './estado'
import { miniSvg, type TipoMarca } from './marcadores'
import { distanciaKm, esc, esUrl, fechaNum, formatKm, norm, telHref, waHref } from './util'

export interface CtxVistas {
  datos: Datos
  parroquias: Lugar[] // parroquias y la cuasiparroquia (sin capillas)
  porId: Map<string, Lugar>
  porIdCol: Map<string, Colegio>
  colegiosOn: boolean
  colegiosDe: (decanato: string) => Colegio[] // colegios que caen en la zona del decanato
  ubic: [number, number] | null // "mi ubicación", si la dio
}

const MINI = 30
const tipoMarca = (l: Lugar): TipoMarca => (l.tipo === 'Capilla' ? 'capilla' : 'parroquia')
const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es')
export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
const link = (href: string, texto: string) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(texto)}</a>`
const fila = (etiqueta: string, html: string) => (html ? `<dt>${esc(etiqueta)}</dt><dd>${html}</dd>` : '')

export function chipZona(decanato: string, i = 0): string {
  const e = estiloZona(decanato, i)
  return `<span class="chip-zona" style="--z:${rellenoZona(decanato, i)};--zb:${e.borde}"><i></i>${esc(decanato)}</span>`
}

// "Cómo llegar": Google Maps con el recorrido desde donde está la persona
export function urlMaps(l: { lat: number | null; lon: number | null; direccion: string; localidad: string }): string | null {
  if (l.lat != null && l.lon != null) return `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lon}`
  if (!l.direccion || /^(s\/d|sin sede central)$/i.test(l.direccion)) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${l.direccion}, ${l.localidad}, Buenos Aires, Argentina`)}`
}

// ---- un lugar o un colegio en una lista ----
export function item(x: Lugar | Colegio, opciones: { zona?: boolean; distancia?: string } = {}): string {
  const esCol = x.tipo === 'Colegio'
  const tipo: TipoMarca = esCol ? 'colegio' : tipoMarca(x as Lugar)
  const l = x as Lugar
  const sub = esCol
    ? `Colegio católico${x.localidad ? ' · ' + esc(x.localidad) : ''}`
    : `${l.tipo === 'Capilla' ? `Capilla de ${esc(l.parroquia)} · ` : ''}${esc(l.localidad || l.localidad_guia)}${opciones.zona && l.decanato ? ' · ' + esc(l.decanato) : ''}${l.tipo !== 'Capilla' && l.capillas.length ? ' · ' + plural(l.capillas.length, 'capilla', 'capillas') : ''}`
  return `<li><button type="button" class="item" data-id="${x.id}">
    <span class="mini">${miniSvg({ tipo, nivel: 0 }, MINI)}</span>
    <span class="txt"><strong>${esc(x.nombre)}</strong><small>${sub}</small></span>
    ${opciones.distancia ? `<span class="lado"><small>${esc(opciones.distancia)}</small></span>` : ''}</button></li>`
}

function ordenar<T extends { nombre: string; lat: number | null; lon: number | null }>(ls: T[], ctx: CtxVistas): T[] {
  if (!ctx.ubic) return [...ls].sort(porNombre)
  const u = ctx.ubic
  const d = (l: T) => (l.lat == null ? Infinity : distanciaKm(u, [l.lat, l.lon!]))
  return [...ls].sort((a, b) => d(a) - d(b))
}
const dist = (l: { lat: number | null; lon: number | null }, ctx: CtxVistas) => (ctx.ubic && l.lat != null ? formatKm(distanciaKm(ctx.ubic, [l.lat, l.lon!])) : '')

// ---- inicio: los decanatos ----
export function vistaInicio(ctx: CtxVistas): string {
  const capillas = ctx.datos.lugares.filter(l => l.tipo === 'Capilla')
  const cards = ctx.datos.decanatos.map((d, i) => {
    const ps = ctx.parroquias.filter(p => p.decanato === d), cs = capillas.filter(c => c.decanato === d), col = ctx.colegiosDe(d)
    const e = estiloZona(d, i)
    return `<button type="button" class="deca-card" data-deca="${esc(d)}" style="--z:${rellenoZona(d, i)};--zb:${e.borde}">
      <span class="deca-nombre"><i></i>${esc(d)}</span>
      <span class="deca-num"><b>${plural(ps.length, 'parroquia', 'parroquias')}</b></span>
      <small>${plural(cs.length, 'capilla', 'capillas')} · ${plural(col.length, 'colegio', 'colegios')}</small></button>`
  }).join('')
  // la fila de arriba es a la vez la leyenda del mapa y el resumen; los colegios se prenden y apagan desde ahí
  const ico = (t: TipoMarca) => miniSvg({ tipo: t, nivel: 0 }, 22)
  return `<div class="tipos">
      <span class="tipo">${ico('parroquia')}<span><b>${ctx.parroquias.length}</b> parroquias</span></span>
      <span class="tipo">${ico('capilla')}<span><b>${capillas.length}</b> capillas</span></span>
      <button type="button" class="tipo conmuta" data-accion="colegios" aria-pressed="${ctx.colegiosOn}" title="${ctx.colegiosOn ? 'Ocultar' : 'Mostrar'} los colegios en el mapa">${ico('colegio')}<span><b>${ctx.datos.colegios.length}</b> colegios</span><i class="sw" aria-hidden="true"></i></button>
    </div>
    <div class="deca-cards">${cards}</div>
    <button type="button" class="btn grande cerca" data-accion="cerca">${ICONO_CERCA}Las más cercanas a mí</button>`
}

// ---- un decanato: sus parroquias ----
const ICONO_CERCA = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>'

export function vistaDecanato(ctx: CtxVistas, decanato: string, i = 0): string {
  const ps = ordenar(ctx.parroquias.filter(p => p.decanato === decanato), ctx)
  const cs = ctx.datos.lugares.filter(l => l.tipo === 'Capilla' && l.decanato === decanato).length
  const col = ordenar(ctx.colegiosDe(decanato), ctx)
  const e = estiloZona(decanato, i)
  return `<div class="deca-cab" style="--z:${rellenoZona(decanato, i)};--zb:${e.borde}">
      <button type="button" class="icono-btn" data-accion="todos" aria-label="Volver a todos los decanatos">←</button>
      <i class="deca-chip"></i><h2>${esc(decanato)}</h2>
      <button type="button" class="btn-cerca-aqui${ctx.ubic ? ' activo' : ''}" data-accion="cerca-aqui" aria-pressed="${!!ctx.ubic}" title="Ordenar por cercanía">${ICONO_CERCA}<span>Cerca de mí</span></button>
    </div>
    <p class="deca-resumen">${plural(ps.length, 'parroquia', 'parroquias')} · ${plural(cs, 'capilla', 'capillas')} · ${plural(col.length, 'colegio', 'colegios')}${ctx.ubic ? ' · <b>por cercanía</b>' : ''}</p>
    <h3 class="grupo">Parroquias (${ps.length})</h3>
    <ul class="items">${ps.map(l => item(l, { distancia: dist(l, ctx) })).join('')}</ul>
    ${col.length ? `<h3 class="grupo">Colegios católicos (${col.length})</h3><ul class="items">${col.map(c => item(c, { distancia: dist(c, ctx) })).join('')}</ul>` : ''}`
}

// ---- las más cercanas a mí (parroquias y capillas) ----
export function vistaCercanas(ctx: CtxVistas, decanato: string | null, estado: 'pidiendo' | 'error' | 'ok', mensaje = ''): string {
  const cab = `<button type="button" class="volver" data-accion="${decanato ? 'decanato' : 'todos'}">← ${decanato ? esc(decanato) : 'Todos los decanatos'}</button><h2 class="invita">Las más cercanas a mí</h2>`
  if (estado === 'pidiendo') return `${cab}<p class="vacio">Buscando tu ubicación…</p>`
  if (estado === 'error' || !ctx.ubic) return `${cab}<p class="aviso-ubic">${esc(mensaje || 'No pudimos saber dónde estás. Revisá que el navegador tenga permiso para usar tu ubicación.')}</p>`
  const ls = ordenar(ctx.datos.lugares.filter(p => p.lat != null && (!decanato || p.decanato === decanato)), ctx).slice(0, 20)
  return `${cab}<p class="avance-txt">Parroquias y capillas, de la más cercana a la más lejana.</p>
    <ul class="items">${ls.map(l => item(l, { zona: !decanato, distancia: dist(l, ctx) })).join('')}</ul>`
}

// ---- búsqueda: parroquias, capillas y (si están a la vista) colegios ----
export function vistaBuscar(ctx: CtxVistas, q: string): string {
  if (!q.trim()) {
    const cuenta = new Map<string, number>()
    for (const l of ctx.datos.lugares) { const loc = l.localidad || l.localidad_guia; if (loc) cuenta.set(loc, (cuenta.get(loc) ?? 0) + 1) }
    const locs = [...cuenta.keys()].sort((a, b) => a.localeCompare(b, 'es'))
    return `<p class="vacio">Escribí el nombre de una parroquia o capilla, una calle o una localidad.</p>
      <h3 class="grupo">Por localidad</h3>
      <div class="chips-loc">${locs.map(l => `<button type="button" class="chip-loc" data-accion="buscar-en" data-q="${esc(l)}">${esc(l)}</button>`).join('')}</div>`
  }
  const ts = norm(q).split(/\s+/).filter(Boolean)
  const ok = (texto: string) => ts.every(t => norm(texto).includes(t))
  const ps = ctx.datos.lugares.filter(l => l.tipo !== 'Capilla' && ok(`${l.nombre} ${l.localidad} ${l.localidad_guia} ${l.direccion}`)).sort(porNombre)
  const cs = ctx.datos.lugares.filter(l => l.tipo === 'Capilla' && ok(`${l.nombre} ${l.localidad} ${l.localidad_guia} ${l.direccion}`)).sort(porNombre)
  const col = ctx.colegiosOn ? ctx.datos.colegios.filter(c => ok(`${c.nombre} ${c.localidad} ${c.niveles.map(n => n.nombre).join(' ')}`)).sort(porNombre) : []
  const bloque = (titulo: string, xs: (Lugar | Colegio)[]) => (xs.length ? `<h3 class="grupo">${titulo} (${xs.length})</h3><ul class="items">${xs.map(x => item(x, { zona: true })).join('')}</ul>` : '')
  const hay = ps.length + cs.length + col.length
  return `<p class="avance-txt">${hay ? plural(hay, 'resultado', 'resultados') : 'No encontramos nada con eso.'}</p>
    ${bloque('Parroquias', ps)}${bloque('Capillas', cs)}${bloque('Colegios', col)}
    ${hay ? '' : `<p class="vacio">Probá con el nombre de la parroquia, la calle o la localidad${ctx.colegiosOn ? '' : '. Los colegios aparecen cuando los mostrás en el mapa'}.</p>`}`
}

// ---- fichas ----
function cab(titulo: string, sub: string, extra = '', dir = ''): string {
  return `<div class="ficha-cab"><button type="button" class="btn-icono" data-accion="cerrar" aria-label="Volver">←</button>
    <div><h2>${esc(titulo)}</h2><p class="sub">${sub}${extra ? ` ${extra}` : ''}</p>${dir ? `<p class="dir">${dir}</p>` : ''}</div></div>`
}
// en la cabecera de la ficha, los nombres largos abreviados para que entre en un renglón
const CORTOS: Record<string, string> = { 'Remedios de Escalada': 'R. de Escalada' }
const corta = (loc: string) => CORTOS[loc] ?? loc
const sinDir = (d: string) => !d || /^(s\/d|sin sede central)$/i.test(d)
// Acciones: una fila de botones redondos con ícono y una palabra, como en Google Maps. Los números, correos y redes
// completos van abajo, en "Datos". En escritorio no se muestra "Llamar" (el número está en los datos).
const svg = (cuerpo: string, relleno = false) => `<svg width="22" height="22" viewBox="0 0 24 24" ${relleno ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${cuerpo}</svg>`
const ICONOS = {
  llegar: svg('<path d="M12 2.8l9.2 9.2-9.2 9.2L2.8 12z"/><path d="M9 15v-2.5a1.5 1.5 0 0 1 1.5-1.5H15"/><path d="M13 9l2 2-2 2"/>'),
  llamar: svg('<path d="M6.5 3.5h3l1.5 4.5-2 1.3a11 11 0 0 0 5.7 5.7l1.3-2 4.5 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>'),
  whatsapp: svg('<path d="M20.5 11.7a8.6 8.6 0 0 1-12.7 7.5L3.5 20.5l1.4-4.1a8.6 8.6 0 1 1 15.6-4.7z"/><path d="M9 8.6c.3-.6.6-.6.9-.6h.4c.2 0 .4.1.5.4l.6 1.5c.1.3 0 .5-.1.6l-.5.6c-.1.1-.1.3 0 .5a6 6 0 0 0 2.5 2.4c.2.1.4.1.5 0l.6-.7c.2-.2.4-.2.6-.1l1.5.7c.2.1.3.3.3.5v.4c0 .7-.7 1.3-1.4 1.4-.6.1-1.6 0-3.1-.8a8 8 0 0 1-3.5-3.5c-.6-1.3-.7-2.3-.3-3.3z" fill="currentColor" stroke="none"/>'),
  instagram: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>'),
  correo: svg('<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>'),
  facebook: svg('<path d="M14.5 21v-7.5h2.7l.4-3.2h-3.1V8.4c0-.9.3-1.6 1.6-1.6h1.6V4a21 21 0 0 0-2.4-.1c-2.4 0-4 1.4-4 4.1v2.4H8.6v3.2h2.7V21z"/>', true),
  web: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.3 3.4 5.2 3.4 8.5s-1.1 6.2-3.4 8.5c-2.3-2.3-3.4-5.2-3.4-8.5s1.1-6.2 3.4-8.5z"/>'),
}
interface Contacto { tel?: string | null; wa?: string | null; mail?: string | null; ig?: string | null; fb?: string | null; web?: string | null }
const MAX_ACCIONES = 5
function acciones(c: Contacto, llegar: string | null): string {
  const boton = (clase: string, href: string, ico: string, texto: string, afuera = true) =>
    `<a class="accion-ico ${clase}" href="${esc(href)}"${afuera ? ' target="_blank" rel="noopener noreferrer"' : ''}><span class="circ">${ico}</span><span class="lbl">${texto}</span></a>`
  const bs = [
    llegar ? boton('primario', llegar, ICONOS.llegar, 'Cómo llegar') : '',
    c.tel ? boton('llamar', telHref(c.tel), ICONOS.llamar, 'Llamar', false) : '',
    c.wa ? boton('', waHref(c.wa), ICONOS.whatsapp, 'WhatsApp') : '',
    c.ig ? boton('', c.ig, ICONOS.instagram, 'Instagram') : '',
    c.mail ? boton('', `mailto:${c.mail}`, ICONOS.correo, 'Correo', false) : '',
    c.fb ? boton('', c.fb, ICONOS.facebook, 'Facebook') : '',
    c.web ? boton('', c.web, ICONOS.web, 'Sitio web') : '',
  ].filter(Boolean).slice(0, MAX_ACCIONES)
  return bs.length ? `<div class="acciones-ficha">${bs.join('')}</div>` : ''
}
const url = (u: string) => (u && esUrl(u) ? u : null)
const ubicacionTexto = (x: { lat: number | null; revisar: boolean }) => (x.lat == null ? 'Todavía no está ubicado en el mapa.' : x.revisar ? 'La ubicación en el mapa es aproximada.' : '')

export function fichaLugar(l: Lugar, ctx: CtxVistas, chip: string): string {
  const madre = l.parroquia_id ? ctx.porId.get(l.parroquia_id) ?? null : null
  const base = madre ?? l // los datos de contacto son los de la parroquia
  const capillas = l.capillas.map(id => ctx.porId.get(id)).filter((x): x is Lugar => !!x)
  const colegios = l.colegios_vinculados.map(id => ctx.porIdCol.get(id)).filter((x): x is Colegio => !!x)
  // una capilla sin datos propios usa los de su parroquia (y en "Datos" se aclara)
  const propio = <T,>(xs: T[], ys: T[]) => (xs.length ? { v: xs, prestado: false } : { v: ys, prestado: ys.length > 0 && base !== l })
  const tels = propio(l.telefonos, base.telefonos), was = propio(l.whatsapp, base.whatsapp), mails = propio(l.emails, base.emails)
  const erec = l.ereccion.match(/(\d{4})/)?.[1]
  const r = l.web || l.facebook || l.instagram || l.youtube ? l : base // redes: las propias o, en una capilla, las de la parroquia
  const arroba = (u: string) => '@' + u.replace(/\/$/, '').split('/').pop()
  const redes = [
    r.web ? (esUrl(r.web) ? link(r.web, r.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) : esc(r.web)) : '',
    r.facebook ? (esUrl(r.facebook) ? `Facebook: ${link(r.facebook, arroba(r.facebook))}` : `Facebook: ${esc(r.facebook)}`) : '',
    r.instagram ? (esUrl(r.instagram) ? `Instagram: ${link(r.instagram, arroba(r.instagram))}` : `Instagram: ${esc(r.instagram)}`) : '',
    r.youtube ? (esUrl(r.youtube) ? link(r.youtube, 'YouTube') : `YouTube: ${esc(r.youtube)}`) : '',
  ].filter(Boolean).join('<br>')
  const dir = sinDir(l.direccion) ? '' : `${esc(l.direccion)}${l.cp ? ` <span class="det">(CP ${esc(l.cp)})</span>` : ''}`
  return `${cab(l.nombre, `${esc(l.tipo)} · ${esc(corta(l.localidad || l.localidad_guia))}`, chip, dir)}
  ${acciones({ tel: tels.v[0], wa: was.v[0], mail: mails.v[0], ig: url(l.instagram || base.instagram), fb: url(l.facebook || base.facebook), web: url(l.web || base.web) }, urlMaps(l))}
  ${madre ? `<p class="nota-capilla">Capilla de la parroquia <a href="#" data-accion="ir" data-id="${madre.id}">${esc(madre.nombre)}</a>.${tels.prestado || was.prestado || mails.prestado || r !== l ? ' El contacto es el de la parroquia.' : ''}</p>` : ''}
  <section><h3>Datos</h3>
    <dl class="datos">
      ${dir ? '' : fila('Dirección', esc(l.direccion))}
      ${fila('Teléfonos', tels.v.map(t => `<a href="${telHref(t)}">${esc(t)}</a>`).join('<br>'))}
      ${fila('WhatsApp', was.v.map(t => `<a href="${waHref(t)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`).join('<br>'))}
      ${fila('Correo', mails.v.map(m => `<a href="mailto:${esc(m)}">${esc(m)}</a>`).join('<br>'))}
      ${fila('Redes', redes)}
      ${fila(l.tipo === 'Capilla' ? 'Notas' : 'Desde', erec && l.tipo !== 'Capilla' ? `${esc(l.tipo)} desde ${erec}${/santuario/i.test(l.ereccion) ? ` <span class="det">(${esc(l.ereccion)})</span>` : ''}` : esc(l.notas_guia.join(' · ')))}
      ${fila('Ubicación', esc(ubicacionTexto(l)))}
    </dl></section>
  ${capillas.length ? `<section><h3>Capillas (${capillas.length})</h3><ul class="lista-simple">${capillas.map(c => `<li><a href="#" data-accion="ir" data-id="${c.id}">${esc(c.nombre)}</a> <span class="det">${esc(c.direccion)}</span></li>`).join('')}</ul></section>` : ''}
  ${colegios.length ? `<section><h3>Colegio en el mismo edificio</h3><ul class="lista-simple">${colegios.map(c => `<li><a href="#" data-accion="ir" data-id="${c.id}">${esc(c.nombre)}</a></li>`).join('')}</ul></section>` : ''}
  <p class="det">Datos de la Guía diocesana.</p>`
}

export function fichaColegio(c: Colegio, ctx: CtxVistas): string {
  const lugares = c.lugares_vinculados.map(id => ctx.porId.get(id)).filter((x): x is Lugar => !!x)
  const niveles = [...new Set(c.niveles.map(n => n.nivel))].join(', ')
  const fuente = c.fuente.url && esUrl(c.fuente.url) ? link(c.fuente.url, c.fuente.nombre) : esc(c.fuente.nombre)
  return `${cab(c.nombre, `Colegio católico${c.localidad ? ' · ' + esc(corta(c.localidad)) : ''}${niveles ? ' · ' + esc(niveles) : ''}`, '', sinDir(c.direccion) ? '' : esc(c.direccion))}
  ${acciones({ tel: c.telefonos[0], mail: c.emails[0] }, urlMaps(c))}
  <section><h3>Datos</h3>
    <dl class="datos">
      ${fila('Niveles', c.niveles.map(n => `${esc(n.nivel)}: ${esc(n.nombre)}`).join('<br>'))}
      ${fila('Teléfonos', c.telefonos.map(t => `<a href="${telHref(t)}">${esc(t)}</a>`).join('<br>'))}
      ${fila('Correo', c.emails.map(m => `<a href="mailto:${esc(m)}">${esc(m)}</a>`).join('<br>'))}
      ${fila('Propietario', esc(c.propietario))}
      ${fila('Notas', esc(c.notas_guia))}
      ${fila('Ubicación', esc(ubicacionTexto(c)))}
      ${fila('Fuente', `${fuente} <span class="det">(${fechaNum(c.fuente.fecha)})</span>`)}
    </dl></section>
  ${lugares.length ? `<section><h3>Parroquia o capilla en el mismo edificio</h3><ul class="lista-simple">${lugares.map(l => `<li><a href="#" data-accion="ir" data-id="${l.id}">${esc(l.nombre)}</a> <span class="det">${esc(l.tipo)}</span></li>`).join('')}</ul></section>` : ''}`
}

// ---- Acerca de ----
const linea = (grosor: number) => `<svg width="30" height="10" viewBox="0 0 30 10" aria-hidden="true"><path d="M1 5H29" stroke="#334155" stroke-width="${grosor}" fill="none"/></svg>`
export function vistaAcerca(ctx: CtxVistas): string {
  const t = (tipo: TipoMarca, nombre: string, texto: string) => `<li><span class="mini">${miniSvg({ tipo, nivel: 0 }, 24)}</span> <b>${nombre}</b>: ${texto}</li>`
  return `<button type="button" class="volver" data-accion="volver">← Volver</button>
    <h2 class="invita">Acerca de este mapa</h2>
    <p>Las parroquias y capillas de la Diócesis de Avellaneda-Lanús, con el radio de cada parroquia y los decanatos.</p>
    <h3 class="grupo">Cómo se lee</h3>
    <ul class="lista-simple">
      ${t('parroquia', 'Parroquia', 'cada una tiene su radio.')}
      ${t('capilla', 'Capilla', 'depende de una parroquia.')}
      ${t('colegio', 'Colegio católico', 'se muestran desde el inicio, con el interruptor.')}
      <li><span class="mini">${linea(3)}</span> <b>Decanato</b>: la unión de los radios de sus parroquias.</li>
      <li><span class="mini">${linea(1)}</span> <b>Radio parroquial</b>: se ve al elegir un decanato; el de la parroquia elegida queda marcado.</li>
    </ul>
    <h3 class="grupo">De dónde salen los datos</h3>
    <p>Los nombres, direcciones y contactos son los de la <a href="https://avellanedalanus.org.ar/" target="_blank" rel="noopener noreferrer">Guía diocesana</a>${ctx.datos.guia_fecha ? ` (consultada el ${fechaNum(ctx.datos.guia_fecha)})` : ''}. Los radios salen del mapa oficial de la diócesis, pasados a las calles, vías y arroyos.</p>
    <p class="det">Mapa base: <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">colaboradores de OpenStreetMap</a>. Datos actualizados el ${new Date(ctx.datos.generado).toLocaleDateString('es-AR')}.</p>`
}
