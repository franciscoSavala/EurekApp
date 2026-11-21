const { test, expect } = require('@playwright/test');
const { USUARIOS, USUARIOS_PARALELO, caso, irAlLogin, abrirMenu, CLAVE } = require('./helpers');
const { ingresar } = require('./helpers/r01');

/** Inicia sesión por la pantalla y espera el menú. */
async function iniciarSesion(page, email) {
    await irAlLogin(page);
    await ingresar(page, email, CLAVE);
    await expect(page.getByText('Logout')).toBeVisible();
}

test.describe('Sesión', () => {
    test('caso 001: con credenciales correctas entra a Buscar un objeto @sesion @paralelo', async ({ page }) => {
        await irAlLogin(page);
        await ingresar(page, USUARIOS_PARALELO.usuarioValeria, CLAVE);

        await caso(1, 'el usuario regular entra a Buscar un objeto y el menú muestra ¡Bienvenido, <su nombre>!', async () => {
            await expect(page.getByText('Descripción del objeto:')).toBeVisible();
            await expect(page.getByText('¡Bienvenido, Valeria!')).toBeVisible();
        });
    });

    test('caso 002: con credenciales incorrectas no deja entrar y avisa @sesion @paralelo', async ({ page }) => {
        await irAlLogin(page);
        await ingresar(page, 'no.registrado.r01@mail.com', 'ClaveMala9!');

        await caso(2, 'con email no registrado y contraseña incorrecta no entra y muestra "Error en los datos enviados"', async () => {
            await expect(page.getByText('Error en los datos enviados')).toBeVisible();
            await expect(page.getByText('Logout')).toHaveCount(0);
        });
    });

    test('caso 003: con los campos vacíos pide completarlos @sesion @paralelo', async ({ page }) => {
        await irAlLogin(page);
        await page.getByText('Iniciar sesión', { exact: true }).last().click();

        await caso(3, 'no inicia sesión y muestra Email requerido y Contraseña requerida', async () => {
            await expect(page.getByText('Email requerido')).toBeVisible();
            await expect(page.getByText('Contraseña requerida')).toBeVisible();
            await expect(page.getByText('Logout')).toHaveCount(0);
        });
    });

    // Entra el encargado de la organización 1: por eso corre con los tests en serie.
    test('caso 015: cada rol queda en su pantalla de inicio al iniciar sesión @sesion @serie', async ({ browser }) => {
        const inicios = [
            { rol: 'usuario regular', email: USUARIOS.usuario, ve: 'Buscar un objeto', ruta: 'FindObjectStackScreen' },
            { rol: 'empleado', email: USUARIOS.empleado, ve: 'Ver inventario', ruta: 'LostObjectReturnStackScreen' },
            { rol: 'encargado', email: USUARIOS.encargado, ve: 'Ver inventario', ruta: 'LostObjectReturnStackScreen' },
            { rol: 'dueño de organización', email: USUARIOS.dueno, ve: 'Ver inventario', ruta: 'LostObjectReturnStackScreen' },
            { rol: 'administrador', email: USUARIOS.admin, ve: 'Dashboard', ruta: 'GlobalStatisticsDashboard' },
        ];
        await caso(15, 'tras iniciar sesión, el usuario regular ve Buscar un objeto; empleado, encargado y dueño ven Ver inventario; el administrador ve el Dashboard', async () => {
            for (const { rol, email, ve, ruta } of inicios) {
                const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL || 'http://localhost:8082', viewport: { width: 1280, height: 900 } });
                try {
                    const page = await context.newPage();
                    await iniciarSesion(page, email);
                    // La pantalla de inicio se reconoce por su ruta: el menú lateral tiene los nombres de todas las opciones.
                    await expect.soft(page, `el ${rol} debería quedar en ${ve}`).toHaveURL(new RegExp(`/${ruta}`));
                } finally {
                    await context.close();
                }
            }
        });
    });

    test('caso 017: cierra la sesión desde el menú y vuelve a la portada @sesion @paralelo', async ({ page }) => {
        await iniciarSesion(page, USUARIOS_PARALELO.usuarioPedro);
        await abrirMenu(page);
        await page.getByText('Logout').click();

        await caso(17, 'se cierra la sesión y aparece la portada Bienvenido a Eurekapp con Iniciar sesión y Registrate', async () => {
            await expect(page.getByText('Bienvenido a Eurekapp')).toBeVisible();
            await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();
            await expect(page.getByText('Registrate', { exact: true })).toBeVisible();
            // La sesión quedó cerrada de verdad: recargar no devuelve al usuario adentro.
            await page.reload();
            await expect(page.getByText('Bienvenido a Eurekapp')).toBeVisible();
            await expect(page.getByText('Logout')).toHaveCount(0);
        });
    });
});
