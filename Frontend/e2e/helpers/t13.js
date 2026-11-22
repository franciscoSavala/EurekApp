// Utilidades de la tanda T13 (logros, recompensas, niveles, insignias y exclusiones de recompensa).
const fs = require('fs');
const { expect } = require('@playwright/test');
const { foto, irAlMenu, abrirMenu, bajarHastaVer } = require('../helpers');
const { URL_BACK, auth, registrarUsuario, loginApi } = require('./t08');
const sesion = require('./sesion');
const { dniUnico, tarjetaInventario, cargarFotoDeQuienRetira, completarDatos } = require('./t04');

const ORG_UTN = 1;
const dos = (n) => String(n).padStart(2, '0');

/** Fecha local en el formato que manda la app (sin zona horaria). */
const fechaLocal = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
};
const visible = (loc) => loc.locator('visible=true');

/** Recepta un objeto por la API. `finder` es el email del usuario que lo encontró (opcional). Devuelve el UUID. */
async function receptarApi(request, token, titulo, finder) {
    const multipart = {
        title: titulo,
        found_date: fechaLocal(Date.now() - 3600 * 1000),
        file: { name: 'billetera.png', mimeType: 'image/png', buffer: fs.readFileSync(foto('billetera.png')) },
    };
    if (finder) multipart.object_finder_username = finder;
    const r = await request.post(`${URL_BACK}/found-objects/organizations/${ORG_UTN}`, { headers: auth(token), multipart });
    if (!r.ok()) throw new Error(`receptar: ${r.status()} ${await r.text()}`);
    return (await r.json()).id;
}

/** Devuelve el objeto por la API con un DNI distinto en cada llamada. Devuelve la respuesta cruda. */
async function devolverApi(request, token, uuid, { dni = dniUnico(), retirador } = {}) {
    const multipart = {
        firstName: 'Ana', lastName: 'Prueba', dni, phoneNumber: '3514000000', found_object_uuid: uuid,
        file: { name: 'persona_retiro.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(foto('persona_retiro.jpg')) },
    };
    if (retirador) multipart.username = retirador;
    return request.post(`${URL_BACK}/found-objects/return/${ORG_UTN}`, { headers: auth(token), multipart });
}

/** Recepta y devuelve un objeto cuyo finder es `finder`. Devuelve el título y el UUID. */
async function receptarYDevolver(request, token, titulo, finder) {
    const uuid = await receptarApi(request, token, titulo, finder);
    const r = await devolverApi(request, token, uuid);
    if (!r.ok()) throw new Error(`devolver: ${r.status()} ${await r.text()}`);
    return uuid;
}

/** XP, objetos devueltos y logros del usuario, tal como los informa el servidor. */
async function logrosApi(request, token) {
    const r = await request.get(`${URL_BACK}/user/achievements`, { headers: auth(token) });
    if (!r.ok()) throw new Error(`logros: ${r.status()}`);
    return r.json();
}

/** Notificaciones de la pantalla (JSON del servidor). */
async function notificacionesApi(request, token) {
    const r = await request.get(`${URL_BACK}/notifications`, { headers: auth(token) });
    return r.ok() ? r.json() : null;
}

/** Entra a Logros desde el menú (recarga antes para no arrastrar botones de pantallas anteriores). */
async function irALogros(page) {
    await page.goto('/');
    await expect(page.getByText('Logout')).toBeVisible();
    await irAlMenu(page, 'Logros');
    await expect(visible(page.getByText(/^Nivel \d+ - /))).toBeVisible();
}

/** Texto de nivel y XP que muestra la pantalla, por ejemplo "Nivel 1 - 20 XP". */
const textoNivel = (page) => visible(page.getByText(/^Nivel \d+ - /)).first();

/** Cantidad de XP que muestra la pantalla de Logros. */
async function xpEnPantalla(page) {
    const t = await textoNivel(page).innerText();
    return Number(/(\d+)\s*XP/.exec(t)[1]);
}

/** Ancho (porcentaje) de la barra de progreso del nivel, una vez terminada su animación. */
async function anchoBarraNivel(page) {
    await page.waitForTimeout(1500);
    // Se busca el riel visible y se lee su relleno: un relleno de 0 % no es visible y haría tomar otra barra.
    const relleno = 'div[style*="width"][style*="%"][style*="rgb(25, 230, 230)"]';
    const rieles = visible(page.locator(`div:has(> ${relleno})`));
    const estilo = await rieles.first().locator(`:scope > ${relleno}`).first().getAttribute('style');
    return Number(/width:\s*([\d.]+)%/.exec(estilo)[1]);
}

/** Cierra la sesión por la interfaz (menú, Logout). */
async function cerrarSesion(page) {
    await page.goto('/');
    await expect(page.getByText('Logout')).toBeVisible();
    await abrirMenu(page);
    await page.getByText('Logout').click();
    await expect(page.getByText('Bienvenido a Eurekapp')).toBeVisible();
}

/** Va a una opción del menú lateral partiendo de la pantalla de inicio (recarga para no arrastrar pantallas anteriores). */
async function irA(page, opcion) {
    await page.goto('/');
    await expect(page.getByText('Logout')).toBeVisible();
    await irAlMenu(page, opcion);
}

/** Token de la sesión abierta en la página. */
const tokenDe = (page) => page.evaluate(() => localStorage.getItem('jwt'));

/** Recepta por la interfaz un objeto con foto; `finder` es el email opcional de quien lo encontró. */
async function receptarUi(page, titulo, finder) {
    await irA(page, 'Receptar un objeto');
    await page.getByPlaceholder('Escribe un título').fill(titulo);
    if (finder) await page.getByPlaceholder('Ingresa el email del usuario').fill(finder);
    await page.locator('input[type="file"]').first().setInputFiles(foto('billetera.png'));
    await expect(page.getByText('Seleccionar foto')).toBeVisible();
    await page.getByText('Receptar objeto encontrado', { exact: true }).click();
    await expect(page.getByText('El objeto fue cargado al inventario con éxito.')).toBeVisible({ timeout: 60_000 });
    await page.getByText('Cerrar', { exact: true }).click();
}

/** Abre el formulario de devolución del objeto con ese título. */
async function abrirDevolucionUi(page, titulo) {
    await irA(page, 'Ver inventario');
    await bajarHastaVer(page, titulo);
    await tarjetaInventario(page, titulo).getByText('Devolver', { exact: true }).click();
    await expect(page.getByText('Registrar devolución', { exact: true })).toBeVisible();
}

/** Registra por la interfaz la devolución del objeto, con todos los datos válidos. */
async function devolverUi(page, titulo) {
    await abrirDevolucionUi(page, titulo);
    await cargarFotoDeQuienRetira(page);
    await completarDatos(page, { dni: dniUnico() });
    await page.getByText('Registrar devolución', { exact: true }).click();
    await expect(page.getByText('La devolución del objeto se registró correctamente.')).toBeVisible();
}

/** Intenta devolver el objeto sin datos: el formulario tiene que rechazarlo. */
async function devolverInvalidoUi(page, titulo) {
    await abrirDevolucionUi(page, titulo);
    await page.getByText('Registrar devolución', { exact: true }).click();
    await expect(page.getByText('Dato obligatorio.').first()).toBeVisible();
    await expect(page.getByText('La devolución del objeto se registró correctamente.')).toHaveCount(0);
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/** Registra un usuario nuevo con email @mail.com (como los registros de la tanda de registro), con cupo y reintento ante 429. */
async function registrarPaciente(request, sufijo) {
    const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const email = `e2e.t13.${sufijo}.${id}@mail.com`;
    const cuerpo = await sesion.registrarUsuario(request, { firstname: 'Prueba', lastname: `T13${sufijo}${id}`, username: email, password: 'Eurekapp1!' });
    return { email, token: cuerpo.token };
}

/** Abre la sesión de `email` (ver helpers/sesion.js). */
const abrirSesionPaciente = (browser, email) => sesion.abrirComo(browser, email);

/** Inicia sesión por la API (con cupo y reintento ante 429) y devuelve el token. */
const loginPaciente = (request, email) => loginApi(request, email);

module.exports = {
    registrarPaciente, abrirSesionPaciente, loginPaciente,
    irA, tokenDe, receptarUi, devolverUi, devolverInvalidoUi,
    URL_BACK, ORG_UTN, visible, receptarApi, devolverApi, receptarYDevolver, logrosApi, notificacionesApi,
    irALogros, textoNivel, xpEnPantalla, anchoBarraNivel, cerrarSesion,
};
