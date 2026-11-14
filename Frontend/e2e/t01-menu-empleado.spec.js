const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, caso, } = require('./helpers');
const { abrirSesion, abrirMenuDesdeInicio, entrarPorMenu, verificarPantalla, verificarOpcionesDelMenu, enlaceMenu } = require('./helpers/t01');

const EMPLEADO = USUARIOS_PARALELO.empleadoUnc;

const OPCIONES_EMPLEADO = ['Buscar un objeto', 'Receptar un objeto', 'Ver inventario', 'Ver objetos devueltos', 'Logros', 'Mi perfil'];

test.describe('Menú del empleado', () => {
    test('casos 034 y 035: el menú del empleado muestra sus opciones @navegacion @paralelo', async ({ browser }) => {
        const { context, page } = await abrirSesion(browser, EMPLEADO);
        await abrirMenuDesdeInicio(page);
        await caso(34, 'el menú se despliega con opciones del rol', async () => {
            await expect.soft(page.getByText('Logout')).toBeVisible();
            await expect.soft(enlaceMenu(page, 'Receptar un objeto')).toBeVisible();
            await expect.soft(enlaceMenu(page, 'Ver inventario')).toBeVisible();
        });
        await caso(35, 'se ven las opciones del empleado, la versión, el contacto y Logout', async () => {
            await verificarOpcionesDelMenu(page, OPCIONES_EMPLEADO);
        });
        await context.close();
    });

    const NAVEGACION = [
        [36, 'Receptar un objeto'],
        [37, 'Ver inventario'],
        [38, 'Ver objetos devueltos'],
        [39, 'Logros'],
        [40, 'Mi perfil'],
    ];

    test('casos 036 a 040: desde el menú el empleado llega a cada pantalla @navegacion @paralelo', async ({ browser }) => {
        const { context, page } = await abrirSesion(browser, EMPLEADO);
        for (const [numero, opcion] of NAVEGACION) {
            await caso(numero, `"${opcion}" lleva a su pantalla`, async () => {
                const entro = await entrarPorMenu(page, opcion);
                expect.soft(entro, `la opción "${opcion}" no está en el menú del empleado`).toBe(true);
                if (entro) await verificarPantalla(page, opcion);
            });
        }
        await context.close();
    });
});
