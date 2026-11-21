const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, caso } = require('./helpers');
const { abrirSesion, abrirMenuDesdeInicio, entrarPorMenu, verificarPantalla } = require('./helpers/t01');
const { verificarPie, verificarMenu, verificarAusentes, cerrarSesionPorMenu, irAMiPerfil, verificarDatosPerfil } = require('./helpers/r15');

const EMPLEADO = USUARIOS_PARALELO.empleadoUnc;

const OPCIONES_EMPLEADO = ['Receptar un objeto', 'Ver inventario', 'Ver objetos devueltos', 'Notificaciones', 'Mi perfil'];

test.describe('Menú del empleado', () => {
    test('casos 015, 016, 025, 032 y 133: inicio, pie y opciones del menú del empleado @navegacion @paralelo', async ({ browser }) => {
        test.setTimeout(240_000);
        const { context, page } = await abrirSesion(browser, EMPLEADO);
        await caso(15, 'el empleado, al iniciar sesión, ve Ver inventario', async () => {
            await expect(page.getByText('Inventario').locator('visible=true').first()).toBeVisible();
        });
        await abrirMenuDesdeInicio(page);
        await caso(16, 'el pie del menú muestra la versión y el contacto de soporte', async () => {
            await verificarPie(page);
        });
        await caso(25, 'el menú del empleado muestra sus opciones y el pie, sin Buscar un objeto ni Logros', async () => {
            await verificarMenu(page, OPCIONES_EMPLEADO, ['Buscar un objeto', 'Logros']);
        });
        await caso(32, 'el empleado no ve la opción Logros', async () => {
            await verificarAusentes(page, ['Logros']);
        });
        await caso(133, 'el empleado no ve Buscar un objeto, Logros ni Alertas de fraude', async () => {
            await verificarAusentes(page, ['Buscar un objeto', 'Logros', 'Alertas de fraude']);
        });
        await context.close();
    });

    const NAVEGACION = [
        [20, 'Receptar un objeto'],
        [21, 'Ver inventario'],
        [22, 'Ver objetos devueltos'],
    ];

    test('casos 020, 021, 022, 119 y 120: desde el menú el empleado llega a cada pantalla y a su perfil @navegacion @paralelo', async ({ browser }) => {
        test.setTimeout(240_000);
        const { context, page } = await abrirSesion(browser, EMPLEADO);
        for (const [numero, opcion] of NAVEGACION) {
            await caso(numero, `el empleado: "${opcion}" lleva a su pantalla`, async () => {
                const entro = await entrarPorMenu(page, opcion);
                expect.soft(entro, `la opción "${opcion}" no está en el menú del empleado`).toBe(true);
                if (entro) await verificarPantalla(page, opcion);
            });
        }
        await caso(119, 'el empleado abre Mi perfil con sus datos', async () => {
            await irAMiPerfil(page, EMPLEADO);
        });
        await caso(120, 'el perfil del empleado muestra nombre, apellido, email, tipo y organización', async () => {
            await verificarDatosPerfil(page, 'Empleado de organización', true);
        });
        await context.close();
    });

    test('caso 017: el empleado cierra sesión desde el menú y vuelve a la portada @navegacion @paralelo', async ({ browser }) => {
        test.setTimeout(240_000);
        const { context, page } = await abrirSesion(browser, EMPLEADO);
        await caso(17, 'Logout cierra la sesión y muestra la portada con Iniciar sesión y Registrate', async () => {
            await cerrarSesionPorMenu(page);
        });
        await context.close();
    });
});
