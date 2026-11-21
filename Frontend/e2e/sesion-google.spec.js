const { test, expect } = require('@playwright/test');
const { caso, irAlLogin } = require('./helpers');
const { irARegistro } = require('./helpers/t01');

/** Presiona Continuar con Google y devuelve la ventana que abre el navegador (el selector de cuentas). */
async function abrirGoogle(page) {
    const ventana = page.waitForEvent('popup', { timeout: 20_000 });
    await page.getByText('Continuar con Google').locator('visible=true').last().click();
    const popup = await ventana;
    await popup.waitForLoadState('domcontentloaded');
    return popup;
}

test.describe('Ingreso con Google', () => {
    test('casos 219 y 223: abre el selector de cuentas de Google y, si se cierra, se puede reintentar @sesion @paralelo', async ({ page }) => {
        await caso(219, 'en el login y en el registro, Continuar con Google abre el selector de cuentas de Google', async () => {
            await irAlLogin(page);
            const enLogin = await abrirGoogle(page);
            expect.soft(new URL(enLogin.url()).hostname, 'desde el login').toBe('accounts.google.com');
            await enLogin.close();

            await irARegistro(page);
            const enRegistro = await abrirGoogle(page);
            expect.soft(new URL(enRegistro.url()).hostname, 'desde el registro').toBe('accounts.google.com');
            await enRegistro.close();
        });

        await caso(223, 'al cerrar el selector sin elegir cuenta no se crea cuenta, el usuario sigue en la pantalla y puede reintentar', async () => {
            await irAlLogin(page);
            const primera = await abrirGoogle(page);
            await primera.close();
            await expect(page.getByText('Logout')).toHaveCount(0);
            await expect(page.getByPlaceholder('Email').locator('visible=true').last()).toBeVisible();
            await expect(page.getByText('Continuar con Google').locator('visible=true').last()).toBeVisible();
            const segunda = await abrirGoogle(page);
            expect(new URL(segunda.url()).hostname, 'el segundo intento abre el selector otra vez').toBe('accounts.google.com');
            await segunda.close();
        });
    });
});
