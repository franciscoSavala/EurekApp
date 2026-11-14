// Utilidades de la tanda de alertas de fraude.
const fs = require('fs');
const { foto, CLAVE } = require('../helpers');

const URL_BACK = process.env.E2E_BACK_URL || 'http://localhost:8080';

/** Inicia sesión por la API y devuelve { token, orgId }. */
async function loginApi(request, email) {
    const r = await request.post(`${URL_BACK}/login`, { data: { username: email, password: CLAVE } });
    if (!r.ok()) throw new Error(`login ${email}: ${r.status()}`);
    const j = await r.json();
    return { token: j.token, orgId: j.organization && j.organization.id };
}

// Fecha y hora local (sin zona), como las espera el servidor.
const fechaLocal = (ms) => {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

/** Recepta un objeto por la API y devuelve su uuid. */
async function receptarApi(request, token, orgId, titulo) {
    const r = await request.post(`${URL_BACK}/found-objects/organizations/${orgId}`, {
        headers: auth(token),
        multipart: {
            title: titulo,
            found_date: fechaLocal(Date.now() - 3600 * 1000),
            file: { name: 'billetera.png', mimeType: 'image/png', buffer: fs.readFileSync(foto('billetera.png')) },
        },
    });
    if (!r.ok()) throw new Error(`receptar: ${r.status()} ${await r.text()}`);
    return (await r.json()).id;
}

/** Devuelve un objeto por la API a una persona con ese DNI. */
async function devolverApi(request, token, orgId, uuid, dni) {
    const r = await request.post(`${URL_BACK}/found-objects/return/${orgId}`, {
        headers: auth(token),
        multipart: {
            firstName: 'Ana', lastName: 'Prueba', dni, phoneNumber: '3514000000', found_object_uuid: uuid,
            file: { name: 'persona_retiro.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(foto('persona_retiro.jpg')) },
        },
    });
    if (!r.ok()) throw new Error(`devolver: ${r.status()} ${await r.text()}`);
}

/** Busca por la API la alerta de fraude de ese DNI (la ve solo el administrador). */
async function alertaDelDni(request, tokenAdmin, dni) {
    const r = await request.get(`${URL_BACK}/fraud-alerts`, { headers: auth(tokenAdmin) });
    return (await r.json()).find((a) => a.dni === dni);
}

/** Marca la alerta como falsa alarma: levanta el bloqueo del empleado y del DNI. */
async function resolverAlertaApi(request, tokenAdmin, id) {
    await request.post(`${URL_BACK}/fraud-alerts/${id}/resolve`, { headers: auth(tokenAdmin) });
}

module.exports = { loginApi, receptarApi, devolverApi, alertaDelDni, resolverAlertaApi };
