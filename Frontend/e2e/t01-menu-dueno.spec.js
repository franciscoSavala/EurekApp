const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, caso } = require('./helpers');
const { abrirSesion, iniciarSesionReintentando, abrirMenuDesdeInicio, entrarPorMenu, verificarPantalla } = require('./helpers/t01');
const { verificarPie, verificarMenu, verificarAusentes, cerrarSesionPorMenu, irAMiPerfil, verificarDatosPerfil } = require('./helpers/r15');

const DUENO = USUARIOS_PARALELO.duenoPatio;

const OPCIONES_DUENO = [
    'Receptar un objeto', 'Ver inventario', 'Ver objetos devueltos', 'Notificaciones', 'Mi perfil', 'Reportes',
    'Exclusiones de recompensa', 'Mi organización', 'Mi solicitud de organización',
];

test.describe('Menú del dueño de la organización', () => {
    test('caso 015: el dueño que inicia sesión llega a Ver inventario @navegacion @paralelo', async ({ page }) => {
        test.setTimeout(300_000);
        await iniciarSesionReintentando(page, DUENO);
        await caso(15, 'tras iniciar sesión el dueño ve la pantalla Ver inventario', async () => {
            await expect(page.getByText('Inventario').locator('visible=true').first()).toBeVisible();
            await expect(page.getByText('Descripción del objeto:').locator('visible=true')).toHaveCount(0);
        });
    });

    test('casos 016, 019, 032 y 133: pie y opciones del menú del dueño @navegacion @paralelo', async ({ browser }) => {
        test.setTimeout(240_000);
        const { context, page } = await abrirSesion(browser, DUENO);
        await abrirMenuDesdeInicio(page);
        await caso(16, 'el pie del menú muestra la versión y el contacto de soporte', async () => {
            await verificarPie(page);
        });
        await caso(19, 'se ven las opciones del dueño en orden, el pie y no aparecen Buscar un objeto, Logros ni Alertas de fraude', async () => {
            await verificarMenu(page, OPCIONES_DUENO, ['Buscar un objeto', 'Logros', 'Alertas de fraude']);
        });
        await caso(32, 'el dueño no ve la opción Logros', async () => {
            await verificarAusentes(page, ['Logros']);
        });
        await caso(133, 'el dueño no ve Buscar un objeto, Logros ni Alertas de fraude', async () => {
            await verificarAusentes(page, ['Buscar un objeto', 'Logros', 'Alertas de fraude']);
        });
        await context.close();
    });

    // Cada opción: [caso de la planilla que la cubre, texto de la opción]
    const NAVEGACION = [
        [20, 'Receptar un objeto'],
        [21, 'Ver inventario'],
        [22, 'Ver objetos devueltos'],
        [23, 'Reportes'],
        [24, 'Mi organización'],
    ];

    test('casos 020 a 024, 119 y 120: desde el menú el dueño llega a cada pantalla y a su perfil @navegacion @paralelo', async ({ browser }) => {
        test.setTimeout(240_000);
        const { context, page } = await abrirSesion(browser, DUENO);
        for (const [numero, opcion] of NAVEGACION) {
            await caso(numero, `el dueño: "${opcion}" lleva a su pantalla`, async () => {
                const entro = await entrarPorMenu(page, opcion);
                expect.soft(entro, `la opción "${opcion}" no está en el menú del dueño`).toBe(true);
                if (entro) await verificarPantalla(page, opcion);
            });
        }
        await caso(119, 'el dueño abre Mi perfil con sus datos', async () => {
            await irAMiPerfil(page, DUENO);
        });
        await caso(120, 'el perfil del dueño muestra nombre, apellido, email, tipo y organización', async () => {
            await verificarDatosPerfil(page, 'Dueño de organización', true);
        });
        await context.close();
    });

    test('caso 017: el dueño cierra sesión desde el menú y vuelve a la portada @navegacion @paralelo', async ({ browser }) => {
        test.setTimeout(240_000);
        const { context, page } = await abrirSesion(browser, DUENO);
        await caso(17, 'Logout cierra la sesión y muestra la portada con Iniciar sesión y Registrate', async () => {
            await cerrarSesionPorMenu(page);
        });
        await context.close();
    });
});
