// Solicitudes de alta de organizaciones: acceso, listado, detalle, aprobación y rechazo (T14).
const { test, expect } = require('@playwright/test');
const { USUARIOS, caso, nombreUnico, irAlMenu, abrirMenu } = require('./helpers');
const { registrarUsuario, loginConOrg, abrirComo, crearSolicitudApi, detalleApi, resolverApi, organizacionPorNombre, desactivarOrganizacion } = require('./helpers/t14');
const { casoContinuo } = require('./helpers/t17');
const { esperarCorreo, contarCorreos, enviarSolicitudPorFormulario } = require('./helpers/r12');

const vis = (page, texto, opciones) => page.getByText(texto, opciones).locator('visible=true');

/** Abre Solicitudes de alta con el filtro indicado y espera la tarjeta de la organización. */
async function verTarjeta(page, filtro, nombre) {
    await page.goto('/');
    await irAlMenu(page, 'Solicitudes de alta');
    await expect(vis(page, 'Solicitudes de alta').first()).toBeVisible();
    await vis(page, filtro, { exact: true }).click();
    await expect(vis(page, nombre).first()).toBeVisible();
}

/** Abre el detalle de la solicitud con el botón "Ver detalle" de su tarjeta. */
async function abrirDetalle(page, filtro, nombre) {
    await verTarjeta(page, filtro, nombre);
    const tarjeta = page.locator('div').filter({ has: page.getByText(nombre) }).filter({ hasText: 'Ver detalle' }).locator('visible=true').last();
    await tarjeta.getByText('Ver detalle', { exact: true }).click();
    await expect(vis(page, 'Responsable propuesto')).toBeVisible();
}

/** Número que muestra el menú junto a "Solicitudes de alta" (0 si no hay indicador). */
async function indicadorDelMenu(page) {
    await abrirMenu(page);
    const texto = await page.locator('a', { has: page.getByText('Solicitudes de alta', { exact: true }) }).innerText();
    const n = texto.replace('Solicitudes de alta', '').replace(/\D/g, '');
    return n ? Number(n) : 0;
}

/** Solicitudes pendientes según el servidor. */
async function pendientesApi(request, token) {
    const r = await request.get(`${URL_BACK}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
    return (await r.json()).orgRequestsPending;
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
        const r = await request.get(`${URL_BACK}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
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


const ASUNTO_ADMIN = 'EurekApp — Nueva solicitud de registro de organización';
const URL_BACK = process.env.E2E_BACK_URL || 'http://localhost:8080';

test.describe('Solicitudes de alta de organizaciones', () => {
    test('casos 269 y 270: el administrador accede a Solicitudes de alta y un usuario común no ve la opción @admin @solicitudes @serie', async ({ browser }) => {
        const adm = await abrirComo(browser, USUARIOS.admin);
        await caso(269, 'el administrador entra a Solicitudes de alta desde el menú', async () => {
            await irAlMenu(adm.page, 'Solicitudes de alta');
            await expect(vis(adm.page, 'Solicitudes de alta').first()).toBeVisible();
            await expect(vis(adm.page, 'Pendientes', { exact: true })).toBeVisible();
        });
        await adm.context.close();

        const usr = await abrirComo(browser, USUARIOS.usuario);
        await caso(270, 'un usuario sin rol de administrador no ve Solicitudes de alta en el menú', async () => {
            await abrirMenu(usr.page);
            await expect(usr.page.getByText('Logout')).toBeVisible();
            await expect(usr.page.getByText('Solicitudes de alta', { exact: true })).toHaveCount(0);
        });
        await usr.context.close();
    });

    test('casos 271 a 275, 278, 280, 281, 282, 284 y 314: aprobar una solicitud crea la organización y avisa @admin @solicitudes @serie', async ({ browser, request }) => {
        test.setTimeout(300000);
        const nombre = nombreUnico('Club R12 Aprobada');
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
            await caso(271, 'el listado de pendientes muestra la solicitud nueva', async () => {
                await verTarjeta(page, 'Pendientes', nombre);
                await expect(vis(page, 'Pendiente', { exact: true }).first()).toBeVisible();
            });

            await caso(284, 'junto a Solicitudes de alta aparece el número de pendientes', async () => {
                expect(await pendientesApi(request, admin.token)).toBeGreaterThan(0);
                await expect.poll(async () => {
                    await page.goto('/');
                    return indicadorDelMenu(page);
                }, { timeout: 40000 }).toBe(await pendientesApi(request, admin.token));
            });

            await caso(272, 'el detalle muestra estado, solicitante, organización, dirección, responsable propuesto, motivo y fecha de creación', async () => {
                await abrirDetalle(page, 'Pendientes', nombre);
                const visible = (t, o) => expect.soft(vis(page, t, o).first(), `se muestra "${t}"`).toBeVisible();
                await visible('Pendiente de aprobación');
                await visible('Solicitante', { exact: true });
                await visible(solicitante.email);
                await visible('Fecha de solicitud');
                await visible('Organización', { exact: true });
                await visible(nombre);
                await visible('Club');
                await visible('Dirección', { exact: true });
                await visible('Calle Falsa');
                await visible('Cordoba');
                await visible('Responsable propuesto', { exact: true });
                await visible(futuro.email);
                await visible('Dueno14');
                await visible('Motivo de la solicitud', { exact: true });
                await visible(`Motivo de prueba ${nombre}`);
            });

            const antes = await contadores(page, request, admin.token);
            await page.goto('/');
            await abrirDetalle(page, 'Pendientes', nombre);

            await caso(273, 'aprobar la solicitud pendiente, sin confirmación, la deja como Aprobada', async () => {
                const resp = page.waitForResponse((r) => r.url().includes(`/requests/${idSolicitud}/resolve`) && r.request().method() === 'PUT');
                await vis(page, 'Aprobar', { exact: true }).click();
                expect((await resp).status()).toBe(200);
                await expect(page.getByText('Solicitud aprobada correctamente.')).toBeVisible();
                await abrirDetalle(page, 'Aprobadas', nombre);
                await expect(vis(page, 'Aprobada', { exact: true }).first()).toBeVisible();
                expect((await detalleApi(request, admin.token, idSolicitud)).cuerpo.status).toBe('APPROVED');
            });

            await caso(284, 'el número de pendientes baja al resolver la solicitud', async () => {
                await expect.poll(async () => {
                    await page.goto('/');
                    return indicadorDelMenu(page);
                }, { timeout: 40000 }).toBe(await pendientesApi(request, admin.token));
            });

            await caso(314, 'el dashboard muestra una solicitud pendiente menos y una organización activa más', async () => {
                const despues = await contadores(page, request, admin.token);
                expect(despues.pendientes, 'solicitudes pendientes').toBeLessThan(antes.pendientes);
                expect(despues.activas, 'organizaciones activas').toBeGreaterThan(antes.activas);
            });

            await caso(282, 'la solicitud aprobada muestra fecha y hora de resolución y quién revisó', async () => {
                await abrirDetalle(page, 'Aprobadas', nombre);
                await expect(vis(page, 'Resolución', { exact: true }).first()).toBeVisible();
                await expect(vis(page, 'Fecha de resolución').first()).toBeVisible();
                await expect(vis(page, 'Revisado por').first()).toBeVisible();
                await expect(vis(page, USUARIOS.admin).first()).toBeVisible();
                const d = (await detalleApi(request, admin.token, idSolicitud)).cuerpo;
                expect(d.resolvedAt).toBeTruthy();
                expect(Math.abs(Date.now() - new Date(d.resolvedAt).getTime())).toBeLessThan(15 * 60 * 1000);
                expect(d.resolvedByEmail).toBe(USUARIOS.admin);
            });

            await caso(281, 'una solicitud ya aprobada no tiene botones de resolución y el servidor rechaza resolverla de nuevo', async () => {
                await expect(vis(page, 'Aprobar', { exact: true })).toHaveCount(0);
                await expect(vis(page, 'Rechazar', { exact: true })).toHaveCount(0);
                const r = await request.put(`${URL_BACK}/organizations/requests/${idSolicitud}/resolve`, {
                    headers: { Authorization: `Bearer ${admin.token}` }, data: { resolution: 'APPROVED', adminNote: null },
                });
                expect(r.status()).toBe(400);
                expect(await r.text()).toContain('La solicitud ya fue procesada.');
            });

            await caso(274, 'la organización nueva figura Activa con el tipo y la ciudad de la solicitud', async () => {
                const org = await organizacionPorNombre(request, admin.token, nombre);
                expect(org).toBeTruthy();
                orgId = org.id;
                await page.goto('/');
                await irAlMenu(page, 'Organizaciones');
                const tarjeta = page.locator('div').filter({ has: page.getByText(nombre) }).filter({ hasText: 'Desactivar' }).locator('visible=true').last();
                await expect(tarjeta).toBeVisible();
                await expect(tarjeta).toContainText('Activa');
                await expect(tarjeta).toContainText('Club');
                await expect(tarjeta).toContainText('Cordoba');
            });

            await caso(275, 'el futuro dueño figura como Responsable con la organización nueva en Usuarios', async () => {
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
            await caso(278, 'el solicitante recibe una notificación de aprobación en la app', async () => {
                await irANotificaciones(sol.page);
                await expect(vis(sol.page, 'Tu solicitud fue aprobada').first()).toBeVisible();
                await expect(vis(sol.page, nombre).first()).toBeVisible();
            });
            await sol.context.close();

            const dueno = await abrirComo(browser, futuro.email);
            await caso(280, 'el futuro dueño recibe una notificación de que es dueño de la organización', async () => {
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

    test('casos 276, 277, 279, 281 y 282: rechazar exige motivo, avisa y no se repite @admin @solicitudes @serie', async ({ browser, request }) => {
        test.setTimeout(300000);
        const nombre = nombreUnico('Club R12 Rechazada');
        const solicitante = await registrarUsuario(request, 'rech');
        const idSolicitud = await crearSolicitudApi(request, solicitante.token, {
            nombre, ownerEmail: `r12.sincuenta.${Date.now().toString(36)}@eurekapp.com`,
        });
        const admin = await loginConOrg(request, USUARIOS.admin);
        const adm = await abrirComo(browser, USUARIOS.admin);
        const page = adm.page;
        const motivo = 'No cumple los requisitos de la prueba';
        try {
            await abrirDetalle(page, 'Pendientes', nombre);

            await caso(277, 'rechazar sin motivo no se permite, pide el motivo y la solicitud sigue Pendiente', async () => {
                let enviado = false;
                page.on('request', (r) => { if (r.method() === 'PUT' && r.url().includes('/resolve')) enviado = true; });
                await vis(page, 'Rechazar', { exact: true }).click();
                await expect(page.getByText('Debés ingresar un motivo para rechazar.')).toBeVisible();
                expect(enviado).toBe(false);
                await expect(vis(page, 'Pendiente de aprobación').first()).toBeVisible();
                expect((await detalleApi(request, admin.token, idSolicitud)).cuerpo.status).toBe('PENDING_APPROVAL');
                expect(await resolverApi(request, admin.token, idSolicitud, 'REJECTED', '  ')).toBe(400);
            });

            await caso(276, 'rechazar con motivo, sin confirmación, deja la solicitud Rechazada con la nota', async () => {
                await page.getByPlaceholder('Escribe una nota para el solicitante...').locator('visible=true').fill(motivo);
                const resp = page.waitForResponse((r) => r.url().includes(`/requests/${idSolicitud}/resolve`) && r.request().method() === 'PUT');
                await vis(page, 'Rechazar', { exact: true }).click();
                expect((await resp).status()).toBe(200);
                await expect(page.getByText('Solicitud rechazada.')).toBeVisible();
                await abrirDetalle(page, 'Rechazadas', nombre);
                await expect(vis(page, 'Rechazada', { exact: true }).first()).toBeVisible();
                await expect(vis(page, motivo).first()).toBeVisible();
                expect((await detalleApi(request, admin.token, idSolicitud)).cuerpo.status).toBe('REJECTED');
            });

            await caso(282, 'la solicitud rechazada muestra fecha y hora de resolución, quién revisó y la nota', async () => {
                await expect(vis(page, 'Resolución', { exact: true }).first()).toBeVisible();
                await expect(vis(page, 'Fecha de resolución').first()).toBeVisible();
                await expect(vis(page, 'Revisado por').first()).toBeVisible();
                await expect(vis(page, USUARIOS.admin).first()).toBeVisible();
                await expect(vis(page, 'Nota del administrador').first()).toBeVisible();
                await expect(vis(page, motivo).first()).toBeVisible();
                expect((await detalleApi(request, admin.token, idSolicitud)).cuerpo.resolvedAt).toBeTruthy();
            });

            await caso(281, 'una solicitud ya rechazada no tiene botones de resolución y el servidor rechaza resolverla de nuevo', async () => {
                await expect(vis(page, 'Aprobar', { exact: true })).toHaveCount(0);
                await expect(vis(page, 'Rechazar', { exact: true })).toHaveCount(0);
                const r = await request.put(`${URL_BACK}/organizations/requests/${idSolicitud}/resolve`, {
                    headers: { Authorization: `Bearer ${admin.token}` }, data: { resolution: 'REJECTED', adminNote: motivo },
                });
                expect(r.status()).toBe(400);
                expect(await r.text()).toContain('La solicitud ya fue procesada.');
            });
        } finally {
            await adm.context.close();
        }

        const sol = await abrirComo(browser, solicitante.email);
        await caso(279, 'el solicitante recibe una notificación de rechazo en la app', async () => {
            await irANotificaciones(sol.page);
            await expect(vis(sol.page, 'Tu solicitud fue rechazada').first()).toBeVisible();
            await expect(vis(sol.page, motivo).first()).toBeVisible();
        });
        await sol.context.close();
    });

    test('casos 283, 318, 319, 320 y 321: registrar una solicitud avisa al administrador por notificación y por correo @admin @solicitudes @serie', async ({ browser, request }) => {
        test.setTimeout(300000);
        const nombre = nombreUnico('Club R12 Formulario');
        const nombre2 = nombreUnico('Club R12 Segunda');
        const u1 = await registrarUsuario(request, 'form');
        const u2 = await registrarUsuario(request, 'form2');
        const admin = await loginConOrg(request, USUARIOS.admin);
        const emailDueno = `r12.form.${Date.now().toString(36)}@eurekapp.com`;
        try {
            const usr = await abrirComo(browser, u1.email);
            await caso(283, 'el usuario completa el formulario, ve su solicitud Pendiente y el administrador recibe notificación', async () => {
                await usr.page.goto('/');
                await irAlMenu(usr.page, 'Solicitar alta de organización');
                await enviarSolicitudPorFormulario(usr.page, {
                    nombre, ownerNombre: 'Futuro', ownerApellido: 'Formulario', ownerEmail: emailDueno, motivo: `Motivo ${nombre}`,
                });
                await usr.page.goto('/');
                await irAlMenu(usr.page, 'Mi solicitud de organización');
                await expect(vis(usr.page, nombre).first()).toBeVisible();
                await expect(vis(usr.page, 'Pendiente de aprobación').first()).toBeVisible();
                // La notificación del administrador se lee por el servidor; el correo se verifica en los casos siguientes.
                await expect.poll(async () => {
                    const r = await request.get(`${URL_BACK}/notifications`, { headers: { Authorization: `Bearer ${admin.token}` } });
                    return JSON.stringify(await r.json()).includes(nombre);
                }, { timeout: 20000 }).toBe(true);
            });
            await usr.context.close();

            await crearSolicitudApi(request, u2.token, { nombre: nombre2, ownerEmail: `r12.seg.${Date.now().toString(36)}@eurekapp.com` });

            let correo;
            await caso(318, 'el administrador recibe un correo por la nueva solicitud', async () => {
                correo = await esperarCorreo(request, { para: USUARIOS.admin, asunto: ASUNTO_ADMIN, contiene: nombre });
                expect(correo.asunto).toBe(ASUNTO_ADMIN);
            });

            await caso(319, 'el correo muestra el nombre de la organización, el nombre y el email del solicitante y la fecha', async () => {
                expect(correo, 'hay correo del caso 318').toBeTruthy();
                expect(correo.texto).toContain(nombre);
                expect(correo.texto).toContain(u1.email);
                expect(correo.texto).toContain('Prueba');
                expect(correo.texto).toMatch(/\d{2}\/\d{2}\/\d{4}/);
            });

            await casoContinuo(320, 'el asunto del correo indica que es una nueva solicitud de registro de organización', async () => {
                expect(correo, 'hay correo del caso 318').toBeTruthy();
                expect(correo.asunto).toBe(ASUNTO_ADMIN);
            });

            await caso(321, 'cada solicitud registrada genera su propio correo al administrador', async () => {
                await esperarCorreo(request, { para: USUARIOS.admin, asunto: ASUNTO_ADMIN, contiene: nombre2 });
                expect(await contarCorreos(request, { para: USUARIOS.admin, asunto: ASUNTO_ADMIN, contiene: nombre })).toBe(1);
                expect(await contarCorreos(request, { para: USUARIOS.admin, asunto: ASUNTO_ADMIN, contiene: nombre2 })).toBe(1);
            });
        } finally {
            // Las solicitudes de prueba no quedan pendientes: cada solicitante cancela la suya.
            for (const u of [u1, u2]) {
                const mis = await request.get(`${URL_BACK}/organizations/requests/my`, { headers: { Authorization: `Bearer ${u.token}` } });
                if (!mis.ok()) continue;
                for (const m of await mis.json()) {
                    if (m.status === 'PENDING_APPROVAL') await request.delete(`${URL_BACK}/organizations/requests/${m.id}`, { headers: { Authorization: `Bearer ${u.token}` } });
                }
            }
        }
    });
});
