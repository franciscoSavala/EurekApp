const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, caso } = require('./helpers');
const { abrirSesion, abrirMenuDesdeInicio, entrarPorMenu, verificarPantalla, enlaceMenu } = require('./helpers/t01');
const { verificarPie, verificarMenu, cerrarSesionPorMenu, irAMiPerfil, verificarDatosPerfil } = require('./helpers/r15');

const USUARIO = USUARIOS_PARALELO.usuarioValeria;

const OPCIONES_USUARIO = ['Buscar un objeto', 'Mis búsquedas', 'Solicitar alta de organización', 'Mi solicitud de organización', 'Logros', 'Notificaciones', 'Mi perfil'];

test.describe('Menú del usuario regular', () => {
    test('casos 015, 016, 018 y 026: inicio, pie, cierre y opciones del menú del usuario regular @navegacion @paralelo', async ({ browser }) => {
        test.setTimeout(240_000);
        const { context, page } = await abrirSesion(browser, USUARIO);
        await caso(15, 'el usuario regular, al iniciar sesión, ve Buscar un objeto', async () => {
            await expect(page.getByText('Descripción del objeto:').locator('visible=true').first()).toBeVisible();
        });
        await abrirMenuDesdeInicio(page);
        await caso(16, 'el pie del menú muestra la versión y el contacto de soporte', async () => {
            await verificarPie(page);
        });
        await caso(26, 'el menú del usuario regular muestra sus opciones y el pie', async () => {
            await verificarMenu(page, OPCIONES_USUARIO);
        });
        await caso(18, 'tocar fuera del menú lo oculta y deja la pantalla actual', async () => {
            const urlAntes = page.url();
            await page.mouse.click(1100, 450);
            await expect(page.getByText('Logout')).not.toBeInViewport();
            await expect(page.getByText('Descripción del objeto:').locator('visible=true').first()).toBeVisible();
            expect(page.url()).toBe(urlAntes);
        });
        await context.close();
    });

    test('casos 027, 028, 119 y 133: desde el menú el usuario llega a Buscar un objeto, Logros y Mi perfil @navegacion @paralelo', async ({ browser }) => {
        test.setTimeout(240_000);
        const { context, page } = await abrirSesion(browser, USUARIO);
        await caso(27, '"Buscar un objeto" lleva a la pantalla de búsqueda', async () => {
            const entro = await entrarPorMenu(page, 'Buscar un objeto');
            expect.soft(entro, 'la opción "Buscar un objeto" no está en el menú del usuario').toBe(true);
            if (entro) await verificarPantalla(page, 'Buscar un objeto');
        });
        await caso(28, '"Logros" lleva a la pantalla de logros', async () => {
            const entro = await entrarPorMenu(page, 'Logros');
            expect.soft(entro, 'la opción "Logros" no está en el menú del usuario').toBe(true);
            if (entro) await verificarPantalla(page, 'Logros');
        });
        await caso(119, 'el usuario regular abre Mi perfil con sus datos', async () => {
            await irAMiPerfil(page, USUARIO);
        });
        await caso(120, 'el perfil del usuario regular muestra nombre, apellido, email y tipo, sin organización', async () => {
            await verificarDatosPerfil(page, 'Usuario regular', false);
        });
        await abrirMenuDesdeInicio(page);
        await caso(133, 'el usuario final sí ve Buscar un objeto y Logros', async () => {
            await expect.soft(enlaceMenu(page, 'Buscar un objeto')).toBeVisible();
            await expect.soft(enlaceMenu(page, 'Logros')).toBeVisible();
        });
        await context.close();
    });

    test('caso 017: el usuario regular cierra sesión desde el menú y vuelve a la portada @navegacion @paralelo', async ({ browser }) => {
        test.setTimeout(240_000);
        const { context, page } = await abrirSesion(browser, USUARIO);
        await caso(17, 'Logout cierra la sesión y muestra la portada con Iniciar sesión y Registrate', async () => {
            await cerrarSesionPorMenu(page);
        });
        await context.close();
    });
});
