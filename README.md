# Mapa de parroquias · Guía diocesana Avellaneda-Lanús

Mapa interactivo de las parroquias y capillas de la Diócesis de Avellaneda-Lanús: el radio de cada parroquia, los decanatos, y los datos de contacto que publica la [Guía diocesana](https://avellanedalanus.org.ar/guia-diocesana/). Es de solo lectura: un sitio estático servido con GitHub Pages.

## Insertarlo en la página de la guía

En una página de WordPress (módulo de código o bloque HTML personalizado):

```html
<iframe src="https://juan-sb.github.io/guia-diocesana-interactiva/"
        title="Mapa de parroquias de la Diócesis de Avellaneda-Lanús"
        style="width:100%; height:80vh; min-height:560px; border:0;"
        loading="lazy" allow="geolocation"></iframe>
```

`allow="geolocation"` hace que funcione "Las más cercanas a mí" dentro del iframe. También se puede enlazar directo desde el menú de la Guía.

## Qué muestra

- Los 4 decanatos (la unión de los radios de sus parroquias) y, al elegir uno, los radios de sus parroquias.
- Cada parroquia y capilla con su dirección, teléfonos, correo y redes de la Guía diocesana, y el botón para abrirla en Google Maps.
- Búsqueda por nombre, calle o localidad, y las más cercanas a tu ubicación.
- Colegios católicos (opcional, desde el inicio o el menú ⋯), con nombre, dirección y niveles.

## Datos

`public/datos.json` no se edita a mano: lo genera `npm run publicar` en el repo interno del mapa (privado), con una lista blanca de campos públicos. Para actualizar:

1. En el repo interno: `npm run publicar` (escribe `../guia-diocesana-interactiva/public/datos.json`).
2. Acá: revisar el cambio (`git diff --stat`), commit y push a `main`. GitHub Actions arma el sitio y lo publica en unos minutos.

## Desarrollo

```
npm install
npm run dev       # http://localhost:5173
npm run build     # typecheck + build en dist/
```

Vite + TypeScript + [MapLibre GL](https://maplibre.org/). Un solo mapa: el fondo, los decanatos, los radios y los marcadores se dibujan juntos en la GPU (`src/mapa/capas.ts`). Colores y tipografía de la Guía diocesana (azul `#003c71`, dorado `#cfb43c`, Fira Sans): `src/style.css`, al final.

## Créditos

Mapa base: [OpenFreeMap](https://openfreemap.org) · © [OpenMapTiles](https://openmaptiles.org/) · datos © [colaboradores de OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL). Calles, vías y límites de partidos usados para trazar los radios: © colaboradores de OpenStreetMap (ODbL).
