const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, caso, } = require('./helpers');
const { abrirSesion, abrirMenuDesdeInicio, entrarPorMenu, verificarPantalla, verificarOpcionesDelMenu, enlaceMenu } = require('./helpers/t01');

const USUARIO = USUARIOS_PARALELO.usuarioValeria;

const OPCIONES_USUARIO = ['Buscar un objeto', 'Logros', 'Mi perfil'];

test.describe('Menú del usuario regular', () => {
    test('casos 022, 023 y 025: versión, contacto y cierre del menú @navegacion @paralelo', async ({ browser }) => {
        const { context, page } = await abrirSesion(browser, USUARIO);
        await abrirMenuDesdeInicio(page);
        await caso(22, 'el menú muestra la versión de la app', async () => {
            await expect(page.getByText(/Versión de la app: \d+\.\d+\.\d+/)).toBeVisible();
        });
        await caso(23, 'el menú muestra el email de contacto soporte@eurekapp.com', async () => {
            await expect.soft(page.getByText('Contacto: soporte@eurekapp.com')).toBeVisible({ timeout: 3000 });
        });
        await caso(25, 'tocar fuera del menú lo oculta y deja la pantalla actual', async () => {
            const urlAntes = page.url();
            await page.mouse.click(1100, 450);
            await expect(page.getByText('Logout')).not.toBeInViewport();
            await expect(page.getByText('Descripción del objeto:')).toBeVisible();
            expect(page.url()).toBe(urlAntes);
        });
        await context.close();
    });

    test('casos 041 y 042: el menú del usuario regular muestra sus opciones @navegacion @paralelo', async ({ browser }) => {
        const { context, page } = await abrirSesion(browser, USUARIO);
        await abrirMenuDesdeInicio(page);
        await caso(41, 'el menú se despliega con opciones del rol', async () => {
            await expect.soft(page.getByText('Logout')).toBeVisible();
            await expect.soft(enlaceMenu(page, 'Buscar un objeto')).toBeVisible();
        });
        await caso(42, 'se ven las opciones del usuario, la versión, el contacto y Logout', async () => {
            await verificarOpcionesDelMenu(page, OPCIONES_USUARIO);
        });
        await context.close();
    });

    const NAVEGACION = [
        [[19, 43], 'Buscar un objeto'],
        [[20, 44], 'Logros'],
        [[21, 45], 'Mi perfil'],
    ];

    test('casos 019, 020, 021, 043, 044 y 045: desde el menú el usuario llega a cada pantalla @navegacion @paralelo', async ({ browser }) => {
        const { context, page } = await abrirSesion(browser, USUARIO);
        for (const [casos, opcion] of NAVEGACION) {
            let entro = false;
            for (const [i, numero] of casos.entries()) {
                await caso(numero, `"${opcion}" lleva a su pantalla`, async () => {
                    if (i === 0) entro = await entrarPorMenu(page, opcion);
                    expect.soft(entro, `la opción "${opcion}" no está en el menú del usuario`).toBe(true);
                    if (entro) await verificarPantalla(page, opcion);
                });
            }
        }
        await context.close();
    });
});
