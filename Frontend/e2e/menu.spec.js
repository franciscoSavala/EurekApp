const { test, expect } = require('@playwright/test');
const { USUARIOS, abrirComoUsuario, abrirMenu, esperarRespuesta } = require('./helpers');

/*
 * El menú lateral cambia según quién entró. Estos tests fijan qué opciones ve cada rol del seed
 * (y cuáles no) y que los contadores del menú reflejan lo que informa el servidor.
 */
const TODAS = [
    'Buscar un objeto', 'Receptar un objeto', 'Ver inventario', 'Ver objetos devueltos', 'Mis búsquedas',
    'Solicitar alta de organización', 'Mi solicitud de organización', 'Dashboard', 'Solicitudes de alta', 'Usuarios',
    'Organizaciones', 'Alertas de fraude', 'Configuración de fraude', 'Opiniones sobre la app', 'Logros',
    'Notificaciones', 'Mi perfil', 'Reportes', 'Exclusiones de recompensa', 'Mi organización',
    'Calificar la atención',
];

const OPCIONES = {
    usuario: ['Buscar un objeto', 'Mis búsquedas', 'Solicitar alta de organización', 'Mi solicitud de organización', 'Logros', 'Notificaciones', 'Mi perfil'],
    empleado: ['Receptar un objeto', 'Ver inventario', 'Ver objetos devueltos', 'Notificaciones', 'Mi perfil'],
    encargado: ['Receptar un objeto', 'Ver inventario', 'Ver objetos devueltos', 'Notificaciones', 'Mi perfil'],
    dueno: ['Receptar un objeto', 'Ver inventario', 'Ver objetos devueltos', 'Notificaciones', 'Mi perfil', 'Reportes', 'Exclusiones de recompensa', 'Mi organización', 'Mi solicitud de organización'],
    admin: ['Buscar un objeto', 'Dashboard', 'Solicitudes de alta', 'Usuarios', 'Organizaciones', 'Alertas de fraude', 'Configuración de fraude', 'Opiniones sobre la app', 'Notificaciones', 'Mi perfil'],
};

const opcion = (page, texto) => page.locator('a', { has: page.getByText(texto, { exact: true }) });

test.describe('Menú lateral según el rol', () => {
    for (const [rol, visibles] of Object.entries(OPCIONES)) {
        test(`el rol ${rol} ve exactamente sus opciones del menú @menu ${rol === 'admin' ? '@paralelo' : '@serie'}`, async ({ browser }) => {
            const { context, page } = await abrirComoUsuario(browser, USUARIOS[rol]);
            await abrirMenu(page);
            for (const texto of TODAS) {
                // La opción del menú es un enlace. "Calificar la atención" existe pero oculta: se llega solo por el mail.
                if (visibles.includes(texto)) await expect(opcion(page, texto)).toBeVisible();
                else await expect(opcion(page, texto)).toBeHidden();
            }
            await context.close();
        });
    }

    test('cada rol arranca en su pantalla de inicio @menu @serie', async ({ browser }) => {
        const inicio = {
            usuario: 'Descripción del objeto:',
            empleado: 'Inventario',
            admin: 'Pendientes',
        };
        for (const [rol, texto] of Object.entries(inicio)) {
            const { context, page } = await abrirComoUsuario(browser, USUARIOS[rol]);
            await expect(page.getByText(texto, { exact: false }).first()).toBeVisible();
            await context.close();
        }
    });

    test('los contadores del menú coinciden con lo que informa el servidor @menu @paralelo', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        const sinLeer = esperarRespuesta(page, 'GET', '/notifications/unread-count');
        const pendientes = esperarRespuesta(page, 'GET', '/organizations/requests/pending-count');
        const alertas = esperarRespuesta(page, 'GET', '/fraud-alerts/unseen-count');
        await page.reload();
        const cantidad = async (r) => ((await (await r).json()).count || 0);
        const esperados = {
            Notificaciones: await cantidad(sinLeer),
            'Solicitudes de alta': await cantidad(pendientes),
            'Alertas de fraude': await cantidad(alertas),
        };
        await abrirMenu(page);
        for (const [texto, n] of Object.entries(esperados)) {
            const enlace = opcion(page, texto);
            if (n > 0) await expect(enlace).toContainText(n > 99 ? '99+' : String(n));
            else await expect(enlace).not.toContainText(/\d/);
        }
        await context.close();
    });
});
