// Recepción: sacar la foto con la cámara (carril paralelo, empleado de Aeropuerto).
// Chromium usa una cámara simulada y acepta solo el permiso; las opciones de lanzamiento
// van al principio del archivo porque Playwright no las permite dentro de un describe.
const { test, expect } = require('@playwright/test');
const { caso } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const { EMPLEADO_AERO, abrirRecepcion, vistaPrevia } = require('./helpers/t03');

test.use({
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});

test('caso 070: saca una foto con la cámara y el sistema la muestra @recepcion @paralelo', async ({ browser }) => {
    test.setTimeout(180_000);
    const { context, page } = await abrirComo(browser, EMPLEADO_AERO);
    try {
        await context.grantPermissions(['camera']);
        await abrirRecepcion(page);

        await caso(70, 'al presionar "Sacar foto" y capturar, el sistema captura y muestra la imagen', async () => {
            await expect(vistaPrevia(page)).toHaveCount(0);
            await page.getByText('Sacar Foto', { exact: true }).locator('visible=true').click();

            const video = page.locator('video');
            await expect(video).toBeVisible();
            // La cámara simulada tiene que estar entregando cuadros antes de capturar.
            await expect.poll(() => video.evaluate((v) => v.videoWidth), { timeout: 15_000 }).toBeGreaterThan(0);

            await page.getByText('Capturar foto', { exact: true }).click();
            await expect(video).toHaveCount(0);
            await expect(vistaPrevia(page)).toHaveCount(1);
            expect(await vistaPrevia(page).getAttribute('style')).toContain('blob:');
        });
    } finally {
        await context.close();
    }
});
