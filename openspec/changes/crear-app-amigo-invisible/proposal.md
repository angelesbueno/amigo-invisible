# Proposal

## Why

La familia no dispone de ninguna herramienta digital para organizar su sorteo anual de Amigo Invisible. El proceso manual (papeles en un sombrero, mensajes por WhatsApp) no garantiza la privacidad ni permite que cada participante consulte su asignación cuando lo necesite. Se construye ahora — antes de Navidad 2026 — para que esté disponible en producción cuando la familia lo necesite.

## What Changes

- Nueva aplicación web completa construida desde cero sobre el stack fijado.
- El organizador puede crear un sorteo, añadir participantes (nombre + email) y definir exclusiones (parejas, familiares que no pueden tocarse entre sí).
- El sistema ejecuta el sorteo y envía a cada participante un email con un enlace personal único que revela exclusivamente su asignación.
- Cada participante accede a su resultado visitando el enlace recibido por email, sin registro ni contraseña.
- El organizador NO puede ver ningún resultado del sorteo; su panel de administración solo muestra el estado del sorteo (pendiente / lanzado) y la lista de participantes.
- La interfaz es festiva, moderna y completamente adaptada a móvil y tablet (mobile-first).

> **Decisión de negocio — 09/11/2026**: Se descarta el login con email+contraseña en favor de tokens únicos en URL. Razón: elimina la necesidad de gestionar credenciales para un uso puntual anual, y el email actúa como cajón permanente donde el participante siempre puede recuperar su enlace.

> **Decisión de negocio — 09/11/2026**: Servicio de envío de email: Resend.com (plan gratuito, 3.000 emails/mes, SDK oficial para Node.js, dashboard de trazabilidad). Descartado Nodemailer+Gmail por las restricciones de seguridad de Google en apps de terceros.

> **Decisión de negocio — 09/11/2026**: Frontend: HTML/CSS/JS vanilla. Sin build step; Express sirve los estáticos directamente. CSS moderno 2026 (oklch, @starting-style, container queries) es suficiente para el diseño festivo requerido. Para 2-3 vistas, React sería sobredimensionado.

> **Decisión de negocio — 09/11/2026**: Despliegue: Railway. No pone la app a dormir en el plan gratuito (a diferencia de Render), detecta Node.js automáticamente desde GitHub, y soporta volúmenes persistentes para SQLite.

> **Decisión de negocio — 09/11/2026**: Múltiples sorteos coexisten en la misma instancia. El modelo de datos ya lo soporta naturalmente (tabla `sorteos` con id propio). Permite reutilizar la app año tras año sin perder historial y sin coste adicional de implementación. No existe un «sorteo activo» global; cada sorteo es independiente identificado por su `token_admin`.

> **Decisión de negocio — 09/11/2026**: Creación de sorteos protegida por clave de administrador (`ADMIN_SECRET`). El endpoint `POST /api/sorteos` requiere que el cuerpo incluya la clave configurada como variable de entorno. Si la clave es incorrecta o ausente, el sistema devuelve 403. Descartada la creación abierta (riesgo de sorteos basura) y la pre-configuración manual (demasiado rígida). La clave la conoce únicamente quien despliega la app.

> **Decisión de negocio — 09/11/2026**: Al crear un sorteo, el organizador proporciona su email. El sistema envía a ese email la URL de administración con el `token_admin`, igual que hace con los participantes. Esto elimina el riesgo de pérdida irreversible del acceso de administración. El email del organizador se almacena en la tabla `sorteos` y no se expone en ninguna vista pública.

> **Decisión de negocio — 09/11/2026**: El organizador puede añadir un mensaje personalizado opcional al sorteo (campo `mensaje` en tabla `sorteos`). Este mensaje se muestra a cada participante en su página de resultado junto a su asignación. Uso típico: presupuesto máximo, fecha de entrega, lugar de celebración. Descartada la edición de participantes (eliminar+añadir es suficiente para uso puntual anual).

## Capabilities

### New Capabilities

- `gestion-sorteo`: Creación y administración del sorteo por parte del organizador: añadir participantes, definir exclusiones y lanzar el sorteo.
- `algoritmo-asignacion`: Lógica de asignación aleatoria con restricciones (exclusiones), detección de sorteo imposible y generación de tokens únicos por participante.
- `notificacion-email`: Envío automático del email personal a cada participante con su enlace único al lanzar el sorteo.
- `vista-participante`: Acceso del participante a su asignación mediante el enlace/token recibido por email.
- `privacidad-organizador`: Garantía de que el organizador no puede acceder a ningún resultado del sorteo desde su panel.

### Modified Capabilities

*(Ninguna — aplicación creada desde cero, no hay specs existentes que modificar.)*

## Impact

- **Código nuevo**: Toda la aplicación se construye desde cero. Punto de entrada `server.js`, módulos en `src/` (db, sorteo, email, rutas), vistas en `public/`.
- **Dependencias nuevas**: `express`, `better-sqlite3`, `resend`, `uuid`. Todas justificadas: Express y better-sqlite3 están fijadas en el stack; Resend es la decisión de email acordada; uuid para generación de tokens criptográficamente únicos.
- **Despliegue**: Se necesita cuenta en Railway y cuenta en Resend.com con API key configurada como variable de entorno.
- **Base de datos**: SQLite local en desarrollo; volumen persistente de Railway en producción. Esquema inicial con tablas: `sorteos`, `participantes`, `exclusiones`, `asignaciones`.
- **Tests**: Suite automatizada (Node test runner nativo); cada escenario de las specs tiene un test trazable por nombre.
