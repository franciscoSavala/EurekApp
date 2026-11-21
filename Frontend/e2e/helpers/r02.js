// Utilidades de la tanda R02 (búsqueda de objetos perdidos y búsquedas guardadas, carril paralelo).
const fs = require('fs');
const { request: apiRequest } = require('@playwright/test');
const { foto } = require('../helpers');
const sesion = require('./sesion');
const { URL_BACK, auth } = require('./t08');
const { receptarConFinder, guardarBusqueda } = require('./t12');

/** Pedidos a la API sin depender de un test (sirve también en beforeAll y afterAll). */
async function conApi(fn) {
    const request = await apiRequest.newContext();
    try {
        return await fn(request);
    } finally {
        await request.dispose();
    }
}

/** Sesión guardada del usuario: { token, orgId }. */
const sesionApi = (email) => sesion.sesionDe(email);

/** Búsquedas guardadas del usuario, tal como las ve Mis búsquedas. */
async function misBusquedas(request, token) {
    const r = await request.get(`${URL_BACK}/lost-objects/my`, { headers: auth(token) });
    return r.json();
}

/** Guarda una búsqueda por la API y devuelve su uuid. */
async function crearBusqueda(request, token, descripcion, orgId) {
    await guardarBusqueda(request, token, descripcion, orgId);
    const mia = (await misBusquedas(request, token)).find((b) => b.description === descripcion);
    if (!mia) throw new Error(`no aparece la búsqueda "${descripcion}" en Mis búsquedas`);
    return mia.uuid;
}

/** Un empleado recepta una billetera por la API y devuelve su uuid. */
async function receptarPorApi(request, email, titulo) {
    const { token, orgId } = await sesionApi(email);
    return receptarConFinder(request, token, orgId, titulo, null);
}

/** La persona reconoció el objeto como suyo: la búsqueda pasa a "Por retirar". */
async function marcarPorRetirar(request, token, uuidBusqueda, uuidObjeto) {
    const r = await request.post(`${URL_BACK}/lost-objects/${uuidBusqueda}/pending-pickup`, { headers: auth(token), data: { foundObjectUuid: uuidObjeto } });
    if (!r.ok()) throw new Error(`por retirar: ${r.status()} ${await r.text()}`);
}

/** El empleado registra la devolución del objeto; con `retirador` (correo de un usuario) se lo lleva esa persona. */
async function devolverObjeto(request, emailEmpleado, uuidObjeto, retirador = null) {
    const { token, orgId } = await sesionApi(emailEmpleado);
    const dni = String(30000000 + Math.floor(Math.random() * 9000000));
    const multipart = {
        firstName: 'Ana', lastName: 'Prueba', dni, phoneNumber: '3514000000', found_object_uuid: uuidObjeto,
        file: { name: 'persona_retiro.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(foto('persona_retiro.jpg')) },
    };
    if (retirador) multipart.username = retirador;
    const r = await request.post(`${URL_BACK}/found-objects/return/${orgId}`, { headers: auth(token), multipart });
    if (!r.ok()) throw new Error(`devolver: ${r.status()} ${await r.text()}`);
}

/** Cierra las búsquedas abiertas del usuario cuya descripción contiene alguno de los fragmentos (limpieza). */
async function limpiarBusquedas(email, fragmentos) {
    try {
        const { token } = await sesionApi(email);
        await conApi(async (request) => {
            const todas = await misBusquedas(request, token);
            for (const b of todas) {
                if (b.status === 'CLOSED' || !fragmentos.some((f) => (b.description || '').includes(f))) continue;
                await request.post(`${URL_BACK}/lost-objects/${b.uuid}/close`, { headers: auth(token), data: { recovered: false } });
            }
        });
    } catch { /* la limpieza no debe romper el test */ }
}

/** Abre Mis búsquedas desde el menú (empezando de cero, porque el menú se cuelga tras navegar en la misma página). */
async function irAMisBusquedas(page) {
    const { abrirMenu } = require('../helpers');
    await page.goto('/');
    await abrirMenu(page);
    await page.locator('a', { has: page.getByText('Mis búsquedas', { exact: true }) }).click();
}

/** La tarjeta de una búsqueda en la lista de Mis búsquedas, por su descripción. */
const tarjetaBusqueda = (page, texto) => page.locator('div[tabindex="0"]').filter({ hasText: texto });

module.exports = {
    conApi, sesionApi, misBusquedas, crearBusqueda, receptarPorApi, marcarPorRetirar, devolverObjeto,
    limpiarBusquedas, irAMisBusquedas, tarjetaBusqueda,
};
