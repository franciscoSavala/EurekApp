// Solicitudes de alta de organizaciones: acceso, listado, detalle, aprobación y rechazo (T14).
const { test, expect } = require('@playwright/test');
const { USUARIOS, caso, nombreUnico, irAlMenu, abrirMenu } = require('./helpers');
const { registrarUsuario, loginConOrg, abrirComo, crearSolicitudApi, detalleApi, resolverApi, organizacionPorNombre, desactivarOrganizacion } = require('./helpers/t14');

const vis = (page, texto, opciones) => page.getByText(texto, opciones).locator('visible=true');

/** Abre Solicitudes de alta con el filtro indicado y espera la tarjeta de la organización. */
async function verTarjeta(page, filtro, nombre) {
    await page.goto('/');
    await irAlMenu(page, 'Solicitudes de alta');
    await expect(vis(page, 'Solicitudes de alta').first()).toBeVisible();
    await vis(page, filtro, { exact: true }).click();
    await expect(vis(page, nombre).first()).toBeVisible();
}

async function abrirDetalle(page, filtro, nombre) {
    await verTarjeta(page, filtro, nombre);
    await vis(page, nombre).first().click();
    await expect(vis(page, 'Responsable propuesto')).toBeVisible();
}

/** Número que muestra el dashboard junto a una etiqueta (la tarjeta trae valor y etiqueta). */
async function valorDe(page, etiqueta) {
    const texto = await vis(page, etiqueta, { exact: true }).first().locator('xpath=..').innerText();
    return Number(texto.replace(etiqueta, '').replace(/\D/g, ''));
}

/** Abre el dashboard y lee pendientes y organizaciones activas, junto con lo que responde el servidor. */
async function contadores(page, request, token) {
    await page.goto('/');
    await irAlMenu(page, 'Dashboard');
    await expect(vis(page, 'Organizaciones activas', { exact: true })).toBeVisible();
    const api = async () => {
        const r = await request.get('http://localhost:8080/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json();
        return { pendientes: j.orgRequestsPending, activas: j.activeOrgs };
    };
    let ui;
    // La pantalla y el servidor se comparan en el mismo momento; otras tandas pueden mover los números.
    await expect.poll(async () => {
        ui = { pendientes: await valorDe(page, 'Pendientes'), activas: await valorDe(page, 'Organizaciones activas') };
        const sv = await api();
        return ui.pendientes === sv.pendientes && ui.activas === sv.activas;
    }, { timeout: 30000 }).toBe(true);
    return ui;
}

/** Abre la pantalla de Notificaciones del usuario de la sesión. */
async function irANotificaciones(page) {
    await page.goto('/');
    await irAlMenu(page, 'Notificaciones');
}

test.describe('Solicitudes de alta de organizaciones', () => {
    test('casos 392 y 393: el administrador accede a Solicitudes de alta y un usuario común no ve la opción @admin @solicitudes @serie', async ({ browser }) => {
        const adm = await abrirComo(browser, USUARIOS.admin);
        await caso(392, 'el administrador entra a Solicitudes de alta desde el menú', async () => {
            await irAlMenu(adm.page, 'Solicitudes de alta');
            await expect(vis(adm.page, 'Solicitudes de alta').first()).toBeVisible();
            await expect(vis(adm.page, 'Pendientes', { exact: true })).toBeVisible();
        });
        await adm.context.close();

        const usr = await abrirComo(browser, USUARIOS.usuario);
        await caso(393, 'un usuario sin rol de administrador no ve Solicitudes de alta en el menú', async () => {
            await abrirMenu(usr.page);
            await expect(usr.page.getByText('Logout')).toBeVisible();
            await expect(usr.page.getByText('Solicitudes de alta', { exact: true })).toHaveCount(0);
        });
        await usr.context.close();
    });

    test('casos 394 a 400, 404, 406, 407, 409, 410 y 440: aprobar una solicitud crea la organización y avisa @admin @solicitudes @serie', async ({ browser, request }) => {
        test.setTimeout(300000);
        const nombre = nombreUnico('Club T14 Aprobada');
        const solicitante = await registrarUsuario(request, 'sol');
        const futuro = await registrarUsuario(request, 'dueno');
        const idSolicitud = await crearSolicitudApi(request, solicitante.token, {
            nombre, ownerEmail: futuro.email, ownerNombre: 'Futuro', ownerApellido: 'Dueno14',
        });
        const admin = await loginConOrg(request, USUARIOS.admin);
        const adm = await abrirComo(browser, USUARIOS.admin);
        const page = adm.page;
        let orgId;
        try {
            await caso(394, 'el listado de pendientes muestra la solicitud nueva', async () => {
                await verTarjeta(page, 'Pendientes', nombre);
                await expect(vis(page, 'Pendiente', { exact: true }).first()).toBeVisible();
            });

            await caso(395, 'se abre el detalle de la solicitud elegida', async () => {
                await vis(page, nombre).first().click();
                await expect(vis(page, 'Responsable propuesto')).toBeVisible();
                await expect(vis(page, nombre).first()).toBeVisible();
            });

            await caso(396, 'el detalle muestra nombre, tipo, dirección, ubicación, futuro dueño, motivo, solicitante, fecha y estado', async () => {
                const visible = (t) => expect.soft(vis(page, t).first(), `se muestra "${t}"`).toBeVisible();
                await visible(nombre);
                await visible('Club');
                await visible('Calle Falsa');
                await visible('Cordoba');
                await visible('Coordenadas');
                await visible(futuro.email);
                await visible('Dueno14');
                await visible(`Motivo de prueba ${nombre}`);
                await visible(solicitante.email);
                await visible('Fecha de solicitud');
                await visible('Pendiente de aprobación');
            });

            const antes = await contadores(page, request, admin.token);
            await page.goto('/');
            await abrirDetalle(page, 'Pendientes', nombre);

            await caso(397, 'aprobar la solicitud pendiente funciona', async () => {
                const resp = page.waitForResponse((r) => r.url().includes(`/requests/${idSolicitud}/resolve`) && r.request().method() === 'PUT');
                await vis(page, 'Aprobar', { exact: true }).click();
                expect((await resp).status()).toBe(200);
                await expect(page.getByText('Solicitud aprobada correctamente.')).toBeVisible();
            });

            await caso(440, 'el dashboard muestra una solicitud pendiente menos y una organización activa más', async () => {
                const despues = await contadores(page, request, admin.token);
                expect(despues.pendientes, 'solicitudes pendientes').toBeLessThan(antes.pendientes);
                expect(despues.activas, 'organizaciones activas').toBeGreaterThan(antes.activas);
            });

            await caso(398, 'el estado de la solicitud pasa a Aprobada', async () => {
                await abrirDetalle(page, 'Aprobadas', nombre);
                await expect(vis(page, 'Aprobada', { exact: true }).first()).toBeVisible();
                expect((await detalleApi(request, admin.token, idSolicitud)).cuerpo.status).toBe('APPROVED');
            });

            await caso(409, 'el detalle registra la fecha y hora de la revisión', async () => {
                await expect(vis(page, 'Fecha de resolución').first()).toBeVisible();
                const d = (await detalleApi(request, admin.token, idSolicitud)).cuerpo;
                expect(d.resolvedAt).toBeTruthy();
                expect(Math.abs(Date.now() - new Date(d.resolvedAt).getTime())).toBeLessThan(15 * 60 * 1000);
            });

            await caso(410, 'el detalle registra al administrador que revisó', async () => {
                await expect(vis(page, 'Revisado por').first()).toBeVisible();
                await expect(vis(page, USUARIOS.admin).first()).toBeVisible();
                expect((await detalleApi(request, admin.token, idSolicitud)).cuerpo.resolvedByEmail).toBe(USUARIOS.admin);
            });

            await caso(407, 'una solicitud ya aprobada no se puede aceptar de nuevo', async () => {
                await expect(vis(page, 'Aprobar', { exact: true })).toHaveCount(0);
                expect(await resolverApi(request, admin.token, idSolicitud, 'APPROVED')).toBe(400);
            });

            await caso(399, 'la organización queda creada en el sistema', async () => {
                const org = await organizacionPorNombre(request, admin.token, nombre);
                expect(org).toBeTruthy();
                orgId = org.id;
                await page.goto('/');
                await irAlMenu(page, 'Organizaciones');
                await expect(vis(page, nombre).first()).toBeVisible();
            });

            await caso(400, 'el futuro dueño figura como Responsable en el listado de usuarios', async () => {
                await page.goto('/');
                await irAlMenu(page, 'Usuarios');
                const tarjeta = page.locator('div').filter({ has: page.getByText(futuro.email, { exact: true }) }).filter({ hasText: 'Responsable' }).filter({ hasText: nombre }).locator('visible=true').last();
                // A veces la lista sin filtrar llega después y pisa la filtrada: se vuelve a elegir el filtro.
                for (let intento = 0; intento < 3; intento++) {
                    const filtrado = page.waitForResponse((r) => r.url().includes('/admin/users?role=ORGANIZATION_OWNER'));
                    await vis(page, intento ? 'Todos' : 'Responsables', { exact: true }).click();
                    if (intento) await vis(page, 'Responsables', { exact: true }).click();
                    await filtrado;
                    if (await tarjeta.isVisible().catch(() => false)) break;
                    await page.waitForTimeout(3000);
                    if (await tarjeta.isVisible().catch(() => false)) break;
                }
                await expect(tarjeta).toBeVisible();
            });
        } catch (e) {
            // Si falló antes de los avisos, igual se desactiva la organización nueva.
            orgId = orgId || (await organizacionPorNombre(request, admin.token, nombre))?.id;
            if (orgId) await desactivarOrganizacion(request, admin.token, orgId);
            throw e;
        } finally {
            await adm.context.close();
        }
        try {
        const sol = await abrirComo(browser, solicitante.email);
        await caso(404, 'el solicitante recibe una notificación de aprobación en la app', async () => {
            await irANotificaciones(sol.page);
            await expect(vis(sol.page, 'Tu solicitud fue aprobada').first()).toBeVisible();
            await expect(vis(sol.page, nombre).first()).toBeVisible();
        });
        await sol.context.close();

        const dueno = await abrirComo(browser, futuro.email);
        await caso(406, 'el futuro dueño recibe una notificación de que es dueño de la organización', async () => {
            await irANotificaciones(dueno.page);
            await expect(vis(dueno.page, 'Sos responsable de una nueva organización').first()).toBeVisible();
            await expect(vis(dueno.page, nombre).first()).toBeVisible();
        });
        await dueno.context.close();
        } finally {
            // La organización nueva no debe quedar operando.
            if (!orgId) orgId = (await organizacionPorNombre(request, admin.token, nombre))?.id;
            if (orgId) await desactivarOrganizacion(request, admin.token, orgId);
        }
    });

    test('casos 401, 402, 403, 405, 408, 409 y 410: rechazar exige motivo, avisa y no se repite @admin @solicitudes @serie', async ({ browser, request }) => {
        test.setTimeout(300000);
        const nombre = nombreUnico('Club T14 Rechazada');
        const solicitante = await registrarUsuario(request, 'rech');
        const idSolicitud = await crearSolicitudApi(request, solicitante.token, {
            nombre, ownerEmail: `t14.sincuenta.${Date.now().toString(36)}@eurekapp.com`,
        });
        const admin = await loginConOrg(request, USUARIOS.admin);
        const adm = await abrirComo(browser, USUARIOS.admin);
        const page = adm.page;
        const motivo = 'No cumple los requisitos de la prueba';
        try {
            await abrirDetalle(page, 'Pendientes', nombre);

            await caso(402, 'rechazar sin motivo no se permite y pide ingresar el motivo', async () => {
                let enviado = false;
                page.on('request', (r) => { if (r.method() === 'PUT' && r.url().includes('/resolve')) enviado = true; });
                await vis(page, 'Rechazar', { exact: true }).click();
                await expect(page.getByText('Debés ingresar un motivo para rechazar.')).toBeVisible();
                expect(enviado).toBe(false);
                expect((await detalleApi(request, admin.token, idSolicitud)).cuerpo.status).toBe('PENDING_APPROVAL');
                expect(await resolverApi(request, admin.token, idSolicitud, 'REJECTED', '  ')).toBe(400);
            });

            await caso(401, 'rechazar con motivo funciona', async () => {
                await page.getByPlaceholder('Escribe una nota para el solicitante...').locator('visible=true').fill(motivo);
                const resp = page.waitForResponse((r) => r.url().includes(`/requests/${idSolicitud}/resolve`) && r.request().method() === 'PUT');
                await vis(page, 'Rechazar', { exact: true }).click();
                expect((await resp).status()).toBe(200);
                await expect(page.getByText('Solicitud rechazada.')).toBeVisible();
            });

            await caso(403, 'el estado de la solicitud pasa a Rechazada', async () => {
                await abrirDetalle(page, 'Rechazadas', nombre);
                await expect(vis(page, 'Rechazada', { exact: true }).first()).toBeVisible();
                await expect(vis(page, motivo).first()).toBeVisible();
                expect((await detalleApi(request, admin.token, idSolicitud)).cuerpo.status).toBe('REJECTED');
            });

            await caso(409, 'la solicitud rechazada registra fecha y hora de revisión', async () => {
                await expect(vis(page, 'Fecha de resolución').first()).toBeVisible();
                expect((await detalleApi(request, admin.token, idSolicitud)).cuerpo.resolvedAt).toBeTruthy();
            });

            await caso(410, 'la solicitud rechazada registra al administrador que revisó', async () => {
                await expect(vis(page, 'Revisado por').first()).toBeVisible();
                await expect(vis(page, USUARIOS.admin).first()).toBeVisible();
            });

            await caso(408, 'una solicitud ya rechazada no se puede rechazar de nuevo', async () => {
                await expect(vis(page, 'Rechazar', { exact: true })).toHaveCount(0);
                expect(await resolverApi(request, admin.token, idSolicitud, 'REJECTED', motivo)).toBe(400);
            });
        } finally {
            await adm.context.close();
        }

        const sol = await abrirComo(browser, solicitante.email);
        await caso(405, 'el solicitante recibe una notificación de rechazo en la app', async () => {
            await irANotificaciones(sol.page);
            await expect(vis(sol.page, 'Tu solicitud fue rechazada').first()).toBeVisible();
            await expect(vis(sol.page, motivo).first()).toBeVisible();
        });
        await sol.context.close();
    });
});
