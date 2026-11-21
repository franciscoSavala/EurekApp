// Tanda R03: aviso de confirmación de la recepción (carril paralelo, empleado de Aeropuerto).
// La opinión sobre la app ya no se pide al receptar: se prueba desde Mi perfil en feedback-app.spec.js.
const { test, expect } = require('@playwright/test');
const { caso, nombreUnico } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const { MENSAJE_EXITO, EMPLEADO_AERO, receptarMinimo } = require('./helpers/t03');
const { modalAbierto } = require('./helpers/r03');

const TITULO_MODAL = '¿Cómo fue tu experiencia?';

test.describe('Recepción: confirmación', () => {
    let context;
    let page;

    test.beforeEach(async ({ browser }) => {
        ({ context, page } = await abrirComo(browser, EMPLEADO_AERO));
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('casos 081 y 082: el aviso de éxito se cierra y no aparece ningún pedido de opinión @recepcion @paralelo', async () => {
        const respuesta = await receptarMinimo(page, nombreUnico('Objeto confirmacion e2e'));
        expect(respuesta.status()).toBe(200);
        await expect(page.getByText(MENSAJE_EXITO)).toBeVisible();

        await caso(81, 'al presionar Cerrar el sistema cierra el modal de confirmación', async () => {
            await page.getByText('Cerrar', { exact: true }).click();
            await expect(page.getByText(MENSAJE_EXITO)).toHaveCount(0);
            await expect(modalAbierto(page)).toHaveCount(0);
        });

        await caso(82, 'tras cerrar el aviso no aparece ningún pedido de opinión y el empleado queda listo para receptar otro objeto', async () => {
            // Se espera un rato: el pedido de opinión, si existiera, aparecería poco después de cerrar.
            await page.waitForTimeout(3000);
            await expect(page.getByText(TITULO_MODAL)).toHaveCount(0);
            await expect(modalAbierto(page)).toHaveCount(0);
            await expect(page.getByPlaceholder('Escribe un título')).toBeVisible();
            await expect(page.getByPlaceholder('Escribe un título')).toHaveValue('');
        });
    });
});
