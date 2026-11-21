// Utilidades de la tanda R08 (reportes de uso, tendencias y exportación CSV).
const fs = require('fs');
const { expect } = require('@playwright/test');
const { irAlMenu, abrirMenu, USUARIOS } =require('../helpers');
const { abrirComo } = require('./t02');

/** Espera la respuesta (JSON) del servidor cuyo pedido contiene `parte`. */
const esperarJson = (page, parte) => page.waitForResponse((r) => r.url().includes(parte) && r.request().method() === 'GET')
    .then(async (r) => ({ url: new URL(r.url()), cuerpo: await r.json() }));

/** Abre como administrador la pantalla Opiniones sobre la app (reporte de usabilidad). */
async function abrirUsabilidad(browser) {
    const { context, page } = await abrirComo(browser, USUARIOS.admin);
    const carga = esperarJson(page, '/usability-feedback/report?');
    await irAlMenu(page, 'Opiniones sobre la app');
    const inicial = await carga;
    await expect(page.getByText('Actualizar reporte', { exact: true }).locator('visible=true')).toBeVisible();
    return { context, page, inicial: inicial.cuerpo };
}

/** Escribe una fecha en el filtro Desde o Hasta (la pantalla no recarga sola). */
async function escribirFecha(page, etiqueta, fecha) {
    await page.getByText(etiqueta, { exact: true }).locator('visible=true').locator('xpath=following-sibling::*[1]').click();
    const campo = page.locator('input[type="date"]');
    await campo.fill(fecha);
    await campo.press('Enter');
}

/** Toca "Actualizar reporte" y devuelve la respuesta del servidor. */
async function actualizarUsabilidad(page) {
    const carga = esperarJson(page, '/usability-feedback/report?');
    await page.getByText('Actualizar reporte', { exact: true }).locator('visible=true').click();
    const r = await carga;
    await page.waitForTimeout(500);
    return r;
}

/** Aprieta el botón y devuelve el nombre y las líneas del archivo descargado (sin marca de orden de bytes). */
async function descargar(page, boton) {
    const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), boton.click()]);
    const contenido = fs.readFileSync(await descarga.path(), 'utf8').replace(/^﻿/, '');
    return { nombre: descarga.suggestedFilename(), lineas: contenido.split(/\r?\n/).filter(Boolean) };
}

/**
 * Entra como administrador al reporte de precisión (feedback de búsquedas) por el menú lateral.
 * Si el menú no lo ofrece, el paso falla con ese motivo.
 */
async function abrirPrecision(page) {
    await page.goto('/');
    await abrirMenu(page);
    const enlace = page.locator('a', { has: page.getByText(/precisi[oó]n/i) });
    if (await enlace.count() === 0) throw new Error('el menú del administrador no tiene el reporte de precisión');
    await enlace.first().click();
    await expect(page.getByText('Exportar CSV', { exact: true }).locator('visible=true')).toBeVisible();
}

module.exports = { abrirPrecision, esperarJson, abrirUsabilidad, escribirFecha, actualizarUsabilidad, descargar };
