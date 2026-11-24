// Utilidades de la tanda T12 (alertas/reclamos y notificaciones, carril paralelo).
const fs = require('fs');
const { expect } = require('@playwright/test');
const { foto, CLAVE } = require('../helpers');
const sesion = require('./sesion');
const { URL_BACK, auth } = require('./t08');

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// Fecha y hora local (sin zona), como las espera el servidor.
const fechaLocal = (ms) => {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** Inicia sesión por la API (con cupo y reintento ante 429, ver helpers/sesion.js) y devuelve { token, orgId }. */
async function loginConOrg(request, email, clave = CLAVE) {
    const j = await sesion.loginApi(request, email, clave);
    return { token: j.token, orgId: j.organization && j.organization.id };
}

/** Registra un usuario nuevo (con cupo y reintento ante 429). */
async function registrarUsuario(request, sufijo) {
    const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const email = `t12.${sufijo}.${id}@eurekapp.com`;
    const cuerpo = await sesion.registrarUsuario(request, { firstname: 'Prueba', lastname: `T12${sufijo}${id}`, username: email, password: CLAVE });
    return { email, token: cuerpo.token };
}

/** Recepta un objeto por la API, con foto de billetera y, si se pasa, el usuario que lo encontró. */
async function receptarConFinder(request, token, orgId, titulo, finderEmail) {
    const multipart = {
        title: titulo,
        found_date: fechaLocal(Date.now() - 3600 * 1000),
        file: { name: 'billetera.png', mimeType: 'image/png', buffer: fs.readFileSync(foto('billetera.png')) },
    };
    if (finderEmail) multipart.object_finder_username = finderEmail;
    const r = await request.post(`${URL_BACK}/found-objects/organizations/${orgId}`, { headers: auth(token), multipart });
    if (!r.ok()) throw new Error(`receptar: ${r.status()} ${await r.text()}`);
    return (await r.json()).id;
}

/** Guarda una búsqueda (objeto perdido) con foto de billetera. */
async function guardarBusqueda(request, token, descripcion, orgId) {
    const multipart = {
        description: descripcion,
        lost_date: fechaLocal(Date.now() - 2 * 24 * 3600 * 1000),
        file: { name: 'billetera.png', mimeType: 'image/png', buffer: fs.readFileSync(foto('billetera.png')) },
    };
    if (orgId) multipart.organization_id = String(orgId);
    const r = await request.post(`${URL_BACK}/lost-objects`, { headers: auth(token), multipart });
    if (!r.ok()) throw new Error(`guardar búsqueda: ${r.status()} ${await r.text()}`);
}

/** Devuelve un objeto por la API a una persona con ese DNI. */
async function devolver(request, token, orgId, uuid, dni) {
    const r = await request.post(`${URL_BACK}/found-objects/return/${orgId}`, {
        headers: auth(token),
        multipart: {
            firstName: 'Ana', lastName: 'Prueba', dni, phoneNumber: '3514000000', found_object_uuid: uuid,
            file: { name: 'persona_retiro.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(foto('persona_retiro.jpg')) },
        },
    });
    if (!r.ok()) throw new Error(`devolver: ${r.status()} ${await r.text()}`);
}

/** Notificaciones del usuario por la API. */
async function notificacionesApi(request, token) {
    const r = await request.get(`${URL_BACK}/notifications`, { headers: auth(token) });
    return r.json();
}

/** Espera (hasta 60 s) a que el usuario tenga una notificación de ese tipo; `filtro` (opcional) la acota. */
async function esperarNotificacion(request, token, tipo, filtro) {
    await expect.poll(async () => (await notificacionesApi(request, token)).some((n) => n.type === tipo && (!filtro || filtro(n))), { timeout: 60000, intervals: [1000, 2000, 3000] }).toBe(true);
}

/** El dueño invita por la API a un usuario como empleado de su organización. */
async function invitarApi(request, tokenDueno, email) {
    const r = await request.post(`${URL_BACK}/organizations/add_employee`, { headers: auth(tokenDueno), data: { employeeUsername: email } });
    if (!r.ok()) throw new Error(`invitar ${email}: ${r.status()} ${await r.text()}`);
}

/** El dueño asigna el rol de encargado a un empleado de su organización. */
async function asignarEncargadoApi(request, tokenDueno, userId) {
    const r = await request.post(`${URL_BACK}/organizations/assign_encargado`, { headers: auth(tokenDueno), data: { userId } });
    if (!r.ok()) throw new Error(`asignar encargado: ${r.status()}`);
}

/** Tarjeta (la más interna) de la notificación visible que contiene todos esos textos. */
function tarjeta(page, ...textos) {
    let l = page.locator('div');
    for (const t of textos) l = l.filter({ has: page.getByText(t, { exact: typeof t === 'string' ? false : undefined }) });
    return l.locator('visible=true').last();
}

/**
 * La tarjeta de un aviso de coincidencia solo muestra la búsqueda, no el objeto: los avisos de objetos
 * ajenos que coinciden con la misma búsqueda se ven igual. Se quitan del listado que recibe la app,
 * para que quede solo el aviso del objeto `uuid`.
 */
async function soloAvisoDeObjeto(context, uuid) {
    await context.route(`${URL_BACK}/notifications`, async (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        const resp = await route.fetch();
        const lista = await resp.json();
        const filtrada = Array.isArray(lista) ? lista.filter((n) => n.type !== 'MATCH_FOUND' || n.related_object_uuid === uuid) : lista;
        await route.fulfill({ response: resp, json: filtrada });
    });
}

/** Color de fondo de un elemento (las no leídas llevan fondo celeste). */
const fondoDe = (loc) => loc.evaluate((e) => getComputedStyle(e).backgroundColor);

/** Abre la sesión de `email` (ver helpers/sesion.js). */
const abrirComo = (browser, email) => sesion.abrirComo(browser, email);

module.exports = {
    abrirComo,
    registrarUsuario, loginConOrg, receptarConFinder, guardarBusqueda, devolver, notificacionesApi,
    esperarNotificacion, soloAvisoDeObjeto, invitarApi, asignarEncargadoApi, tarjeta, fondoDe, pausa,
};
