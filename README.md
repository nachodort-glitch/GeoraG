# Geora

Aplicación de aprendizaje de geografía en español: 195 países, cuatro modalidades, atlas y perfil. El invitado funciona sin servicios externos. Los datos y las banderas se incluyen localmente.

## Abrir en tu ordenador

Requiere Node.js 22.13 o posterior.

```sh
npm ci
npm run dev
```

Abre la dirección que muestra la terminal (normalmente http://localhost:5173). Para las pruebas: `npm test`. Comprueba tipos: `npx tsc --noEmit`. Compila: `npm run build`.

Esta edición utiliza React, TypeScript, Tailwind y la API App Router de Next.js sobre Vinext/Vite, el entorno compatible con Cloudflare de Sites. MapLibre GL JS usa geometrías y su worker servidos desde el proyecto, sin claves de mapas.

## Reglas y guardado

- Banderas, capitales y mapa: 3 vidas. Expedición: 6 vidas.
- Solo los aciertos completan etapas. Los fallos vuelven al final de la cola.
- En Expedición se conservan las etapas acertadas. Un país exige las tres.
- Cada confirmación incorrecta resta una vida. Cero vidas termina el intento.
- La pantalla de solución se guarda junto a las vidas, la cola y los aciertos: recargar no deja contestar otra vez esa respuesta.
- El historial y el aprendizaje por habilidad viven separados del intento.
- Guardado local después de cada respuesta; exportación/importación de copias JSON.
- No hay temporizador ni recuperación de vidas.

## Cuentas opcionales

La interfaz no simula cuentas. Sin configuración, muestra que estás como invitado.

1. Crea un proyecto Supabase y activa acceso por enlace de correo.
2. Ejecuta `docs/supabase.sql`. Las políticas RLS limitan cada fila a su propietario.
3. Copia `.env.example` a `.env.local` y configura la URL y la clave pública/anon de ese proyecto. Nunca uses una clave service-role en el cliente.
4. Añade el origen de la web a las URL de redirección permitidas en Supabase y configura correo/SMTP según tu servicio.
5. Reinicia o recompila la web. En Mi perfil aparecerá el formulario de acceso real.

La sincronización es manual y explícita: subir la copia local o recuperar la copia remota, con confirmación de reemplazo. No mezcla intentos en conflicto ni finge sincronización automática. Esta integración requiere credenciales propias y no se ha probado contra una cuenta real en esta entrega.

## Estructura reutilizable

- `lib/game.ts`: máquina de estados pura, cola, vidas, etapas y estadísticas; sin React ni DOM.
- `lib/validation.ts`: normalización, variantes y una oportunidad para corregir errores inequívocos.
- `lib/countries.json` y `lib/content.ts`: contenido versionado y claves ISO alpha-3.
- `lib/persistence.ts`: adaptador local y validación de copias.
- `lib/sync.ts`: adaptador Supabase opcional.
- `components/world-map.tsx`: mapa, selección previa, confirmación separada, puntos para países pequeños y navegación por zonas con teclado.
- `app/page.tsx`: vistas y coordinación de la interfaz.

En React Native/Expo se pueden compartir reglas, validación y contenido; se sustituyen los adaptadores de almacenamiento y la vista de mapa.

## Contenido y licencias

Consulta `docs/DATOS.md` y la pantalla «Datos y criterios». El contenido derivado se distribuye bajo ODbL; las banderas conservan licencia MIT; los mapas proceden de Natural Earth, dominio público. Las licencias completas están en `public/data` y `public/vendor`.

## PWA y límites conocidos

Manifiesto, iconos de 192/512 píxeles y service worker incluidos. El worker almacena datos y banderas consultados. El arranque completo sin conexión no está garantizado: se necesita cargar la aplicación y sus recursos inicialmente. No se guardan respuestas de autenticación en la caché.

El mapa requiere WebGL. Las zonas numeradas y sus coordenadas facilitan usar teclado, sin revelar nombres. Las fronteras simplificadas sirven al aprendizaje general, no a navegación o delimitación jurídica.

## Validación

Pruebas automatizadas de vidas, derrota inmediata, victoria, reaparición de fallos, idempotencia, etapas de Expedición, serialización, reinicio, normalización y racha. El test de contenido comprueba 195 IDs únicos, banderas SVG y polígonos vinculados. La revisión visual cubre inicio, configuración, juego, mapa, atlas y perfil en escritorio/móvil.
