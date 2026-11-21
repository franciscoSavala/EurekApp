// Utilidades de la tanda R04 (devolución y objetos devueltos).
const fs = require('fs');
const { expect } = require('@playwright/test');
const { foto } = require('../helpers');
const { URL_BACK, auth } = require('./t08');
const { sesionDe } = require('./sesion');

const dos = (n) => String(n).padStart(2, '0');
const fechaLocal = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
};

/** Recepta por la API un objeto con foto, descripción y, si se pasa, el usuario que lo encontró. Devuelve el UUID. */
async function receptarCompleto(request, token, orgId, titulo, { descripcion, finder } = {}) {
    const multipart = {
        title: titulo,
        found_date: fechaLocal(Date.now() - 3600 * 1000),
        file: { name: 'billetera.png', mimeType: 'image/png', buffer: fs.readFileSync(foto('billetera.png')) },
    };
    if (descripcion) multipart.detailed_description = descripcion;
    if (finder) multipart.object_finder_username = finder;
    const r = await request.post(`${URL_BACK}/found-objects/organizations/${orgId}`, { headers: auth(token), multipart });
    if (!r.ok()) throw new Error(`receptar: ${r.status()} ${await r.text()}`);
    return (await r.json()).id;
}

/** Objetos devueltos de la organización, tal como los informa el servidor. */
async function devueltosApi(request, token) {
    const r = await request.get(`${URL_BACK}/found-objects/getReturnedObjects`, { headers: auth(token) });
    if (!r.ok()) throw new Error(`devueltos: ${r.status()}`);
    return (await r.json()).found_objects || [];
}

/** Políticas de la organización (las que lee el formulario de devolución). */
async function politicaApi(request, token) {
    const r = await request.get(`${URL_BACK}/organizations/policy`, { headers: auth(token) });
    return r.ok() ? r.json() : null;
}

const URL_CORREO = process.env.E2E_MAIL_URL || 'http://localhost:8025';

/** Busca en el servidor de correo de prueba (Mailpit) un mensaje para ese destinatario con ese asunto. Espera hasta `espera` ms. */
async function correoPara(request, email, asunto, espera = 20000) {
    const limite = Date.now() + espera;
    while (Date.now() < limite) {
        const r = await request.get(`${URL_CORREO}/api/v1/search`, { params: { query: `to:${email}` } });
        if (r.ok()) {
            const j = await r.json();
            const m = (j.messages || []).find((x) => String(x.Subject).includes(asunto));
            if (m) {
                const d = await request.get(`${URL_CORREO}/api/v1/message/${m.ID}`);
                return d.json();
            }
        }
        await new Promise((res) => setTimeout(res, 1000));
    }
    return null;
}

/** Nombre y apellido con los que el usuario figura en la app (de su sesión guardada). */
async function nombreDeSesion(email) {
    const s = await sesionDe(email);
    const ls = (s.storageState.origins[0] || {}).localStorage || [];
    const u = JSON.parse((ls.find((x) => x.name === 'user') || { value: '{}' }).value);
    return { nombre: u.firstName || '', apellido: u.lastName || '' };
}

module.exports = { nombreDeSesion, receptarCompleto, devueltosApi, politicaApi, correoPara, expect };
