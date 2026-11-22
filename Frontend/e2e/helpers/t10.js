// Utilidades de la tanda T10 (reportes de uso y de opiniones, carril paralelo).
const { expect } = require('@playwright/test');
const { irAlMenu } = require('../helpers');
const { abrirComo } = require('./t02');

// Dueño de la organización 4: es el que tiene movimiento repartido en varios meses de 2026.
const DUENO = 'owner.patio@eurekapp.com';
const DESDE_AMPLIO = '2026-01-01';

/** Espera la respuesta (JSON) del servidor cuyo pedido contiene `parte`. */
function esperarJson(page, parte) {
    return page.waitForResponse((r) => r.url().includes(parte) && r.request().method() === 'GET')
        .then(async (r) => ({ url: new URL(r.url()), cuerpo: await r.json() }));
}

/** Ejecuta `accion` y devuelve lo que respondió el servidor a los dos reportes que se recargan. */
async function recargando(page, accion) {
    const uso = esperarJson(page, '/reports?');
    const feedback = esperarJson(page, '/feedback/report?');
    await accion();
    const [u, f] = await Promise.all([uso, feedback]);
    // Deja que la pantalla termine de dibujar la respuesta.
    await page.waitForTimeout(500);
    return { uso: u.cuerpo, feedback: f.cuerpo, pedidoUso: u.url, pedidoFeedback: f.url };
}

/** Abre la pantalla de reportes del dueño y devuelve las respuestas de la primera carga. */
async function abrirReportes(browser, email = DUENO) {
    const { context, page } = await abrirComo(browser, email);
    const carga = await recargando(page, () => irAlMenu(page, 'Reportes'));
    await expect(page.getByText('Reporte de uso', { exact: true }).locator('visible=true')).toBeVisible();
    return { context, page, ...carga };
}

/** Cambia el filtro "Desde" o "Hasta" escribiendo la fecha y devuelve las respuestas nuevas. */
async function cambiarFecha(page, etiqueta, fecha) {
    return recargando(page, async () => {
        await page.getByText(etiqueta, { exact: true }).locator('visible=true').locator('xpath=following-sibling::*[1]').click();
        const campo = page.locator('input[type="date"]');
        await campo.fill(fecha);
        await campo.press('Enter');
        // EU-449: las fechas se aplican recién al tocar "Actualizar reporte".
        await page.getByText('Actualizar reporte', { exact: true }).locator('visible=true').click();
    });
}

/** Aprieta un botón de texto (agrupación o filtro de feedback) y devuelve las respuestas nuevas. */
async function apretar(page, texto) {
    return recargando(page, () => page.getByText(texto, { exact: true }).locator('visible=true').click());
}

const HOY = () => new Date().toISOString().slice(0, 10);

/** Contenedor de una sección: el padre del título. */
const seccion = (page, titulo) => page.getByText(titulo, { exact: true }).locator('visible=true').locator('xpath=..');

/** Texto visible de la pantalla. */
const textoPantalla = async (page) => (await page.locator('body').innerText());

/** Valor numérico que se muestra encima de la etiqueta de una tarjeta de métrica. */
async function valorDeTarjeta(page, etiqueta) {
    const valor = page.getByText(etiqueta, { exact: true }).locator('visible=true').locator('xpath=preceding-sibling::*[1]');
    return (await valor.innerText()).trim();
}

/** Misma fórmula de horas/días que usa la pantalla para mostrar tiempos. */
const horas = (h) => (h == null ? '—' : h >= 24 ? `${(h / 24).toFixed(1)} días` : `${h.toFixed(1)} hs`);

/** Color de fondo de un botón de texto: el de la opción activa es turquesa. */
const ACTIVO = 'rgb(25, 184, 184)';
async function fondoDe(page, texto) {
    return page.getByText(texto, { exact: true }).locator('visible=true').locator('xpath=..').evaluate((e) => getComputedStyle(e).backgroundColor);
}

module.exports = { HOY, seccion, DUENO, DESDE_AMPLIO, ACTIVO, esperarJson, recargando, abrirReportes, cambiarFecha, apretar, textoPantalla, valorDeTarjeta, horas, fondoDe };
