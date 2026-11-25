// Hoja inferior del celular (el panel): se arrastra con el dedo y se acomoda en tres alturas.
//  - mini: solo la manija y el buscador (o la cabecera del decanato)
//  - medio: la lista; en una ficha, solo lo justo (nombre y botones de contacto), así se ve el mapa
//  - alto: casi toda la pantalla (hasta la barra de arriba), para leer listas largas o la ficha entera
// Se arrastra desde la manija, el buscador o el contenido: hacia arriba la abre mientras no esté en "alto";
// hacia abajo la cierra cuando el contenido ya está scrolleado arriba del todo (como Google Maps).
// Al soltar, va a la altura más cercana a donde la habría llevado el envión.
// Con la hoja en mini, tocar cualquier parte visible la abre.
// Todo movimiento (arrastre y cambio de altura) es con transform, que lo hace la placa de video: cambiar la altura
// cuadro a cuadro obliga a recalcular y repintar el panel entero sobre el mapa y en los celulares se ve en cámara lenta.

export type PanelEstado = 'mini' | 'medio' | 'alto'
const ORDEN: PanelEstado[] = ['mini', 'medio', 'alto']
const PROPORCION_MEDIO = 0.46
const AIRE_ARRIBA = 8 // px entre la barra de arriba y la hoja en "alto"
const UMBRAL = 6 // px que tiene que moverse el dedo antes de decidir si arrastra la hoja o scrollea
const ENVION_MS = 180 // cuánto "proyecta" la velocidad al soltar
const DURACION_MS = 260
const CURVA = 'cubic-bezier(0.22, 0.9, 0.3, 1)'

export interface Hoja {
  estado(): PanelEstado
  poner(e: PanelEstado, animar?: boolean): void // animar = false: cambia de golpe (la búsqueda abre así)
  altura(e?: PanelEstado): number // px que tapa la hoja en ese estado (0 en escritorio)
  medirMini(): void // recalcula la altura mini (cambia según la vista)
  fijarMedio(px: number | null): void // altura de "medio" para esta vista (null: la de siempre)
  revisarMas(): void // vuelve a mirar si queda contenido abajo (después de cambiar la vista)
}

export function crearHoja(panel: HTMLElement, manija: HTMLElement, contenido: HTMLElement, buscador: HTMLElement,
  techo: HTMLElement, esMovil: () => boolean, alCambiar: (e: PanelEstado) => void = () => {}): Hoja {
  let actual: PanelEstado = 'medio'
  let mini = 84
  let medio: number | null = null

  const altoMax = () => window.innerHeight - techo.offsetHeight - AIRE_ARRIBA
  const altura = (e: PanelEstado = actual) =>
    !esMovil() ? 0 : e === 'mini' ? mini : e === 'alto' ? altoMax() : medio ?? Math.round(window.innerHeight * PROPORCION_MEDIO)

  function fijarMedio(px: number | null) {
    medio = px && esMovil() ? Math.round(Math.min(px, window.innerHeight * PROPORCION_MEDIO)) : null
    if (medio) panel.style.setProperty('--medio', `${medio}px`)
    else panel.style.removeProperty('--medio')
  }

  function medirMini() {
    const hManija = manija.offsetHeight || 24
    const hBusca = buscador.offsetHeight
    const primero = contenido.firstElementChild as HTMLElement | null
    const resto = hBusca > 0 ? hBusca + 2 : Math.min(64, (primero?.offsetHeight ?? 40) + 8)
    mini = hManija + resto
    panel.style.setProperty('--mini', `${mini}px`)
  }

  // ---- animación: la hoja toma la altura más grande de las dos (abajo de todo, lo que sobra queda fuera de la pantalla)
  // y se desplaza de la altura vieja a la nueva; al terminar queda con la altura del estado y sin desplazamiento.
  const visible = () => window.innerHeight - panel.getBoundingClientRect().top // lo que se ve de la hoja, con el desplazamiento
  let fin: number | null = null, desde: number | null = null
  function limpiar() {
    if (fin !== null) { clearTimeout(fin); fin = null }
    panel.style.transition = 'none'; panel.style.transform = ''; panel.style.height = ''
  }
  function animar() {
    if (desde === null) return // se canceló (un cambio sin animación en la misma tarea)
    const h0 = desde; desde = null
    limpiar()
    const h1 = panel.getBoundingClientRect().height // con la clase del estado nuevo (y lo que haya cambiado la vista)
    if (Math.abs(h1 - h0) < 2) return
    const H = Math.max(h0, h1)
    panel.style.height = `${H}px`
    panel.style.transform = `translateY(${H - h0}px)`
    void panel.offsetHeight
    panel.style.transition = `transform ${DURACION_MS}ms ${CURVA}`
    panel.style.transform = `translateY(${H - h1}px)`
    fin = window.setTimeout(() => { fin = null; panel.style.transition = 'none'; panel.style.transform = ''; panel.style.height = ''; revisarMas() }, DURACION_MS + 40)
  }

  function poner(e: PanelEstado, conAnimacion = true) {
    const cambia = e !== actual
    // la animación se arma al final de la tarea, cuando la vista ya terminó de cambiar (la altura de "medio" depende de ella)
    if (!conAnimacion) desde = null
    else if (esMovil() && desde === null) { desde = visible(); queueMicrotask(animar) }
    if (fin !== null || panel.style.transform) limpiar()
    actual = e
    panel.classList.remove('mini', 'medio', 'alto')
    panel.classList.add(e)
    if (desde === null) panel.style.height = ''
    manija.setAttribute('aria-label', e === 'mini' ? 'Abrir el panel' : 'Achicar el panel')
    manija.setAttribute('aria-expanded', String(e !== 'mini'))
    if (cambia) alCambiar(e)
  }

  // ---- arrastre ----
  let y0 = 0, h0 = 0, H = 0, modo: 'nada' | 'esperando' | 'hoja' | 'scroll' = 'nada', desdeContenido = false
  let muestras: [number, number][] = []

  const limitar = (h: number) => {
    const min = mini, max = altoMax()
    if (h < min) return min - (min - h) * 0.25
    if (h > max) return Math.min(max + 24, max + (h - max) * 0.25)
    return h
  }

  function empezar(y: number, delContenido: boolean) {
    y0 = y
    modo = 'esperando'; desdeContenido = delContenido
    muestras = [[performance.now(), y]]
  }

  // decide en el primer movimiento claro si es arrastre de la hoja o scroll del contenido
  function decidir(dy: number): 'hoja' | 'scroll' {
    if (!desdeContenido) return 'hoja'
    if (dy < 0) return actual === 'alto' ? 'scroll' : 'hoja' // hacia arriba: abrir hasta "alto", después scrollea
    return contenido.scrollTop <= 0 ? 'hoja' : 'scroll' // hacia abajo: cerrar solo si ya está arriba de todo
  }

  // devuelve true si el movimiento es de la hoja (para cortar el scroll nativo)
  function mover(y: number, x0dx = 0): boolean {
    if (modo === 'nada' || modo === 'scroll') return false
    const dy = y - y0
    if (modo === 'esperando') {
      if (Math.abs(dy) < UMBRAL || Math.abs(x0dx) > Math.abs(dy)) return false
      modo = decidir(dy)
      if (modo === 'scroll') return false
      panel.classList.add('arrastrando')
      y0 = y // sin salto al empezar
      // mientras se arrastra la hoja tiene la altura máxima y se desplaza (no se recalcula nada cuadro a cuadro)
      h0 = visible(); limpiar()
      H = altoMax() + 24
      panel.style.height = `${H}px`
    }
    panel.style.transform = `translateY(${H - limitar(h0 + (y0 - y))}px)`
    muestras.push([performance.now(), y]); if (muestras.length > 6) muestras.shift()
    return true
  }

  // al soltar: altura proyectada con la velocidad del final del gesto, y el estado más cercano
  function soltar(): boolean {
    const eraHoja = modo === 'hoja'
    modo = 'nada'
    if (!eraHoja) return false
    panel.classList.remove('arrastrando')
    // velocidad de los últimos ~100 ms del gesto; si el dedo quedó quieto antes de soltar, no hay envión
    const ultimo = muestras[muestras.length - 1][0]
    const recientes = performance.now() - ultimo < 150 ? muestras.filter(([t]) => ultimo - t < 100) : []
    let v = 0 // px/ms, positivo = hacia arriba
    if (recientes.length >= 2) {
      const [ta, ya] = recientes[0], [tb, yb] = recientes[recientes.length - 1]
      if (tb > ta) v = (ya - yb) / (tb - ta)
    }
    const h = visible()
    const proyectada = h + v * ENVION_MS
    let destino = ORDEN.reduce((a, b) => (Math.abs(altura(b) - proyectada) < Math.abs(altura(a) - proyectada) ? b : a))
    // un envión claro siempre cambia de estado, aunque haya sido corto
    if (destino === actual && Math.abs(v) > 0.4) {
      const i = ORDEN.indexOf(actual) + (v > 0 ? 1 : -1)
      destino = ORDEN[Math.max(0, Math.min(ORDEN.length - 1, i))]
    }
    poner(destino) // anima desde donde quedó el dedo
    return true
  }

  // manija: puntero (dedo o mouse); un toque sin mover abre o achica
  // (en el pointerup Chrome ya soltó la captura, así que el puntero activo se lleva aparte)
  let puntero: number | null = null
  manija.addEventListener('pointerdown', e => {
    if (!esMovil() || puntero !== null) return
    puntero = e.pointerId
    manija.setPointerCapture(e.pointerId)
    empezar(e.clientY, false)
  })
  manija.addEventListener('pointermove', e => { if (e.pointerId === puntero) mover(e.clientY) })
  const finManija = (e: PointerEvent) => {
    if (e.pointerId !== puntero) return
    puntero = null
    if (manija.hasPointerCapture(e.pointerId)) manija.releasePointerCapture(e.pointerId)
    if (!soltar() && e.type === 'pointerup') poner(actual === 'mini' ? 'medio' : 'mini')
  }
  manija.addEventListener('pointerup', finManija)
  manija.addEventListener('pointercancel', finManija)
  // teclado (Enter / espacio sobre la manija)
  manija.addEventListener('click', e => { if (e.detail === 0) poner(actual === 'mini' ? 'medio' : 'mini') })

  // buscador y contenido: touch, para poder cortar el scroll nativo solo cuando el gesto es de la hoja
  let x0 = 0
  panel.addEventListener('touchstart', e => {
    if (!esMovil() || e.touches.length !== 1 || manija.contains(e.target as Node)) return
    if ((e.target as HTMLElement).closest('textarea, select, input[type=range]')) return // tienen su propio gesto
    x0 = e.touches[0].clientX
    empezar(e.touches[0].clientY, contenido.contains(e.target as Node))
  }, { passive: true })
  panel.addEventListener('touchmove', e => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    if (mover(t.clientY, t.clientX - x0) && e.cancelable) e.preventDefault()
  }, { passive: false })
  panel.addEventListener('touchend', e => { if (soltar()) e.preventDefault() })
  panel.addEventListener('touchcancel', () => { soltar() })

  // en mini, tocar la parte visible (salvo el buscador y los botones) abre la hoja
  panel.addEventListener('click', e => {
    if (!esMovil() || actual !== 'mini') return
    const t = e.target as HTMLElement
    if (manija.contains(t) || t.closest('input, button, a, select, label')) return
    poner('medio')
  })

  const medirTecho = () => panel.style.setProperty('--techo', `${techo.offsetHeight + AIRE_ARRIBA}px`)
  medirTecho()
  window.addEventListener('resize', () => { medirTecho(); medirMini() })
  // ---- "hay más abajo" ----
  // Si el contenido sigue más abajo de lo que se ve, el final se desvanece y aparece una flechita:
  // tocarla abre la hoja entera (o, si ya está entera, baja un tramo). Arriba, una sombra cuando ya se scrolleó.
  const mas = document.createElement('button')
  mas.type = 'button'; mas.className = 'hay-mas'; mas.setAttribute('aria-label', 'Ver más')
  mas.innerHTML = '<span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></span>'
  panel.appendChild(mas)
  function revisarMas() {
    const queda = contenido.scrollHeight - contenido.scrollTop - contenido.clientHeight
    panel.classList.toggle('con-mas', queda > 12 && !(esMovil() && actual === 'mini'))
    panel.classList.toggle('scrolleado', contenido.scrollTop > 2)
  }
  mas.addEventListener('click', () => {
    if (esMovil() && actual !== 'alto') poner('alto')
    else contenido.scrollBy({ top: Math.round(contenido.clientHeight * 0.7), behavior: 'smooth' })
  })
  contenido.addEventListener('scroll', revisarMas, { passive: true })
  new ResizeObserver(revisarMas).observe(contenido) // cambia de alto con la hoja
  panel.addEventListener('transitionend', revisarMas)

  return { estado: () => actual, poner: (e: PanelEstado, animar = true) => { poner(e, animar); revisarMas() }, altura, medirMini, fijarMedio, revisarMas }
}
