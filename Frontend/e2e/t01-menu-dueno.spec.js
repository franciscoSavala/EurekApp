const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, caso } = require('./helpers');
const { abrirSesion, iniciarSesionReintentando, abrirMenuDesdeInicio, entrarPorMenu, verificarPantalla, verificarOpcionesDelMenu, enlaceMenu } = require('./helpers/t01');

const DUENO = USUARIOS_PARALELO.duenoPatio;

const OPCIONES_DUENO = [
    'Buscar un objeto', 'Receptar un objeto', 'Ver inventario', 'Ver objetos devueltos', 'Logros', 'Mi perfil',
    'Alertas de fraude', 'Reportes', 'Mi organización',
];

test.describe('Menú del dueño de la organización', () => {
    test('casos 158: el dueño que inicia sesión llega a Buscar un objeto @navegacion @paralelo', async ({ page }) => {
        await iniciarSesionReintentando(page, DUENO);
        await caso(158, 'tras iniciar sesión el dueño ve la pantalla Buscar un objeto', async () => {
            await expect(page.getByText('Descripción del objeto:')).toBeVisible();
        });
    });

    test('casos 026, 027 y 159: el menú del dueño muestra todas sus opciones @navegacion @paralelo', async ({ browser }) => {
        const { context, page } = await abrirSesion(browser, DUENO);
        await abrirMenuDesdeInicio(page);
        await caso(26, 'el menú se despliega con opciones propias del rol', async () => {
            await expect.soft(page.getByText('Logout')).toBeVisible();
            await expect.soft(enlaceMenu(page, 'Reportes')).toBeVisible();
            await expect.soft(enlaceMenu(page, 'Mi organización')).toBeVisible();
        });
        await caso(27, 'se ven las opciones, la versión, el contacto y Logout', async () => {
            await verificarOpcionesDelMenu(page, OPCIONES_DUENO);
        });
        await caso(159, 'se muestran todas las opciones disponibles para el dueño', async () => {
            await verificarOpcionesDelMenu(page, OPCIONES_DUENO);
        });
        await context.close();
    });

    // Cada opción: [casos de la planilla que la cubren, texto de la opción]
    const NAVEGACION = [
        [[160], 'Buscar un objeto'],
        [[28, 161], 'Receptar un objeto'],
        [[29, 162], 'Ver inventario'],
        [[30, 163], 'Ver objetos devueltos'],
        [[164], 'Logros'],
        [[165], 'Mi perfil'],
        [[31, 166], 'Alertas de fraude'],
        [[32, 167], 'Reportes'],
        [[33, 168], 'Mi organización'],
    ];

    test('casos 160 a 168 y 028 a 033: desde el menú el dueño llega a cada pantalla @navegacion @paralelo', async ({ browser }) => {
        const { context, page } = await abrirSesion(browser, DUENO);
        for (const [casos, opcion] of NAVEGACION) {
            let entro = false;
            for (const [i, numero] of casos.entries()) {
                await caso(numero, `"${opcion}" lleva a su pantalla`, async () => {
                    if (i === 0) entro = await entrarPorMenu(page, opcion);
                    expect.soft(entro, `la opción "${opcion}" no está en el menú del dueño`).toBe(true);
                    if (entro) await verificarPantalla(page, opcion);
                });
            }
        }
        await context.close();
    });
});
