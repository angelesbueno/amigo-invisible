# Design

## Context

Aplicación web nueva, construida desde cero. Ver `proposal.md → Why` para la motivación. El stack está fijado en `config.yaml`: Node.js + Express + better-sqlite3. El frontend se resuelve aquí como vanilla HTML/CSS/JS (decisión registrada en proposal.md). No hay sistema existente que migrar.

## Goals / Non-Goals

**Goals:**
- Definir la estructura de carpetas, el modelo de datos, los endpoints de la API y el flujo de autenticación por token.
- Decidir la integración con Resend.com y el algoritmo de asignación.
- Definir la estrategia de tests trazables por nombre de escenario.
- Definir la configuración de despliegue en Railway.

**Non-Goals:**
- Gestión de múltiples sorteos simultáneos por usuario.
- Autenticación con contraseña, OAuth o sesiones de servidor.
- Internacionalización (solo español de España).
- Modo oscuro o temas visuales alternativos.
- Notificaciones push o recordatorios automáticos.

---

## Decisions

### D1 — Estructura de carpetas

```
amigo-invisible/
├── server.js              ← punto de entrada; monta Express y sirve /public
├── src/
│   ├── db.js              ← inicialización SQLite y migraciones inline
│   ├── sorteo.js          ← algoritmo de asignación
│   ├── email.js           ← integración Resend.com
│   └── routes/
│       ├── admin.js       ← rutas del organizador (token_admin)
│       └── participante.js← rutas del participante (token)
├── public/
│   ├── index.html         ← landing: formulario crear sorteo
│   ├── admin.html         ← panel organizador
│   ├── resultado.html     ← vista participante
│   ├── style.css
│   └── app.js
├── test/
│   └── *.test.js
└── package.json
```

**Por qué:** Separación mínima entre transporte (rutas), lógica de negocio (sorteo.js) y persistencia (db.js). Express sirve estáticos directamente — sin build step.

---

### D2 — Modelo de datos SQLite

```sql
CREATE TABLE sorteos (
  id              TEXT PRIMARY KEY,    -- UUID v4
  nombre          TEXT NOT NULL,
  token_admin     TEXT NOT NULL UNIQUE, -- UUID v4 distinto del id
  email_organizador TEXT NOT NULL,      -- para enviar URL admin y recuperación
  mensaje         TEXT,                 -- mensaje personalizado opcional (max 500 chars)
  estado          TEXT NOT NULL DEFAULT 'pendiente',
  creado_en       TEXT NOT NULL         -- ISO 8601
);

CREATE TABLE participantes (
  id        TEXT PRIMARY KEY,
  sorteo_id TEXT NOT NULL REFERENCES sorteos(id),
  nombre    TEXT NOT NULL,
  email     TEXT NOT NULL,
  token     TEXT UNIQUE,            -- NULL hasta lanzar sorteo
  UNIQUE(sorteo_id, email)
);

CREATE TABLE exclusiones (
  id             TEXT PRIMARY KEY,
  sorteo_id      TEXT NOT NULL REFERENCES sorteos(id),
  participante_a TEXT NOT NULL REFERENCES participantes(id),
  participante_b TEXT NOT NULL REFERENCES participantes(id),
  UNIQUE(sorteo_id, participante_a, participante_b)
);

CREATE TABLE asignaciones (
  id           TEXT PRIMARY KEY,
  sorteo_id    TEXT NOT NULL REFERENCES sorteos(id),
  regalador_id TEXT NOT NULL UNIQUE REFERENCES participantes(id),
  receptor_id  TEXT NOT NULL REFERENCES participantes(id)
);
```

**Por qué TEXT para IDs:** SQLite no tiene tipo UUID nativo; TEXT es la práctica estándar con better-sqlite3.

**Por qué token NULL inicialmente:** El token se genera en el momento del sorteo, no al añadir el participante, evitando tokens huérfanos si el participante es eliminado antes del lanzamiento.

---

### D3 — API REST

Todas las rutas bajo `/api`. Autenticación por token en path param; no hay sesiones de servidor.

```
POST   /api/sorteos                                       -> crear sorteo (requiere admin_secret en body)
GET    /api/admin/:token_admin                            -> datos del panel
POST   /api/admin/:token_admin/participantes              -> añadir participante
DELETE /api/admin/:token_admin/participantes/:id          -> eliminar participante
POST   /api/admin/:token_admin/exclusiones                -> añadir exclusion
DELETE /api/admin/:token_admin/exclusiones/:id            -> eliminar exclusion
PATCH  /api/admin/:token_admin/mensaje                    -> actualizar mensaje personalizado
POST   /api/admin/:token_admin/lanzar                     -> lanzar sorteo
POST   /api/admin/:token_admin/reenviar/:participante_id  -> reenviar email
GET    /api/resultado/:token                              -> asignacion del participante
```

**Por qué token en path param y no en header:** Los participantes acceden desde el enlace del email con un clic; los headers no son accesibles desde el navegador sin JS adicional. El token en la URL es el mecanismo más simple para este caso de uso.

**Por qué no existe `/api/admin/:token_admin/asignaciones`:** Cumple la spec `privacidad-organizador` — ese endpoint no existe.

---

### D4 — Algoritmo de asignación (Fisher-Yates con reintento)

```
funcion asignar(participantes, exclusiones):
  pares_excluidos = construir_conjunto(exclusiones)  // bidireccional
  intentos = 0
  mientras intentos < 1000:
    receptores = mezclar_fisher_yates(participantes)
    asignaciones = zip(participantes, receptores)
    si valido(asignaciones, pares_excluidos):
      devolver asignaciones
    intentos++
  lanzar Error('SORTEO_IMPOSIBLE')
```

**Por qué Fisher-Yates con reintento y no matching perfecto:** El algoritmo hungaro es correcto pero sobredimensionado para N < 50 (tamaño familiar tipico). Fisher-Yates con 1.000 reintentos converge en < 10 intentos con exclusiones razonables.

**Por qué 1.000 intentos:** Si tras 1.000 intentos no hay solución, las exclusiones son tan restrictivas que el sorteo es practicamente imposible. Se lanza `SORTEO_IMPOSIBLE` y el organizador revisa sus exclusiones.

---

### D5 — Integración Resend.com

SDK oficial: paquete `resend` (npm). Variables de entorno requeridas:
- `RESEND_API_KEY`: clave de API de Resend.com.
- `BASE_URL`: URL base de la app (ej. `https://amigo-invisible.up.railway.app`). Necesaria para construir el enlace absoluto en el email.
- `ADMIN_SECRET`: clave secreta que debe incluirse en el body de `POST /api/sorteos` para autorizar la creación de un sorteo. Protege el endpoint de creaciones no autorizadas. Solo la conoce quien despliega la app.

Emails que el sistema envía:
1. **Al crear el sorteo** → email al organizador con la URL del panel de administración (`token_admin`).
2. **Al lanzar el sorteo** → email a cada participante con su enlace personal (`token`).
3. **Al reenviar** → email individual a un participante concreto con su mismo enlace.

**Por qué Resend sobre Nodemailer+Gmail:** Ver `proposal.md -> Decisión de negocio 09/11/2026`. Resend tiene dashboard de trazabilidad de entregas — critico para detectar problemas de entrega en contexto familiar.

---

### D6 — Frontend vanilla: tres páginas independientes

```
/               -> index.html    (crear sorteo -> redirige a admin.html?token=...)
/admin.html     -> panel admin   (lee token_admin de la URL; llama a la API)
/resultado.html -> participante  (lee token de la URL; llama a la API)
```

Sin router SPA. Cada página es un HTML independiente. La navegación se gestiona con `window.location` tras crear el sorteo.

**Por qué no SPA/React:** Tres vistas independientes no necesitan estado compartido. Sin build step = despliegue trivial. Ver `proposal.md -> Decisión de negocio 09/11/2026`.

---

### D7 — Diseño visual

Paleta oklch (CSS Color Level 4): `--rojo: oklch(45% 0.22 25)`, `--verde: oklch(35% 0.18 145)`, `--dorado: oklch(75% 0.15 85)`, `--crema: oklch(97% 0.02 85)`.

Tipografia: Playfair Display (titulos) + Inter (cuerpo) via Google Fonts.

Animaciones CSS sin JS: copos de nieve con `@keyframes`, tarjeta resultado con `@starting-style`, boton lanzar con efecto pulso en hover.

Responsive: mobile-first, breakpoints en 480px, 768px, 1024px.

---

### D8 — Tests

Runner: Node.js test runner nativo (`node:test` + `node:assert`). Sin dependencias externas de testing.

Convención: cada test lleva el nombre exacto del escenario de la spec correspondiente:
```js
test('Crear sorteo con nombre válido', async () => { ... });
test('Asignación con exclusiones que hacen el sorteo imposible', async () => { ... });
```

Script en `package.json`: `"test": "node --test test/**/*.test.js"`

---

### D9 — Despliegue en Railway

- Repositorio GitHub conectado a Railway; deploy automático en push a `main`.
- Railway detecta Node.js por `package.json`; script `start`: `node server.js`.
- SQLite en volumen persistente de Railway montado en `/data/db.sqlite`.
- Variables de entorno en Railway: `RESEND_API_KEY`, `BASE_URL`, `ADMIN_SECRET`, `NODE_ENV=production`.
- `PORT` la inyecta Railway; Express escucha `process.env.PORT || 3000`.

**Por qué Railway sobre Render:** Ver `proposal.md -> Decisión de negocio 09/11/2026`. Render pone el servicio a dormir en el plan gratuito; Railway no.

---

## Risks / Trade-offs

| Riesgo | Mitigacion |
|---|---|
| Exclusiones imposibilitan el sorteo y el organizador no sabe cuales son conflictivas | Error `SORTEO_IMPOSIBLE` sugiere revisar exclusiones; diagnostico detallado queda como mejora futura |
| Token en URL visible en historial del navegador | Aceptado: app familiar de uso puntual, riesgo minimo; el token solo revela a quien regalar |
| SQLite sin concurrencia de escritura alta | Aceptado: menos de 30 usuarios simultaneos. better-sqlite3 sincrono funciona perfectamente |
| Resend caido durante lanzamiento | Asignaciones persistidas antes del envio; organizador puede reenviar desde el panel |
| Volumen Railway perdido en redeploy mal configurado | Documentar montaje del volumen en README |

## Migration Plan

No hay sistema previo que migrar. Despliegue inicial:
1. Crear repositorio en GitHub.
2. Conectar a Railway y configurar variables de entorno (`RESEND_API_KEY`, `BASE_URL`).
3. Crear cuenta en Resend.com, obtener API key y configurar dominio de envio.
4. Push a `main` — Railway despliega automaticamente.
5. Verificar con sorteo de prueba antes de compartir la URL con la familia.

**Rollback:** Revertir commit en GitHub; Railway redespliega la version anterior automaticamente.

## Open Questions

- **Dominio personalizado:** ¿Se usara el subdominio gratuito de Railway (`*.up.railway.app`) o un dominio propio? No bloquea la implementacion; se configura despues en Railway sin cambios de codigo.
