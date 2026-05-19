AGENDA DENTAL PWA
=================

Aplicación web local para pacientes, tratamientos y pagos por sesión, materiales y trabajos externos de laboratorio dental.

ARCHIVOS PRINCIPALES
--------------------
- index.html: dashboard principal.
- pacientes.html: CRUD de pacientes y programación de citas.
- tratamientos.html: CRUD de tratamientos.
- tratamiento-detalle.html: sesiones y pagos por tratamiento.
- materiales.html: bloc de compras.
- trabajos.html: trabajos externos de laboratorio.
- app.js: IndexedDB, CRUD, cálculos y recordatorios.
- style.css: diseño responsive.
- manifest.json: configuración instalable PWA.
- sw.js: funcionamiento offline cuando se usa servidor local o HTTPS.

COMO PROBAR EN LAPTOP
---------------------
Opción rápida:
1. Abre index.html con doble clic.
2. La app funciona con datos locales en IndexedDB.
3. En modo file:// no se puede registrar el Service Worker, por restricción del navegador.

Opción recomendada para probar como PWA:
1. Abre una terminal dentro de esta carpeta.
2. Ejecuta uno de estos comandos:
   - Con Node instalado: node local-server.js
   - Windows/Mac con Python: python -m http.server 8000
   - Si tu Python usa python3: python3 -m http.server 8000
3. Abre en el navegador:
   http://localhost:8000
4. Activa las notificaciones desde el botón de campana en el inicio.

COMO INSTALAR EN ANDROID
------------------------
1. Sirve la carpeta desde localhost para pruebas o súbela a un hosting estático HTTPS gratuito si quieres instalarla en otro teléfono.
2. Abre la URL en Chrome.
3. Menú de Chrome > Agregar a pantalla principal o Instalar app.

COMO INSTALAR EN IPHONE
-----------------------
1. Abre la URL en Safari.
2. Pulsa Compartir.
3. Elige Agregar a pantalla de inicio.

DATOS Y PRIVACIDAD
------------------
- No hay login.
- No usa servidor.
- No usa APIs de pago.
- Los datos se guardan solo en el navegador del dispositivo mediante IndexedDB.
- Si se borra el historial/datos del navegador, se pueden perder los datos.

NOTIFICACIONES LOCALES
----------------------
- La app usa Notification API.
- Los recordatorios de citas y trabajos se revisan mientras la app está abierta o instalada y activa.
- Los navegadores móviles, especialmente iOS, limitan las notificaciones programadas puramente locales cuando la app está cerrada por completo.
- La app no usa servidores push porque el requisito es funcionar sin costos y sin backend.

ICONO PWA
---------
La app incluye icons/icon.svg para el icono instalable. Si quieres un acabado más personalizado, puedes reemplazarlo por el logo del consultorio.
