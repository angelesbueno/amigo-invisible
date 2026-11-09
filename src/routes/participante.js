'use strict';

const express = require('express');
const { obtenerDb } = require('../db.js');

const router = express.Router();

// GET /api/resultado/:token — asignación del participante
router.get('/resultado/:token', (req, res) => {
  const { token } = req.params;

  if (!token) return res.status(404).json({ error: 'Enlace no válido.' });

  const db = obtenerDb();

  // Buscar participante por token (los token_admin NO están en esta tabla)
  const participante = db.prepare('SELECT * FROM participantes WHERE token = ?').get(token);
  if (!participante) return res.status(404).json({ error: 'Enlace no válido.' });

  const sorteo = db.prepare('SELECT * FROM sorteos WHERE id = ?').get(participante.sorteo_id);

  if (sorteo.estado !== 'lanzado') {
    return res.json({
      estado: 'pendiente',
      mensaje: 'El sorteo aún no ha sido lanzado. Vuelve más tarde.'
    });
  }

  const asignacion = db.prepare(
    'SELECT p.nombre AS receptor FROM asignaciones a JOIN participantes p ON p.id = a.receptor_id WHERE a.regalador_id = ?'
  ).get(participante.id);

  return res.json({
    estado: 'lanzado',
    nombre: participante.nombre,
    receptor: asignacion.receptor,
    nombreSorteo: sorteo.nombre,
    mensaje: sorteo.mensaje || null
  });
});

module.exports = router;
