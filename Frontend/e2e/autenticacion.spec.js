const { test, expect } = require('@playwright/test');
const { USUARIOS, abrirComoUsuario, irAlMenu, abrirBusqueda, vigilarPedidos, esperarRespuesta, bajarHastaVer, nombreUnico } = require('./helpers');
const sesion = require('./helpers/sesion');
const T = require('./helpers/t12');

/*
 * Cada pantalla que habla con el servidor tiene que presentarse con la sesión de la persona.
 * Estos tests recorren las pantallas de avisos, administración, solicitudes de organización y
 * opiniones, comprueban que muestren datos reales del seed y que ningún pedido salga sin
 * credencial ni sea rechazado por sesión inválida.
 */
test.describe('Pantallas que consultan al servidor con la sesión iniciada', () => {
    test('el menú del administrador consulta sus contadores (avisos, solicitudes y alertas) con la sesión @admin @paralelo', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        const vigilante = vigilarPedidos(page);
        const sinLeer = esperarRespuesta(page, 'GET', '/notifications/unread-count');
        const pendientes = esperarRespuesta(page, 'GET', '/organizations/requests/pending-count');
        const alertas = esperarRespuesta(page, 'GET', '/fraud-alerts/unseen-count');
        await page.reload();
        expect((await sinLeer).status()).toBe(200);
        expect((await pendientes).status()).toBe(200);
        expect((await alertas).status()).toBe(200);
        await expect(page.getByText('Logout')).toBeVisible();
        vigilante.verificar();
        await context.close();
    });

    test('el administrador ve el dashboard con los totales de la plataforma @admin @paralelo', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        const vigilante = vigilarPedidos(page);
        await irAlMenu(page, 'Dashboard');
        await expect(page.getByText('Pendientes', { exact: true })).toBeVisible();
        await expect(page.getByText('Aprobadas', { exact: true })).toBeVisible();
        await expect(page.getByText('Rechazadas', { exact: true })).toBeVisible();
        vigilante.verificar();
        await context.close();
    });

    test('el administrador ve el listado de usuarios del seed @admin @paralelo', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        const vigilante = vigilarPedidos(page);
        await irAlMenu(page, 'Usuarios');
        await expect(page.getByText('julia@mail.com', { exact: true })).toBeVisible();
        await expect(page.getByText('Julia Morales')).toBeVisible();
        vigilante.verificar();
        await context.close();
    });

    test('el administrador desactiva y vuelve a activar a un usuario @admin @serie', async ({ browser, request }) => {
        test.setTimeout(240_000);
        // Usuario nuevo de la corrida: así no se toca a ninguna cuenta que el carril paralelo necesite activa.
        const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
        const email = `t16.des.${id}@mail.com`;
        await sesion.registrarUsuario(request, { firstname: 'Prueba', lastname: `T16des${id}`, username: email });
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        const vigilante = vigilarPedidos(page);
        await irAlMenu(page, 'Usuarios');
        // El filtro "Usuarios" deja solo a las personas sin organización; el texto se repite en el título y en el menú.
        await page.getByText('Usuarios', { exact: true }).nth(1).click();
        await bajarHastaVer(page, email);
        const tarjeta = page.locator('div').filter({ has: page.getByText(email, { exact: true }) }).filter({ hasText: /Desactivar|Activar/ }).last();
        await expect(tarjeta).toBeVisible();

        await tarjeta.getByText('Desactivar', { exact: true }).click();
        const desactivado = esperarRespuesta(page, 'PUT', '/admin/users');
        await page.getByText('Desactivar', { exact: true }).last().click();
        expect((await desactivado).status()).toBeLessThan(300);

        await bajarHastaVer(page, email);
        await tarjeta.getByText('Activar', { exact: true }).click();
        const activado = esperarRespuesta(page, 'PUT', '/admin/users');
        await page.getByText('Activar', { exact: true }).last().click();
        expect((await activado).status()).toBeLessThan(300);
        vigilante.verificar();
        await context.close();
    });

    test('el administrador ve el listado de organizaciones del seed @admin @paralelo', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        const vigilante = vigilarPedidos(page);
        await irAlMenu(page, 'Organizaciones');
        await expect(page.getByText('UTN FRC', { exact: true })).toBeVisible();
        await expect(page.getByText('Dinosaurio Mall', { exact: true })).toBeVisible();
        vigilante.verificar();
        await context.close();
    });

    test('el administrador desactiva y vuelve a activar una organización @admin @serie', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        const vigilante = vigilarPedidos(page);
        await irAlMenu(page, 'Organizaciones');
        await bajarHastaVer(page, 'Terminal de Omnibus Cordoba');
        const tarjeta = page.locator('div').filter({ has: page.getByText('Terminal de Omnibus Cordoba', { exact: true }) }).filter({ hasText: /Desactivar|Activar/ }).last();
        await expect(tarjeta).toBeVisible();

        await tarjeta.getByText('Desactivar', { exact: true }).click();
        const desactivada = esperarRespuesta(page, 'PUT', '/admin/organizations');
        await page.getByText('Desactivar', { exact: true }).last().click();
        expect((await desactivada).status()).toBeLessThan(300);

        await bajarHastaVer(page, 'Terminal de Omnibus Cordoba');
        await tarjeta.getByText('Activar', { exact: true }).click();
        const activada = esperarRespuesta(page, 'PUT', '/admin/organizations');
        await page.getByText('Activar', { exact: true }).last().click();
        expect((await activada).status()).toBeLessThan(300);
        vigilante.verificar();
        await context.close();
    });

    test('el administrador ve la configuración de fraude del seed y puede guardarla sin cambios @admin @serie', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        const vigilante = vigilarPedidos(page);
        await irAlMenu(page, 'Configuración de fraude');
        await expect(page.getByText('Ventana de detección (días)')).toBeVisible();
        await expect(page.locator('input[value="90"]')).toBeVisible();
        await expect(page.locator('input[value="30"]')).toBeVisible();

        const guardado = esperarRespuesta(page, 'PUT', '/admin/fraud/config');
        await page.getByText('Guardar cambios', { exact: true }).click();
        expect((await guardado).status()).toBe(200);
        vigilante.verificar();
        await context.close();
    });

    test('el administrador ve las solicitudes de alta y abre el detalle de una @admin @paralelo', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        const vigilante = vigilarPedidos(page);
        await irAlMenu(page, 'Solicitudes de alta');
        await expect(page.getByText('Club Atletico Belgrano')).toBeVisible();
        await page.getByText('Ver detalle', { exact: true }).first().click();
        await expect(page.getByText('Responsable propuesto')).toBeVisible();
        vigilante.verificar();
        await context.close();
    });

    test('el administrador ve el reporte de opiniones sobre la app @admin @paralelo', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        const vigilante = vigilarPedidos(page);
        await irAlMenu(page, 'Opiniones sobre la app');
        await expect(page.getByText('Total de feedbacks')).toBeVisible();
        vigilante.verificar();
        await context.close();
    });

    test('la usuaria ve sus avisos y entrar a la sección los registra como vistos @usuario @serie', async ({ browser, request }) => {
        test.setTimeout(240_000);
        // El aviso lo genera este mismo test: la usuaria guarda una búsqueda y un empleado recepta algo parecido.
        const token = await sesion.tokenDe(USUARIOS.usuario);
        const emp = await sesion.sesionDe(USUARIOS.empleado);
        const descripcion = nombreUnico('billetera negra aviso');
        await T.guardarBusqueda(request, token, descripcion, emp.orgId);
        await T.receptarConFinder(request, emp.token, emp.orgId, descripcion);
        await T.esperarNotificacion(request, token, 'MATCH_FOUND');

        const { context, page } = await abrirComoUsuario(browser, USUARIOS.usuario);
        const vigilante = vigilarPedidos(page);
        const lista = esperarRespuesta(page, 'GET', '/notifications');
        const vistos = esperarRespuesta(page, 'POST', '/notifications/read-all');
        await irAlMenu(page, 'Notificaciones');
        expect((await lista).status()).toBe(200);
        await expect(page.getByText('Alguien podría haber encontrado tu objeto').first()).toBeVisible();
        expect((await vistos).status()).toBe(200);
        vigilante.verificar();
        await context.close();
    });

    test('la usuaria ve su solicitud de organización pendiente @usuario @serie', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.usuario);
        const vigilante = vigilarPedidos(page);
        await irAlMenu(page, 'Mi solicitud de organización');
        await expect(page.getByText('Club Atletico Belgrano')).toBeVisible();
        await expect(page.getByText('Pendiente de aprobación')).toBeVisible();
        vigilante.verificar();
        await context.close();
    });

    test('la usuaria califica una búsqueda sin resultados y el servidor lo registra @usuario @serie', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.usuario);
        const vigilante = vigilarPedidos(page);
        await abrirBusqueda(page, 'Aeropuerto Internacional Cordoba');
        await page.getByPlaceholder('Proporciona detalles que ayuden a identificarlo').fill('billetera');
        await page.getByText('Buscar objeto', { exact: true }).click();
        await expect(page.getByText('No se encontraron coincidencias para tu búsqueda.')).toBeVisible();

        await page.getByText('¿Qué tan útil fue la búsqueda?').locator('xpath=following-sibling::*[1]').locator('xpath=./*').nth(3).click();
        const calificacion = esperarRespuesta(page, 'POST', '/feedback');
        await page.getByText('Enviar calificación', { exact: true }).click();
        expect((await calificacion).status()).toBeLessThan(300);
        await expect(page.getByText('¡Gracias por tu calificación!')).toBeVisible();
        vigilante.verificar();
        await context.close();
    });

    test('la usuaria envía su opinión de usabilidad de la app desde el perfil y el servidor la registra @usuario @serie', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.usuario);
        const vigilante = vigilarPedidos(page);
        await irAlMenu(page, 'Mi perfil');
        await page.getByText('Dar feedback de usabilidad de la app', { exact: true }).click();
        await expect(page.getByText('¿Cómo fue tu experiencia?')).toBeVisible();
        await page.getByText('Tu opinión nos ayuda a mejorar la aplicación.').locator('xpath=following-sibling::*[1]').locator('xpath=./*').nth(4).click();
        const registro = esperarRespuesta(page, 'POST', '/usability-feedback');
        await page.getByText('Enviar', { exact: true }).click();
        expect((await registro).status()).toBeLessThan(300);
        await expect(page.getByText('¡Gracias por tu retroalimentación!')).toBeVisible();
        vigilante.verificar();
        await context.close();
    });
});
