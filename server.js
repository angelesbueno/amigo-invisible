'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const { router: adminRouter } = require('./src/routes/admin.js');
const participanteRouter = require('./src/routes/participante.js');
const { obtenerDb } = require('./src/db.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar BD al arrancar
obtenerDb();

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rutas API
app.use('/api', adminRouter);
app.use('/api', participanteRouter);

// Solo escucha cuando se ejecuta directamente (no cuando se importa en tests)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Amigo Invisible escuchando en http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
