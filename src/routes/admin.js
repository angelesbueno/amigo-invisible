'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { obtenerDb } = require('../db.js');
const { asignar } = require('../sorteo.js');
const { enviarEmailAdmin, enviarEmailParticipante } = require('../email.js');

const router = express.Router();

function middlewareAdmin(req, res, next) {
  const db = obtenerDb();
  const sorteo = db.prepare('SELECT * FROM sorteos WHERE token_admin = ?').get(req.params.token_admin);
  if (!sorteo) return res.status(403).json({ error: 'Acceso no autorizado.' });
  req.sorteo = sorteo;
  next();
}

router.post('/sorteos', async (req, res) => {
  const { nombre, email_organizador, admin_secret } = req.body;
  if (!admin_secret || admin_secret !== process.env.ADMIN_SECRET)
    return res.status(403).json({ error: 'Clave de administrador incorrecta.' });
  if (!nombre || !nombre.trim())
    return res.status(400).json({ error: 'El nombre del sorteo es obligatorio.' });
  if (!email_organizador || !email_organizador.trim())
    return res.status(400).json({ error: 'El email del organizador es obligatorio.' });
  const id = uuidv4();
  const token_admin = uuidv4();
  const db = obtenerDb();
  db.prepare('INSERT INTO sorteos (id, nombre, token_admin, email_organizador, estado, creado_en) VALUES (?, ?, ?, ?, ?, ?)').run(id, nombre.trim(), token_admin, email_organizador.trim(), 'pendiente', new Date().toISOString());
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const urlAdmin = `${baseUrl}/admin.html?token=${token_admin}`;
  try { await enviarEmailAdmin({ emailOrganizador: email_organizador.trim(), nombreSorteo: nombre.trim(), urlAdmin }); }
  catch (err) { console.error('Error email admin:', err.message); }
  return res.status(201).json({ id, nombre: nombre.trim(), token_admin, urlAdmin, estado: 'pendiente' });
});

router.get('/admin/:token_admin', middlewareAdmin, (req, res) => {
  const db = obtenerDb();
  const { sorteo } = req;
  const participantes = db.prepare('SELECT id, nombre, email FROM participantes WHERE sorteo_id = ?').all(sorteo.id);
  const exclusiones = db.prepare('SELECT e.id, p1.nombre AS nombre_a, p2.nombre AS nombre_b, e.participante_a, e.participante_b FROM exclusiones e JOIN participantes p1 ON p1.id = e.participante_a JOIN participantes p2 ON p2.id = e.participante_b WHERE e.sorteo_id = ?').all(sorteo.id);
  return res.json({ id: sorteo.id, nombre: sorteo.nombre, estado: sorteo.estado, mensaje: sorteo.mensaje || null, participantes, exclusiones });
});

router.post('/admin/:token_admin/participantes', middlewareAdmin, (req, res) => {
  const { sorteo } = req;
  if (sorteo.estado === 'lanzado') return res.status(400).json({ error: 'El sorteo ya fue lanzado.' });
  const { nombre, email } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });
  if (!email || !email.trim()) return res.status(400).json({ error: 'El email es obligatorio.' });
  const db = obtenerDb();
  const id = uuidv4();
  try {
    db.prepare('INSERT INTO participantes (id, sorteo_id, nombre, email) VALUES (?, ?, ?, ?)').run(id, sorteo.id, nombre.trim(), email.trim().toLowerCase());
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Ese email ya está en la lista.' });
    throw err;
  }
  return res.status(201).json({ id, nombre: nombre.trim(), email: email.trim().toLowerCase() });
});

router.delete('/admin/:token_admin/participantes/:id', middlewareAdmin, (req, res) => {
  if (req.sorteo.estado === 'lanzado') return res.status(400).json({ error: 'El sorteo ya fue lanzado.' });
  const db = obtenerDb();
  db.prepare('DELETE FROM exclusiones WHERE participante_a = ? OR participante_b = ?').run(req.params.id, req.params.id);
  db.prepare('DELETE FROM participantes WHERE id = ? AND sorteo_id = ?').run(req.params.id, req.sorteo.id);
  return res.status(204).send();
});

router.post('/admin/:token_admin/exclusiones', middlewareAdmin, (req, res) => {
  const { sorteo } = req;
  const { participante_a, participante_b } = req.body;
  if (!participante_a || !participante_b) return res.status(400).json({ error: 'Se necesitan dos participantes.' });
  if (participante_a === participante_b) return res.status(400).json({ error: 'Un participante no puede excluirse consigo mismo.' });
  const db = obtenerDb();
  const id = uuidv4();
  try {
    db.prepare('INSERT INTO exclusiones (id, sorteo_id, participante_a, participante_b) VALUES (?, ?, ?, ?)').run(id, sorteo.id, participante_a, participante_b);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      const ex = db.prepare('SELECT id FROM exclusiones WHERE sorteo_id = ? AND ((participante_a = ? AND participante_b = ?) OR (participante_a = ? AND participante_b = ?))').get(sorteo.id, participante_a, participante_b, participante_b, participante_a);
      return res.status(200).json({ id: ex ? ex.id : id });
    }
    throw err;
  }
  return res.status(201).json({ id });
});

router.delete('/admin/:token_admin/exclusiones/:id', middlewareAdmin, (req, res) => {
  obtenerDb().prepare('DELETE FROM exclusiones WHERE id = ? AND sorteo_id = ?').run(req.params.id, req.sorteo.id);
  return res.status(204).send();
});

router.patch('/admin/:token_admin/mensaje', middlewareAdmin, (req, res) => {
  const mensajeLimpio = ((req.body.mensaje) || '').trim();
  if (mensajeLimpio.length > 500) return res.status(400).json({ error: 'El mensaje no puede superar los 500 caracteres.' });
  obtenerDb().prepare('UPDATE sorteos SET mensaje = ? WHERE id = ?').run(mensajeLimpio || null, req.sorteo.id);
  return res.json({ mensaje: mensajeLimpio || null });
});

router.post('/admin/:token_admin/lanzar', middlewareAdmin, async (req, res) => {
  const { sorteo } = req;
  if (sorteo.estado === 'lanzado') return res.status(400).json({ error: 'El sorteo ya fue lanzado.' });
  const db = obtenerDb();
  const participantes = db.prepare('SELECT * FROM participantes WHERE sorteo_id = ?').all(sorteo.id);
  if (participantes.length < 3) return res.status(400).json({ error: `Se necesitan al menos 3 participantes. Actualmente hay ${participantes.length}.` });
  const exclusiones = db.prepare('SELECT * FROM exclusiones WHERE sorteo_id = ?').all(sorteo.id);
  let asignaciones;
  try { asignaciones = asignar(participantes, exclusiones); }
  catch (err) {
    if (err.code === 'SORTEO_IMPOSIBLE') return res.status(400).json({ error: err.message });
    throw err;
  }
  db.transaction(() => {
    for (const { regaladorId, receptorId, tokenRegalador } of asignaciones) {
      db.prepare('UPDATE participantes SET token = ? WHERE id = ?').run(tokenRegalador, regaladorId);
      db.prepare('INSERT INTO asignaciones (id, sorteo_id, regalador_id, receptor_id) VALUES (?, ?, ?, ?)').run(uuidv4(), sorteo.id, regaladorId, receptorId);
    }
    db.prepare("UPDATE sorteos SET estado = 'lanzado' WHERE id = ?").run(sorteo.id);
  })();
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const erroresEmail = [];
  for (const { regaladorId, tokenRegalador } of asignaciones) {
    const p = participantes.find(x => x.id === regaladorId);
    try { await enviarEmailParticipante({ nombre: p.nombre, email: p.email, nombreSorteo: sorteo.nombre, token: tokenRegalador, baseUrl }); }
    catch (err) { console.error(`Error email a ${p.email}:`, err.message); erroresEmail.push(p.email); }
  }
  return res.json({ estado: 'lanzado', participantes: participantes.length, erroresEmail: erroresEmail.length ? erroresEmail : undefined });
});

router.post('/admin/:token_admin/reenviar/:participante_id', middlewareAdmin, async (req, res) => {
  const { sorteo } = req;
  if (sorteo.estado !== 'lanzado') return res.status(400).json({ error: 'El sorteo aún no ha sido lanzado.' });
  const p = obtenerDb().prepare('SELECT * FROM participantes WHERE id = ? AND sorteo_id = ?').get(req.params.participante_id, sorteo.id);
  if (!p) return res.status(404).json({ error: 'Participante no encontrado.' });
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  try { await enviarEmailParticipante({ nombre: p.nombre, email: p.email, nombreSorteo: sorteo.nombre, token: p.token, baseUrl }); }
  catch (err) { return res.status(500).json({ error: 'Error al enviar el email.' }); }
  return res.json({ ok: true, email: p.email });
});

// POST /api/admin/:token_admin/simular — prueba el sorteo sin persistir ni enviar emails
router.post('/admin/:token_admin/simular', middlewareAdmin, (req, res) => {
  const { sorteo } = req;
  if (sorteo.estado === 'lanzado') return res.status(400).json({ error: 'El sorteo ya fue lanzado.' });
  const db = obtenerDb();
  const participantes = db.prepare('SELECT * FROM participantes WHERE sorteo_id = ?').all(sorteo.id);
  if (participantes.length < 3) return res.status(400).json({ error: `Se necesitan al menos 3 participantes. Actualmente hay ${participantes.length}.` });
  const exclusiones = db.prepare('SELECT * FROM exclusiones WHERE sorteo_id = ?').all(sorteo.id);
  let asignaciones;
  try { asignaciones = asignar(participantes, exclusiones); }
  catch (err) {
    if (err.code === 'SORTEO_IMPOSIBLE') return res.status(400).json({ error: err.message });
    throw err;
  }
  // Devolver resultado legible sin persistir nada
  const resultado = asignaciones.map(({ regaladorId, receptorId }) => {
    const regalador = participantes.find(p => p.id === regaladorId);
    const receptor = participantes.find(p => p.id === receptorId);
    return { regalador: regalador.nombre, receptor: receptor.nombre };
  });
  return res.json({ ok: true, resultado });
});

module.exports = { router, middlewareAdmin };
