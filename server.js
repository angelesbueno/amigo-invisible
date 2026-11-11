'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const { router: adminRouter } = require('./src/routes/admin.js');
const participanteRouter = require('./src/routes/participante.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rutas API
app.use('/api', adminRouter);
app.use('/api', participanteRouter);

// Inicializar BD al arrancar
const { obtenerDb } = require('./src/db.js');
obtenerDb();

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Amigo Invisible escuchando en http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;

