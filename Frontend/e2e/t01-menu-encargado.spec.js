const { test, expect } = require('@playwright/test');
const { USUARIOS, caso } = require('./helpers');
const { abrirSesion, abrirMenuDesdeInicio, entrarPorMenu, verificarPantalla } = require('./helpers/t01');
const { verificarPie, verificarMenu, verificarAusentes, cerrarSesionPorMenu, irAMiPerfil, verificarDatosPerfil } = require('./helpers/r15');

// El encargado existe solo en la organización 1 (carril serie): los tests son de solo lectura.
const ENCARGADO = USUARIOS.encargado;

const OPCIONES_ENCARGADO = ['Receptar un objeto', 'Ver inventario', 'Ver objetos devueltos', 'Notificaciones', 'Mi perfil'];

test.describe('Menú del encargado de la organización', () => {
    test('casos 015, 016, 017, 025, 032, 119, 120 y 133: inicio, menú, perfil y cierre de sesión del encargado @navegacion @serie', async ({ browser }) => {
        test.setTimeout(240_000);
        const { context, page } = await abrirSesion(browser, ENCARGADO);
        await caso(15, 'el encargado, al iniciar sesión, ve Ver inventario', async () => {
            await expect(page.getByText('Inventario').locator('visible=true').first()).toBeVisible();
        });
        await abrirMenuDesdeInicio(page);
        await caso(16, 'el pie del menú muestra la versión y el contacto de soporte', async () => {
            await verificarPie(page);
        });
        await caso(25, 'el menú del encargado muestra las mismas opciones que el empleado y el pie, sin Buscar un objeto ni Logros', async () => {
            await verificarMenu(page, OPCIONES_ENCARGADO, ['Buscar un objeto', 'Logros']);
        });
        await caso(32, 'el encargado no ve la opción Logros', async () => {
            await verificarAusentes(page, ['Logros']);
        });
        await caso(133, 'el encargado no ve Buscar un objeto, Logros ni Alertas de fraude', async () => {
            await verificarAusentes(page, ['Buscar un objeto', 'Logros', 'Alertas de fraude']);
        });
        await caso(20, 'el encargado: "Receptar un objeto" lleva a su pantalla', async () => {
            const entro = await entrarPorMenu(page, 'Receptar un objeto');
            expect.soft(entro).toBe(true);
            if (entro) await verificarPantalla(page, 'Receptar un objeto');
        });
        await caso(119, 'el encargado abre Mi perfil con sus datos', async () => {
            await irAMiPerfil(page, ENCARGADO);
        });
        await caso(120, 'el perfil del encargado muestra nombre, apellido, email, tipo y organización', async () => {
            await verificarDatosPerfil(page, 'Encargado', true);
        });
        await caso(17, 'Logout cierra la sesión y muestra la portada con Iniciar sesión y Registrate', async () => {
            await cerrarSesionPorMenu(page);
        });
        await context.close();
    });
});
