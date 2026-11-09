# 🎄 Amigo Invisible

Aplicación web para organizar sorteos de Amigo Invisible entre grupos de personas.

## Características

- El organizador crea el sorteo, añade participantes y define exclusiones (p.ej. matrimonios que no pueden tocarse)
- El sistema realiza el sorteo y envía un email personal a cada participante con su enlace único
- Cada participante accede a su asignación visitando el enlace — sin registro ni contraseña
- El organizador **nunca puede ver** las asignaciones del sorteo
- Diseño festivo, moderno y adaptado a móvil y tablet

## Requisitos

- Node.js >= 20.0.0
- Cuenta en [Resend.com](https://resend.com) (plan gratuito: 3.000 emails/mes)

## Instalación local

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd amigo-invisible

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 4. Arrancar el servidor
npm start
# Servidor escuchando en http://localhost:3000
```

## Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `RESEND_API_KEY` | Clave de API de Resend.com | `re_xxxxxxxxxxxx` |
| `BASE_URL` | URL base de la app (sin barra final) | `https://tu-app.up.railway.app` |
| `ADMIN_SECRET` | Clave secreta para crear sorteos | `mi-clave-secreta-2026` |
| `PORT` | Puerto del servidor (Railway lo inyecta) | `3000` |

## Tests

```bash
npm test
# 52/52 tests pasan
```

## Despliegue en Railway

1. Crear cuenta en [Railway](https://railway.app)
2. Crear nuevo proyecto → "Deploy from GitHub repo"
3. Conectar el repositorio
4. En **Variables**, añadir:
   - `RESEND_API_KEY` = tu clave de Resend
   - `BASE_URL` = `https://<nombre-proyecto>.up.railway.app`
   - `ADMIN_SECRET` = tu clave secreta
   - `NODE_ENV` = `production`
5. En **Volumes**, crear un volumen montado en `/data` para persistir SQLite
6. Railway despliega automáticamente en cada push a `main`

> **Rollback:** revertir el commit en GitHub; Railway redespliega la versión anterior automáticamente.

## Uso

### El organizador

1. Visita la URL raíz de la app (`/`)
2. Introduce el nombre del sorteo, tu email y la `ADMIN_SECRET`
3. Recibirás un email con el enlace a tu panel de administración — **guárdalo**
4. Desde el panel: añade participantes, define exclusiones y añade un mensaje opcional (presupuesto, fecha...)
5. Pulsa **Lanzar el sorteo** — cada participante recibirá su email

### El participante

1. Recibe un email con el enlace personal
2. Hace clic → ve el nombre de su Amigo Invisible
3. Puede volver a consultar el enlace cuando quiera

## Estructura del proyecto

```
amigo-invisible/
├── server.js              # Punto de entrada Express
├── src/
│   ├── db.js              # SQLite (better-sqlite3)
│   ├── sorteo.js          # Algoritmo Fisher-Yates con restricciones
│   ├── email.js           # Integración Resend.com
│   └── routes/
│       ├── admin.js       # Rutas del organizador
│       └── participante.js# Ruta del participante
├── public/
│   ├── index.html         # Crear sorteo
│   ├── admin.html         # Panel organizador
│   ├── resultado.html     # Vista participante
│   └── style.css
├── test/                  # Suite de tests (node:test)
└── .env.example
```
