// Mi perfil y menú lateral del administrador (casos 370 y 371).
const { test, expect } = require('@playwright/test');
const { USUARIOS } = require('./helpers');
const { abrirSesion, abrirMenuDesdeInicio, enlaceMenu, entrarPorMenu, verificarPantalla } = require('./helpers/t01');
const { casoContinuo: caso } = require('./helpers/t17');

test.describe('Administrador: perfil y menú', () => {
    test('caso 370: el administrador ve su tipo de usuario en Mi perfil @navegacion @paralelo', async ({ browser }) => {
        test.setTimeout(120_000);
        const { context, page } = await abrirSesion(browser, USUARIOS.admin);
        try {
            await caso(370, 'en Mi perfil, "Tipo de usuario:" muestra "Administrador"', async () => {
                expect(await entrarPorMenu(page, 'Mi perfil')).toBe(true);
                await verificarPantalla(page, 'Mi perfil');
                await expect(page.getByText('Tipo de usuario:')).toBeVisible();
                await expect(page.getByText('Administrador', { exact: true }).locator('visible=true').first()).toBeVisible();
            });
        } finally {
            await context.close();
        }
    });

    test('caso 371: el administrador puede tocar todas las opciones del menú @navegacion @paralelo', async ({ browser }) => {
        test.setTimeout(120_000);
        const { context, page } = await abrirSesion(browser, USUARIOS.admin);
        try {
            await caso(371, 'Notificaciones y Mi perfil abren su pantalla y el pie del menú no tapa ninguna opción', async () => {
                await abrirMenuDesdeInicio(page);
                // El pie (versión y contacto) no debe superponerse con ninguna opción del menú.
                const pie = await page.getByText(/Versión de la app:/).boundingBox();
                const opciones = await page.locator('a:visible').all();
                expect(opciones.length).toBeGreaterThan(5);
                for (const o of opciones) {
                    const c = await o.boundingBox();
                    if (!c) continue;
                    expect(c.y + c.height, 'una opción queda tapada por el pie del menú').toBeLessThanOrEqual(pie.y + 1);
                }
                await expect(enlaceMenu(page, 'Mi perfil')).toBeInViewport();
                expect(await entrarPorMenu(page, 'Notificaciones')).toBe(true);
                await expect(page).toHaveURL(/NotificationsStackScreen/);
                expect(await entrarPorMenu(page, 'Mi perfil')).toBe(true);
                await verificarPantalla(page, 'Mi perfil');
            });
        } finally {
            await context.close();
        }
    });
});
