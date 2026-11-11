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

async function iniciar() {
  // Esperar a que el runtime WASM de node-sqlite3-wasm termine de inicializarse
  const sqlite3wasm = require('node-sqlite3-wasm');
  await new Promise((resolve) => {
    if (sqlite3wasm.runtimeInitialized) return resolve();
    const orig = sqlite3wasm.onRuntimeInitialized;
    sqlite3wasm.onRuntimeInitialized = () => { if (orig) orig(); resolve(); };
  });

  // Inicializar BD tras WASM listo
  const { obtenerDb } = require('./src/db.js');
  obtenerDb();

  if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Amigo Invisible escuchando en http://0.0.0.0:${PORT}`);
    });
  }
}

iniciar().catch(err => { console.error('Error al iniciar:', err); process.exit(1); });

module.exports = app;

