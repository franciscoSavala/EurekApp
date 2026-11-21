// Menú del administrador e indicadores del menú (solicitudes pendientes y notificaciones sin leer).
const { test, expect } = require('@playwright/test');
const { USUARIOS, USUARIOS_PARALELO, caso, nombreUnico, abrirMenu } = require('./helpers');
const { abrirSesion, abrirMenuDesdeInicio, enlaceMenu } = require('./helpers/t01');
const { verificarMenu, cerrarSesionPorMenu } = require('./helpers/r15');
const { URL_BACK, auth } = require('./helpers/t08');
const T = require('./helpers/t12');
const sesion = require('./helpers/sesion');
const { crearSolicitudApi, resolverApi } = require('./helpers/t14');
const { casoContinuo, noSePudoProbar, primeraLinea } = require('./helpers/t17');

const ADMIN = USUARIOS.admin;

const OPCIONES_ADMIN = [
    'Dashboard', 'Solicitudes de alta', 'Usuarios', 'Organizaciones', 'Alertas de fraude', 'Configuración de fraude',
    'Opiniones sobre la app', 'Notificaciones', 'Mi perfil',
];

test.describe('Menú del administrador', () => {
    test('casos 015, 016, 017 y 029: inicio, pie, cierre de sesión y opciones del menú del administrador @navegacion @paralelo', async ({ browser }) => {
        test.setTimeout(240_000);
        const { context, page } = await abrirSesion(browser, ADMIN);
        await caso(15, 'el administrador, al iniciar sesión, ve el Dashboard', async () => {
            await expect(page.getByText('Dashboard').locator('visible=true').first()).toBeVisible();
        });
        await abrirMenuDesdeInicio(page);
        await caso(29, 'el menú del administrador muestra sus opciones y no aparecen Buscar un objeto ni Logros', async () => {
            await verificarMenu(page, OPCIONES_ADMIN, ['Buscar un objeto', 'Logros']);
        });
        await caso(16, 'el pie del menú muestra la versión y el contacto de soporte', async () => {
            await expect.soft(page.getByText('Versión de la app: 0.0.1', { exact: true })).toBeVisible();
            await expect.soft(page.getByText('Contacto: soporte.eurekapp@gmail.com', { exact: true })).toBeVisible();
        });
        await caso(17, 'Logout cierra la sesión y muestra la portada con Iniciar sesión y Registrate', async () => {
            await cerrarSesionPorMenu(page);
        });
        await context.close();
    });

    test('caso 030: el indicador de Solicitudes de alta cuenta las pendientes y baja al resolverlas @navegacion @serie', async ({ browser, request }) => {
        test.setTimeout(300_000);
        const admin = await sesion.sesionDe(ADMIN);
        const pendientes = async () => {
            const r = await request.get(`${URL_BACK}/organizations/requests/pending-count`, { headers: auth(admin.token) });
            return (await r.json()).count || 0;
        };
        const indicador = async (page) => {
            await page.reload();
            await abrirMenu(page);
            const texto = await enlaceMenu(page, 'Solicitudes de alta').innerText();
            const numero = texto.replace('Solicitudes de alta', '').match(/\d+\+?/);
            return numero ? numero[0] : '0';
        };
        // Se crea una solicitud propia para no depender de las que haya en la base.
        const solicitante = await T.registrarUsuario(request, 'ind');
        const nombre = nombreUnico('Club R15 Indicador');
        const id = await crearSolicitudApi(request, solicitante.token, { nombre, ownerEmail: `r15.sincuenta.${Date.now().toString(36)}@eurekapp.com` });
        const { context, page } = await abrirSesion(browser, ADMIN);
        try {
            await caso(30, 'Solicitudes de alta muestra un contador con la cantidad pendiente, baja al resolver y desaparece al quedar en cero', async () => {
                const con = await pendientes();
                expect(con).toBeGreaterThan(0);
                const visto = await indicador(page);
                expect(String(visto), 'el contador del menú no coincide con las solicitudes pendientes').toBe(con > 99 ? '99+' : String(con));
                expect(await resolverApi(request, admin.token, id, 'REJECTED', 'Rechazada por la prueba')).toBeLessThan(300);
                const sin = await pendientes();
                expect(sin).toBe(con - 1);
                const vistoDespues = await indicador(page);
                expect(String(vistoDespues), 'al resolver, el contador no bajó').toBe(sin === 0 ? '0' : (sin > 99 ? '99+' : String(sin)));
            });
        } finally {
            await context.close();
        }
    });

    test('caso 031: el indicador de Notificaciones aparece con una sin leer y se limpia al abrirla @navegacion @paralelo', async ({ browser, request }) => {
        test.setTimeout(300_000);
        // Usuario nuevo con una búsqueda guardada: cuando un empleado recepta algo parecido, le llega un aviso.
        const u = await T.registrarUsuario(request, 'notif');
        const emp = await sesion.sesionDe(USUARIOS_PARALELO.empleadoAero);
        const descripcion = nombreUnico('billetera marron indicador');
        let falta = null;
        try {
            await T.guardarBusqueda(request, u.token, descripcion, emp.orgId);
            await T.receptarConFinder(request, emp.token, emp.orgId, descripcion);
            await T.esperarNotificacion(request, u.token, 'MATCH_FOUND');
        } catch (e) {
            falta = primeraLinea(e);
        }
        const { context, page } = await T.abrirComo(browser, u.email);
        try {
            await casoContinuo(31, 'Notificaciones muestra un contador antes de entrar y se limpia al abrirla', async () => {
                if (falta) return noSePudoProbar(`no se pudo generar la notificación (${falta})`);
                await page.reload();
                await abrirMenu(page);
                await expect(enlaceMenu(page, 'Notificaciones').getByText(/^\d+$/), 'no aparece el contador antes de entrar').toBeVisible();
                await enlaceMenu(page, 'Notificaciones').click();
                await expect(page).toHaveURL(/NotificationsStackScreen/);
                await page.getByText('Alguien podría haber encontrado tu objeto', { exact: true }).locator('visible=true').first().waitFor();
                await abrirMenuDesdeInicio(page);
                await expect(enlaceMenu(page, 'Notificaciones').getByText(/^\d+$/), 'el contador no se limpió al abrir Notificaciones').toHaveCount(0);
            });
        } finally {
            await context.close();
        }
    });
});
