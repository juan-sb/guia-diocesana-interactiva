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

export function urlMaps(l: { lat: number | null; lon: number | null; direccion: string; localidad: string }): string | null {
  if (l.lat != null && l.lon != null) return `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lon}`
  if (!l.direccion || /^(s\/d|sin sede central)$/i.test(l.direccion)) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.direccion}, ${l.localidad}, Buenos Aires, Argentina`)}`
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
const sinDir = (d: string) => !d || /^(s\/d|sin sede central)$/i.test(d)
// Todo el contacto que publica la Guía, a mano: llamar (en el celular), WhatsApp, Instagram y, si no hay teléfono ni WhatsApp, el correo.
interface Contacto { tel: string | null; wa: string | null; mail: string | null; ig: { url: string; texto: string } | null }
function acciones({ tel, wa, mail, ig }: Contacto, llegar: string | null): string {
  const pares = [
    tel ? `<a class="btn accion llamar" href="${telHref(tel)}"><b>Llamar</b><small>${esc(tel)}</small></a>` : '', // en el celular, botón
    wa ? `<a class="btn accion" href="${waHref(wa)}" target="_blank" rel="noopener noreferrer"><b>WhatsApp</b><small>${esc(wa)}</small></a>` : '',
    !tel && !wa && mail ? `<a class="btn accion" href="mailto:${esc(mail)}"><b>Correo</b><small>${esc(mail)}</small></a>` : '',
    ig ? `<a class="btn accion" href="${esc(ig.url)}" target="_blank" rel="noopener noreferrer"><b>Instagram</b><small>${esc(ig.texto)}</small></a>` : '',
  ].filter(Boolean)
  // en escritorio no hay a dónde llamar: se muestra el número, copiable
  const numero = tel ? `<div class="tel-escritorio"><span class="det">Teléfono</span><span class="num">${esc(tel)}</span><button type="button" class="btn chico" data-copiar="${esc(tel)}">Copiar</button></div>` : ''
  return `<div class="acciones-ficha">${numero}${pares.length ? `<div class="par-acciones${pares.length === 1 ? ' uno' : ''}">${pares.join('')}</div>` : ''}
    ${llegar ? `<a class="btn primario grande" href="${esc(llegar)}" target="_blank" rel="noopener noreferrer">Ver en Google Maps</a>` : '<span class="btn deshabilitado grande">Ver en Google Maps (no tenemos la dirección)</span>'}</div>`
}
const instagram = (u: string) => (u ? { url: u, texto: '@' + u.replace(/\/$/, '').split('/').pop() } : null)
const ubicacionTexto = (x: { lat: number | null; revisar: boolean }) => (x.lat == null ? 'Todavía no está ubicado en el mapa.' : x.revisar ? 'La ubicación en el mapa es aproximada.' : '')

export function fichaLugar(l: Lugar, ctx: CtxVistas, chip: string): string {
  const madre = l.parroquia_id ? ctx.porId.get(l.parroquia_id) ?? null : null
  const base = madre ?? l // los datos de contacto son los de la parroquia
  const capillas = l.capillas.map(id => ctx.porId.get(id)).filter((x): x is Lugar => !!x)
  const colegios = l.colegios_vinculados.map(id => ctx.porIdCol.get(id)).filter((x): x is Colegio => !!x)
  const tels = l.telefonos.length ? l.telefonos : base.telefonos
  const erec = l.ereccion.match(/(\d{4})/)?.[1]
  const redes = [
    l.web ? (esUrl(l.web) ? link(l.web, 'Sitio web') : esc(l.web)) : '',
    l.facebook ? (esUrl(l.facebook) ? link(l.facebook, 'Facebook') : `Facebook: ${esc(l.facebook)}`) : '',
    l.instagram ? (esUrl(l.instagram) ? link(l.instagram, 'Instagram') : `Instagram: ${esc(l.instagram)}`) : '',
    l.youtube ? (esUrl(l.youtube) ? link(l.youtube, 'YouTube') : `YouTube: ${esc(l.youtube)}`) : '',
  ].filter(Boolean).join('<br>')
  const dir = sinDir(l.direccion) ? '' : `${esc(l.direccion)}${l.cp ? ` <span class="det">(CP ${esc(l.cp)})</span>` : ''}`
  return `${cab(l.nombre, `${esc(l.tipo)} · ${esc(l.localidad || l.localidad_guia)}`, chip, dir)}
  ${acciones({ tel: tels[0] ?? null, wa: (l.whatsapp.length ? l.whatsapp : base.whatsapp)[0] ?? null, mail: (l.emails.length ? l.emails : base.emails)[0] ?? null, ig: instagram(l.instagram || base.instagram) }, urlMaps(l))}
  ${madre ? `<p>Capilla de la parroquia <a href="#" data-accion="ir" data-id="${madre.id}">${esc(madre.nombre)}</a>.</p>` : ''}
  <section><h3>Datos</h3>
    <dl class="datos">
      ${dir ? '' : fila('Dirección', esc(l.direccion))}
      ${fila('Teléfonos', l.telefonos.map(t => `<a href="${telHref(t)}">${esc(t)}</a>`).join('<br>'))}
      ${fila('WhatsApp', l.whatsapp.map(esc).join('<br>'))}
      ${fila('Correo', l.emails.map(m => `<a href="mailto:${esc(m)}">${esc(m)}</a>`).join('<br>'))}
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
  return `${cab(c.nombre, `Colegio católico${c.localidad ? ' · ' + esc(c.localidad) : ''}${niveles ? ' · ' + esc(niveles) : ''}`, '', sinDir(c.direccion) ? '' : esc(c.direccion))}
  ${acciones({ tel: c.telefonos[0] ?? null, wa: null, mail: c.emails[0] ?? null, ig: null }, urlMaps(c))}
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
