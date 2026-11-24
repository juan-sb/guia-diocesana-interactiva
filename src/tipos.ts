// Datos públicos (public/datos.json). Los arma `npm run publicar` en el repo interno, con una lista blanca de campos.

export type Tipo = 'Parroquia' | 'Cuasiparroquia' | 'Capilla'

export interface Lugar {
  id: string
  tipo: Tipo
  nombre: string
  parroquia_id: string
  parroquia: string
  direccion: string
  cp: string
  localidad: string
  localidad_guia: string
  decanato: string
  lat: number | null
  lon: number | null
  revisar: boolean // la ubicación en el mapa es aproximada
  telefonos: string[]
  whatsapp: string[]
  emails: string[]
  web: string
  facebook: string
  instagram: string
  youtube: string
  ereccion: string
  notas_guia: string[]
  capillas: string[] // ids, solo en parroquias
  colegios_vinculados: string[] // colegios que comparten edificio
}

export interface Colegio {
  id: string
  tipo: 'Colegio'
  nombre: string
  direccion: string
  localidad: string
  lat: number | null
  lon: number | null
  revisar: boolean
  niveles: { nivel: string; nombre: string }[]
  telefonos: string[]
  emails: string[]
  propietario: string
  notas_guia: string
  lugares_vinculados: string[]
  fuente: { nombre: string; url?: string; fecha: string }
}

export interface Zona { decanato: string; geometry: { type: 'MultiPolygon'; coordinates: number[][][][] }; etiqueta: [number, number] } // etiqueta: [lat, lon]
export interface Radio { id: string; geometry: { type: 'MultiPolygon'; coordinates: number[][][][] } }

export interface Datos {
  generado: string
  guia_fecha: string
  decanatos: string[]
  lugares: Lugar[]
  colegios: Colegio[]
  zonas: Zona[] // zona de cada decanato: la unión de los radios de sus parroquias
  radios: Radio[] // radio de cada parroquia (mismo id que la parroquia)
  contorno: number[][][][] // contorno exterior de Avellaneda y Lanús
}
