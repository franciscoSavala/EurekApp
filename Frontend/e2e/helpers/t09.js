// Utilidades de la tanda de políticas de la organización.
const { expect } = require('@playwright/test');
const { loginApi } = require('./t08');

const URL_BACK = process.env.E2E_BACK_URL || 'http://localhost:8080';
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const visible = (loc) => loc.locator('visible=true');

/** Como irAlMenu, pero con el botón del menú de la pantalla visible (las pantallas apiladas dejan botones ocultos). */
async function irAlMenu(page, opcion) {
    await visible(page.locator('button:has(img[src*="toggle-drawer-icon"])')).last().click({ timeout: 15000 });
    await expect(page.getByText('Logout')).toBeInViewport();
    await page.locator('a', { has: page.getByText(opcion, { exact: true }) }).click({ timeout: 15000 });
}

/** Lee las políticas actuales de la organización del dueño. */
async function leerPoliticas(request, token) {
    const r = await request.get(`${URL_BACK}/organizations/policy`, { headers: auth(token) });
    expect(r.ok()).toBeTruthy();
    return r.json();
}

/** Deja las políticas exactamente como estaban (sin el historial, que el servidor lleva solo). */
async function restaurarPoliticas(request, token, original) {
    const { history, ...valores } = original;
    const r = await request.put(`${URL_BACK}/organizations/policy`, { headers: auth(token), data: valores });
    expect(r.ok()).toBeTruthy();
}

/** Entra a Mi organización > Configurar políticas. */
async function abrirPoliticas(page) {
    await irAlMenu(page, 'Mi organización');
    // si la pantalla de políticas ya quedó abierta en la pila, el menú vuelve directo a ella
    const boton = visible(page.getByText('Configurar políticas', { exact: true }));
    const guardar = visible(page.getByText('Guardar políticas', { exact: true }));
    await expect(boton.or(guardar)).toBeVisible();
    if (await boton.count()) await boton.click();
    await expect(visible(page.getByText('Guardar políticas', { exact: true }))).toBeVisible();
}

const campoDias = (page) => visible(page.getByPlaceholder('Sin límite'));
const interruptores = (page) => visible(page.getByRole('switch'));
const botonGuardar = (page) => visible(page.getByText('Guardar políticas', { exact: true }));

/** Elige el tipo de organización en el selector. */
async function elegirTipo(page, etiqueta) {
    await visible(page.getByText(/^(Seleccionar\.\.\.|Universidad|Escuela \/ colegio|Hospital \/ clínica|Hotel|Otro|Terminal de ómnibus)$/)).first().click();
    await visible(page.getByText(etiqueta, { exact: true })).last().click();
}

async function guardar(page) {
    await botonGuardar(page).click();
    await expect(visible(page.getByText('Políticas guardadas correctamente.'))).toBeVisible();
}

module.exports = { irAlMenu, URL_BACK, auth, visible, leerPoliticas, restaurarPoliticas, abrirPoliticas, campoDias, interruptores, botonGuardar, elegirTipo, guardar, loginApi };
