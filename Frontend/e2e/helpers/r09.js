// Utilidades de la tanda R09 (reportes de opiniones y de coincidencias).
const { expect } = require('@playwright/test');
const { USUARIOS } = require('../helpers');
const { abrirComo } = require('./sesion');
const { abrirMenuDesdeInicio } = require('./t01');

/**
 * Abre, como administrador, el reporte de precisión de las coincidencias desde el menú.
 * Si el menú del administrador no lo tiene, el paso falla con ese motivo.
 */
async function abrirPrecisionAdmin(browser) {
    const { context, page } = await abrirComo(browser, USUARIOS.admin);
    await abrirMenuDesdeInicio(page);
    const enlace = page.locator('a', { hasText: /Reportes?|Precisi[oó]n/i }).locator('visible=true').first();
    try {
        await expect(enlace, 'el menú del administrador debería tener el reporte de precisión de las coincidencias').toBeVisible({ timeout: 3000 });
        await enlace.click();
    } catch (e) {
        await context.close();
        throw e;
    }
    return { context, page };
}

module.exports = { abrirPrecisionAdmin };
