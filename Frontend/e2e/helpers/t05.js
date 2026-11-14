// Utilidades de la tanda T05 (opiniones sobre la app y sobre las recompensas).
const { expect } = require('@playwright/test');
const { irAlMenu } = require('../helpers');

const URL_BACK = process.env.E2E_BACK_URL || 'http://localhost:8080';
const BOTON_FEEDBACK = 'Dar feedback de usabilidad de la app';
const ASPECTOS = ['Facilidad de uso', 'Claridad de interfaz', 'Tiempo de respuesta', 'Navegación'];

/** Entra a Mi perfil por el menú y abre el modal de opinión sobre la app. */
async function abrirModalFeedback(page) {
    await irAlMenu(page, 'Mi perfil');
    await page.getByText(BOTON_FEEDBACK, { exact: true }).locator('visible=true').click();
    await expect(page.getByText('¿Cómo fue tu experiencia?')).toBeVisible();
}

/** Las cinco estrellas del modal. */
const estrellas = (page) => page.getByText('Tu opinión nos ayuda a mejorar la aplicación.').locator('xpath=following-sibling::*[1]').locator('xpath=./*');

/** Cuántas estrellas se ven marcadas (color ámbar). */
async function estrellasMarcadas(page) {
    return estrellas(page).evaluateAll((els) => els.filter((el) => [el, ...el.querySelectorAll('*')].some((n) => getComputedStyle(n).color === 'rgb(240, 165, 0)')).length);
}

/** Si el aspecto se ve activo (texto turquesa). */
const aspectoActivo = (page, texto) => page.getByText(texto, { exact: true }).evaluate((el) => getComputedStyle(el).color === 'rgb(25, 184, 184)');

const botonEnviar = (page) => page.getByText('Enviar', { exact: true }).locator('visible=true');
const botonOmitir = (page) => page.getByText('Omitir', { exact: true }).locator('visible=true');

/** Si el botón con ese texto está deshabilitado (aria-disabled en el elemento tocable). */
const botonDeshabilitado = (page, texto) => page.getByText(texto, { exact: true }).locator('visible=true').evaluate((el) => {
    for (let n = el; n; n = n.parentElement) {
        if (n.getAttribute('aria-disabled') === 'true') return true;
    }
    return false;
});

module.exports = { URL_BACK, BOTON_FEEDBACK, ASPECTOS, abrirModalFeedback, estrellas, estrellasMarcadas, aspectoActivo, botonEnviar, botonOmitir, botonDeshabilitado };
