// Ayudas de la tanda T19: esperas más largas para cuando el servidor está con carga.
const { expect } = require('@playwright/test');
const { irAlMenu, foto } = require('../helpers');
const { abrirComo } = require('./sesion');

/** Recepta un objeto como `receptarObjeto`, pero espera hasta 60 s la confirmación (foto + IA tardan con carga). */
async function receptarObjetoConCarga(page, titulo) {
    await irAlMenu(page, 'Receptar un objeto');
    await page.getByPlaceholder('Escribe un título').fill(titulo);
    await page.locator('input[type="file"]').first().setInputFiles(foto('billetera.png'));
    await expect(page.getByText('Seleccionar foto')).toBeVisible();
    await page.getByText('Receptar objeto encontrado', { exact: true }).click();
    await expect(page.getByText('El objeto fue cargado al inventario con éxito.')).toBeVisible({ timeout: 60_000 });
    await page.getByText('Cerrar', { exact: true }).click();
    return titulo;
}

/** Abre sesión como `email`, recepta un objeto con espera larga y cierra. Devuelve el título. */
async function receptarComoEmpleadoConCarga(browser, email, titulo) {
    const { context, page } = await abrirComo(browser, email);
    try {
        await receptarObjetoConCarga(page, titulo);
    } finally {
        await context.close();
    }
    return titulo;
}

module.exports = { receptarObjetoConCarga, receptarComoEmpleadoConCarga };
