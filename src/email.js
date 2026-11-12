'use strict';

const https = require('https');

/**
 * Llama a la API REST de Brevo para enviar un email transaccional.
 * Usa https nativo (puerto 443) para evitar bloqueos SMTP en Railway.
 */
function enviarConBrevo({ to, toName, subject, html }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      sender: { name: 'Amigo Invisible', email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent: html
    });
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Brevo API error ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Envía el email de acceso al panel de administración al organizador.
 */
async function enviarEmailAdmin({ emailOrganizador, nombreSorteo, urlAdmin }) {
  await enviarConBrevo({
    to: emailOrganizador,
    subject: `🎄 Tu panel de Amigo Invisible — ${nombreSorteo}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h1 style="color:#2d6a4f">🎄 ¡Sorteo creado!</h1>
        <p>Hola,</p>
        <p>Tu sorteo <strong>${nombreSorteo}</strong> ha sido creado correctamente.</p>
        <p>Guarda este email: es tu acceso permanente al panel de administración.</p>
        <p style="margin:32px 0">
          <a href="${urlAdmin}" style="background:#2d6a4f;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">
            🔑 Ir a mi panel de administración
          </a>
        </p>
        <p style="font-size:12px;color:#666">
          Si el botón no funciona, copia este enlace en tu navegador:<br>
          <a href="${urlAdmin}">${urlAdmin}</a>
        </p>
      </div>
    `
  });
}

/**
 * Envía el email de Amigo Invisible a un participante.
 */
async function enviarEmailParticipante({ nombre, email, nombreSorteo, token, baseUrl }) {
  const enlace = `${baseUrl}/resultado.html?token=${token}`;
  await enviarConBrevo({
    to: email,
    toName: nombre,
    subject: `🎁 ¡Ya tienes tu Amigo Invisible! — ${nombreSorteo}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h1 style="color:#c1121f">🎁 ¡Hola, ${nombre}!</h1>
        <p>Ya está decidido... ¡tienes Amigo Invisible en <strong>${nombreSorteo}</strong>!</p>
        <p>Cuando estés listo para descubrirlo, pulsa el botón:</p>
        <p style="margin:32px 0">
          <a href="${enlace}" style="background:#c1121f;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">
            🎁 Ver mi Amigo Invisible
          </a>
        </p>
        <p><strong>Guarda este email</strong>: es tu acceso permanente. ¡Que no se lo cuentes a nadie! 🤫</p>
        <p style="font-size:12px;color:#666">
          Si el botón no funciona, copia este enlace en tu navegador:<br>
          <a href="${enlace}">${enlace}</a>
        </p>
      </div>
    `
  });
}

module.exports = { enviarEmailAdmin, enviarEmailParticipante };
