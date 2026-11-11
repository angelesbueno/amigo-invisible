# Tasks

## 1. Inicialización del proyecto

- [x] 1.1 Crear `package.json` con nombre, versión, scripts (`start`, `test`) y lista de dependencias (`express`, `better-sqlite3`, `resend`, `uuid`) y verificar que `npm install` finaliza sin errores
- [x] 1.2 Crear la estructura de carpetas definida en design.md D1 (`src/routes/`, `public/`, `test/`) y verificar que todos los directorios existen
- [x] 1.3 Crear `.gitignore` con `node_modules/`, `*.sqlite`, `.env` y verificar que `git status` no muestra esos paths
- [x] 1.4 Crear `.env.example` con `RESEND_API_KEY=`, `BASE_URL=`, `ADMIN_SECRET=`, `PORT=3000` y verificar que el archivo existe y documenta todas las variables requeridas en design.md D5

## 2. Base de datos

- [x] 2.1 Implementar `src/db.js` con la inicialización de better-sqlite3 y la creación de las 4 tablas del esquema (design.md D2: `sorteos` con campos `email_organizador` y `mensaje`, `participantes`, `exclusiones`, `asignaciones`) y verificar que `node src/db.js` no lanza errores y crea el archivo SQLite
- [x] 2.2 Escribir test `test/db.test.js` que verifica que las 4 tablas existen tras la inicialización y que las restricciones UNIQUE de `participantes(sorteo_id, email)` y `exclusiones` se cumplen; verificar con `node --test test/db.test.js`

## 3. Algoritmo de asignación

- [x] 3.1 Implementar `src/sorteo.js` con la función `asignar(participantes, exclusiones)` según el pseudocódigo de design.md D4 (Fisher-Yates con 1.000 reintentos, lanzando `SORTEO_IMPOSIBLE` si no converge) y verificar que el módulo exporta la función sin errores de sintaxis
- [x] 3.2 Escribir tests en `test/algoritmo-asignacion.test.js` con los escenarios de la spec `algoritmo-asignacion`:
  - `Asignación sin exclusiones`
  - `Asignación con exclusiones válidas`
  - `Asignación con exclusiones que hacen el sorteo imposible`
  - `Token único por participante`
  - `Persistencia antes del envío`
  y verificar con `node --test test/algoritmo-asignacion.test.js`

## 4. Rutas de administración (API)

- [x] 4.1 Implementar `src/routes/admin.js` con los endpoints `POST /api/sorteos` (valida `admin_secret` del body contra `ADMIN_SECRET` env → 403 si falla; requiere `nombre`, `email_organizador`; envía email al organizador con la URL del panel al crear) y `GET /api/admin/:token_admin` (design.md D3); añadir tests para los escenarios `Crear sorteo con datos válidos`, `Crear sorteo con clave de administrador incorrecta`, `Crear sorteo con nombre vacío` y `Email de acceso admin enviado al crear sorteo`; verificar que el servidor arranca y responde 200 / 403 según corresponda con `node --test test/gestion-sorteo.test.js`
- [x] 4.2 Implementar endpoints de participantes: `POST /api/admin/:token_admin/participantes` y `DELETE /api/admin/:token_admin/participantes/:id`, cubriendo validación de email único y rechazo si el sorteo ya está lanzado; verificar con tests `test/gestion-sorteo.test.js` para los escenarios:
  - `Crear sorteo con nombre válido`
  - `Crear sorteo con nombre vacío`
  - `Añadir participante con datos válidos`
  - `Añadir participante con email duplicado`
  - `Añadir participante a sorteo ya lanzado`
  - `Eliminar participante en sorteo pendiente`
  - `Acceso con token_admin válido`
  - `Acceso sin token o con token inválido`
- [x] 4.3 Implementar endpoints de exclusiones: `POST /api/admin/:token_admin/exclusiones` y `DELETE /api/admin/:token_admin/exclusiones/:id`, con validación bidireccional e idempotencia; añadir tests para los escenarios:
  - `Definir exclusión válida`
  - `Excluir participante consigo mismo`
  - `Exclusión duplicada`
  - `Eliminar exclusión existente`
  y verificar con `node --test test/gestion-sorteo.test.js`
- [x] 4.4 Implementar `PATCH /api/admin/:token_admin/mensaje` que actualiza el mensaje personalizado del sorteo (máx. 500 caracteres) mientras el estado sea `pendiente`; mensaje vacío elimina el existente; añadir tests para los escenarios `Añadir mensaje personalizado`, `Mensaje vacío elimina el mensaje existente` y `Mensaje demasiado largo`; verificar con `node --test test/gestion-sorteo.test.js`
- [x] 4.5 Implementar `POST /api/admin/:token_admin/lanzar` que valida mínimo 3 participantes, ejecuta `asignar()`, persiste asignaciones, actualiza estado a `lanzado` y dispara el envío de emails; añadir tests para los escenarios:
  - `Lanzar sorteo con suficientes participantes`
  - `Lanzar sorteo con menos de 3 participantes`
  - `Lanzar sorteo ya lanzado`
  y verificar con `node --test test/gestion-sorteo.test.js`

## 5. Integración de email

- [x] 5.1 Implementar `src/email.js` con la función `enviarEmailParticipante({ nombre, email, nombreSorteo, token, baseUrl })` usando el SDK de Resend (design.md D5) y verificar que el módulo se importa sin errores con las variables de entorno configuradas
- [x] 5.2 Implementar `POST /api/admin/:token_admin/reenviar/:participante_id` y verificar que rechaza con error si el sorteo está en estado `pendiente`
- [x] 5.3 Escribir `test/notificacion-email.test.js` con mock del SDK de Resend cubriendo los escenarios:
  - `Envío exitoso a todos los participantes`
  - `Fallo de envío en uno o más participantes`
  - `Email recibido por el participante` (verifica campos: nombre, nombreSorteo, enlace sin receptor)
  - `Reenvío exitoso`
  - `Reenvío en sorteo no lanzado`
  - `Sin email de resultados al organizador`
  - `Email de acceso admin enviado al crear sorteo`
  - `El email de acceso admin no revela asignaciones`
  y verificar con `node --test test/notificacion-email.test.js`

## 6. Ruta del participante y privacidad

- [x] 6.1 Implementar `src/routes/participante.js` con `GET /api/resultado/:token` que devuelve el nombre del receptor si el token es válido y el sorteo está lanzado, 404 si el token no existe, y mensaje de sorteo pendiente si el estado es `pendiente`
- [x] 6.2 Escribir `test/vista-participante.test.js` cubriendo los escenarios:
  - `Acceso con token válido`
  - `Token válido pero sorteo pendiente`
  - `Token inexistente`
  - `URL de resultado sin token`
  - `Segunda visita con el mismo enlace`
  y verificar con `node --test test/vista-participante.test.js`
- [x] 6.3 Escribir `test/privacidad-organizador.test.js` cubriendo los escenarios:
  - `Organizador consulta el panel tras lanzar el sorteo`
  - `Organizador intenta acceder a la API de resultados`
  - `Uso de token_admin en endpoint de participante`
  - `Uso de token de participante en panel de administración`
  - `Intento de obtener todas las asignaciones`
  y verificar con `node --test test/privacidad-organizador.test.js`

## 7. Servidor principal y frontend

- [x] 7.1 Implementar `server.js` que monta las rutas de admin y participante, sirve `public/` como estáticos y escucha en `process.env.PORT || 3000`; verificar que `node server.js` arranca sin errores y responde en `GET /`
- [x] 7.2 Crear `public/index.html` con formulario para crear sorteo (campos: nombre del sorteo, email del organizador, clave de administrador) que llama a `POST /api/sorteos` y redirige a `admin.html?token=...` al recibir la respuesta; verificar abriendo en navegador y creando un sorteo de prueba
- [x] 7.3 Crear `public/admin.html` con panel de organizador: lista de participantes, añadir/eliminar participante, gestión de exclusiones, campo para mensaje personalizado opcional (con contador de caracteres hasta 500), botón lanzar sorteo y botón reenviar email por participante; verificar que el panel no muestra asignaciones en ningún estado del sorteo
- [x] 7.4 Crear `public/resultado.html` que lee el token de la URL, llama a `GET /api/resultado/:token` y muestra el nombre del receptor con diseño festivo; verificar en 320px y 768px que no hay scroll horizontal
- [x] 7.5 Crear `public/style.css` con paleta oklch, tipografía Playfair Display + Inter, animaciones CSS (copos de nieve, @starting-style en tarjeta resultado, pulso en botón lanzar) y breakpoints mobile-first (480px, 768px, 1024px); verificar en Chrome DevTools con emulación de dispositivo móvil

## 8. Integración final y preparación para despliegue

- [x] 8.1 Ejecutar la suite completa con `npm test` y verificar que todos los tests pasan sin errores
- [x] 8.2 Crear `README.md` con instrucciones de instalación local, descripción de variables de entorno y pasos de despliegue en Railway (design.md D9); verificar que los comandos documentados funcionan ejecutándolos
- [x] 8.3 Configurar script `"start": "node server.js"` en `package.json` y verificar que Railway despliega sin errores haciendo push a GitHub
- [x] 8.4 Realizar sorteo de prueba end-to-end en producción: crear sorteo, añadir 3+ participantes con emails reales, definir al menos una exclusión, lanzar y verificar que cada participante recibe el email con su enlace personal y que el enlace muestra el nombre correcto

## Workflow follow-up

- Archivar el cambio una vez que el sorteo de prueba end-to-end en producción sea satisfactorio.
- Compartir la URL de la aplicación con la familia antes de Navidad 2026.
