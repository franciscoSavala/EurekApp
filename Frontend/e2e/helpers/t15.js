// Utilidades de la tanda T15 (administración: usuarios, organizaciones y dashboard).
const { expect } = require('@playwright/test');
const { CLAVE, USUARIOS, irAlMenu, bajarHastaVer } = require('../helpers');
const { abrirComo } = require('./t02');

const URL_BACK = process.env.E2E_BACK_URL || 'http://localhost:8080';
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/** El servidor limita /login y /signup a 10 por minuto por IP: si responde 429 se espera y se reintenta. */
async function conReintento(pedir) {
    let r;
    for (let i = 0; i < 30; i++) {
        r = await pedir();
        if (r.status() !== 429) return r;
        await pausa(10000);
    }
    return r;
}

/** Inicia sesión por la API y devuelve el token. */
async function loginApi(request, email) {
    const r = await conReintento(() => request.post(`${URL_BACK}/login`, { data: { username: email, password: CLAVE } }));
    if (!r.ok()) throw new Error(`login ${email}: ${r.status()}`);
    return (await r.json()).token;
}

/** Registra un usuario nuevo con email único por la API. Devuelve { email, nombre, apellido, token }. */
async function registrarNuevo(request, sufijo) {
    const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const email = `t15.${sufijo}.${id}@eurekapp.com`;
    const nombre = 'Prueba';
    const apellido = `T15${sufijo}${id}`;
    const r = await conReintento(() => request.post(`${URL_BACK}/signup`, { data: { firstname: nombre, lastname: apellido, username: email, password: CLAVE } }));
    if (!r.ok()) throw new Error(`signup ${email}: ${r.status()} ${await r.text()}`);
    return { email, nombre, apellido, token: (await r.json()).token };
}

/** Guarda en page.tokenApi el token que la app manda al servidor. */
function vigilarToken(page) {
    page.on('request', (r) => {
        const a = r.headers()['authorization'];
        if (a && r.url().startsWith(URL_BACK)) page.tokenApi = a;
    });
}

/** Abre sesión de `email` (sesión compartida) y deja el token de la app en page.tokenApi. */
async function abrirConToken(browser, email) {
    const { context, page } = await abrirComo(browser, email);
    vigilarToken(page);
    await page.reload();
    await expect(page.getByText('Logout')).toBeVisible();
    await expect.poll(() => page.tokenApi, { timeout: 15000 }).toBeTruthy();
    return { context, page };
}

const abrirAdmin = (browser) => abrirConToken(browser, USUARIOS.admin);

/** GET autenticado con el token de la página; devuelve la respuesta. */
const consultar = (request, page, ruta) => request.get(`${URL_BACK}${ruta}`, { headers: { Authorization: page.tokenApi } });

/** Lista de usuarios (opcionalmente de un rol) como la ve el servidor. */
async function usuariosApi(request, page, rol) {
    const r = await consultar(request, page, `/admin/users${rol ? `?role=${rol}` : ''}`);
    expect(r.status()).toBe(200);
    return r.json();
}

const organizacionesApi = async (request, page) => (await consultar(request, page, '/admin/organizations')).json();
const statsApi = async (request, page) => (await consultar(request, page, '/admin/stats')).json();

/** Activa o desactiva por la API (para dejar el ambiente como estaba). */
async function fijarActivo(request, page, tipo, id, activo) {
    await request.put(`${URL_BACK}/admin/${tipo}/${id}/active`, { headers: { Authorization: page.tokenApi }, data: { active: activo } });
}

/** Va a Usuarios y espera el listado. */
async function irAUsuarios(page) {
    // Se recarga para que el botón del menú vuelva a estar disponible después de navegar.
    await page.goto('/');
    const lista = page.waitForResponse((r) => r.request().method() === 'GET' && r.url().startsWith(URL_BACK) && r.url().includes('/admin/users'));
    await irAlMenu(page, 'Usuarios');
    await lista;
}

async function irAOrganizaciones(page) {
    // Se recarga para que el botón del menú vuelva a estar disponible después de navegar.
    await page.goto('/');
    const lista = page.waitForResponse((r) => r.request().method() === 'GET' && r.url().startsWith(URL_BACK) && r.url().includes('/admin/organizations'));
    await irAlMenu(page, 'Organizaciones');
    await lista;
}

/** Chip de filtro de Usuarios (el texto "Usuarios" también está en el menú y el título). */
function chip(page, texto) {
    const fila = page.getByText('Todos', { exact: true }).locator('visible=true').first().locator('xpath=../..');
    return fila.getByText(texto, { exact: true });
}

/** Tarjeta de la persona o la organización con ese texto (con su botón Desactivar/Activar). */
const tarjeta = (page, texto) => page.locator('div').filter({ has: page.getByText(texto, { exact: true }) }).filter({ hasText: /Desactivar|Activar/ }).last();

/** Baja por el listado hasta ver el texto. */
const verEnListado = (page, texto) => bajarHastaVer(page, texto);

/** Diálogo de confirmación abierto. */
const dialogo = (page) => page.locator('[aria-modal="true"]');

/** Emails que se ven en el listado de usuarios, bajando hasta que no cargue más. */
async function emailsVisibles(page) {
    const vistos = new Set();
    let sinNuevos = 0;
    for (let i = 0; i < 40 && sinNuevos < 3; i++) {
        const textos = await page.getByText(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).locator('visible=true').allInnerTexts();
        const antes = vistos.size;
        textos.forEach((t) => vistos.add(t.trim()));
        sinNuevos = vistos.size === antes ? sinNuevos + 1 : 0;
        await page.evaluate(() => {
            const ok = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
            const c = [...document.querySelectorAll('div')].filter((e) => {
                const o = getComputedStyle(e).overflowY;
                return (o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight && ok(e);
            }).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
            if (c) c.scrollTop = c.scrollHeight;
        });
        await page.waitForTimeout(500);
    }
    return vistos;
}

/** Valor numérico de una tarjeta del dashboard: el número que está antes de la etiqueta. */
async function valorTarjeta(page, etiqueta) {
    const t = await page.getByText(etiqueta, { exact: true }).locator('visible=true').first().locator('xpath=preceding-sibling::*[1]').innerText();
    return Number(t.trim());
}

/** Abre el dashboard como pantalla inicial y devuelve las estadísticas que el servidor mandó a la pantalla. */
async function abrirDashboard(page) {
    const r = page.waitForResponse((x) => x.request().method() === 'GET' && x.url().includes('/admin/stats'));
    await page.goto('/');
    const stats = await (await r).json();
    await expect(page.getByText('Plataforma', { exact: true }).locator('visible=true')).toBeVisible();
    return stats;
}

/** Desde otra pantalla del panel, va al dashboard con la opción del menú (usa el botón visible). */
async function irAlDashboardPorMenu(page) {
    await page.goto('/');
    await irAUsuarios(page);
    await page.locator('button:has(img[src*="toggle-drawer-icon"])').locator('visible=true').last().click();
    await expect(page.getByText('Logout')).toBeInViewport();
    const r = page.waitForResponse((x) => x.request().method() === 'GET' && x.url().includes('/admin/stats'));
    await page.locator('a', { has: page.getByText('Dashboard', { exact: true }) }).click();
    await r;
    await expect(page.getByText('Plataforma', { exact: true }).locator('visible=true')).toBeVisible();
}

module.exports = {
    URL_BACK, auth, loginApi, registrarNuevo, abrirAdmin, abrirConToken, consultar, usuariosApi, organizacionesApi, statsApi,
    fijarActivo, irAUsuarios, irAOrganizaciones, chip, tarjeta, verEnListado, dialogo, emailsVisibles, valorTarjeta, abrirDashboard, irAlDashboardPorMenu, vigilarToken,
};
