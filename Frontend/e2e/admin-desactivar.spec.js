const { test, expect } = require('@playwright/test');
const { USUARIOS, USUARIOS_PARALELO, caso, irAlLogin, completarYEnviarLogin, irAlMenu, CLAVE } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const t15 = require('./helpers/t15');
const { casoContinuo } = require('./helpers/t17');

const MAILPIT = process.env.E2E_MAILPIT_URL || 'http://localhost:8025';

/** Espera (hasta 40 s) a que el servidor de correo de prueba tenga un correo para `email` cuyo asunto cumpla `patron`. */
async function correoPara(request, email, patron) {
    let asunto = null;
    await expect.poll(async () => {
        const r = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + email)}`);
        const msgs = (await r.json()).messages || [];
        asunto = (msgs.find((m) => patron.test(m.Subject)) || {}).Subject || null;
        return asunto;
    }, { timeout: 40_000, intervals: [1000, 2000] }).not.toBeNull();
    return asunto;
}

const ORG_TERMINAL = 'Terminal de Omnibus Cordoba';
const DUENO_TERMINAL = 'owner.term@eurekapp.com';

/** Abre Buscar un objeto con la lista actual y devuelve los establecimientos que se ofrecen. */
async function opcionesDeEstablecimiento(page) {
    await page.goto('/');
    await irAlMenu(page, 'Buscar un objeto');
    const opciones = page.locator('select').first();
    await expect(opciones).toBeVisible();
    // Los establecimientos cargan después de la pantalla: se espera a que haya reales.
    await expect.poll(async () => (await opciones.locator('option').allInnerTexts()).includes('UTN FRC'), { timeout: 30_000 }).toBe(true);
    return opciones.locator('option').allInnerTexts();
}

test.describe('Administración: desactivar y reactivar (serie)', () => {
    // El registro y el ingreso por la API pueden esperar el cupo de 10 por minuto compartido.
    test.setTimeout(480000);

    test('casos 291 a 296: desactivar un usuario nuevo, que quede registrado y avisado, que no pueda ingresar, reactivarlo y que el administrador no se desactive @admin @adminpanel @serie', async ({ browser, request }) => {
        const { context, page } = await t15.abrirAdmin(browser);
        const nuevo = await t15.registrarNuevo(request, 'des');
        const idNuevo = async () => (await t15.usuariosApi(request, page)).find((u) => u.username === nuevo.email);
        try {
            await t15.irAUsuarios(page);
            await t15.verEnListado(page, nuevo.email);

            await caso(291, 'el administrador desactiva la cuenta de un usuario activo', async () => {
                const ficha = t15.tarjeta(page, nuevo.email);
                await ficha.getByText('Desactivar', { exact: true }).click();
                await expect(t15.dialogo(page).getByText('¿Desactivar usuario?')).toBeVisible();
                const respuesta = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes('/admin/users'));
                await t15.dialogo(page).getByText('Desactivar', { exact: true }).click();
                expect((await respuesta).status()).toBeLessThan(300);
                expect((await idNuevo()).active).toBe(false);
                await t15.verEnListado(page, nuevo.email);
                await expect(t15.tarjeta(page, nuevo.email).getByText('Activar', { exact: true })).toBeVisible();
            });

            await casoContinuo(295, 'el cambio de estado queda registrado con el administrador y la fecha y hora', async () => {
                const u = await idNuevo();
                const claves = Object.keys(u).filter((k) => /(deactivat|status|changed|modified|updated).*/i.test(k));
                expect(claves, 'el usuario no tiene ningún dato de quién ni cuándo cambió su estado').not.toEqual([]);
                expect(JSON.stringify(claves.map((k) => u[k])), 'debería figurar el administrador').toContain(USUARIOS.admin);
            });

            await caso(292, 'el usuario desactivado no puede iniciar sesión', async () => {
                const ctx = await browser.newContext({ baseURL: process.env.E2E_BASE_URL || 'http://localhost:8082', viewport: { width: 1280, height: 900 } });
                try {
                    const p = await ctx.newPage();
                    await irAlLogin(p);
                    const intento = p.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/login'));
                    await completarYEnviarLogin(p, nuevo.email, CLAVE);
                    expect((await intento).status(), 'el servidor debería rechazar el ingreso').toBeGreaterThanOrEqual(400);
                    await p.waitForTimeout(1500);
                    await expect(p.getByText('Logout')).toHaveCount(0);
                } finally {
                    await ctx.close();
                }
            });

            await caso(293, 'el administrador reactiva la cuenta del usuario inactivo', async () => {
                await t15.verEnListado(page, nuevo.email);
                const ficha = t15.tarjeta(page, nuevo.email);
                await ficha.getByText('Activar', { exact: true }).click();
                await expect(t15.dialogo(page).getByText('¿Activar usuario?')).toBeVisible();
                const respuesta = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes('/admin/users'));
                await t15.dialogo(page).getByText('Activar', { exact: true }).click();
                expect((await respuesta).status()).toBeLessThan(300);
                expect((await idNuevo()).active).toBe(true);
                await t15.verEnListado(page, nuevo.email);
                await expect(t15.tarjeta(page, nuevo.email).getByText('Desactivar', { exact: true })).toBeVisible();
            });

            await casoContinuo(296, 'el usuario desactivado recibe el correo de cuenta desactivada y la notificación', async () => {
                const asunto = await correoPara(request, nuevo.email, /desactivada/i);
                expect(asunto).toMatch(/desactivada/i);
                const notifs = await (await request.get(`${t15.URL_BACK}/notifications`, { headers: t15.auth(nuevo.token) })).json();
                expect(notifs.map((n) => n.title), 'notificación en la app').toContain('Tu cuenta fue desactivada');
            });

            await caso(294, 'el administrador no puede desactivarse a sí mismo', async () => {
                await t15.chip(page, 'Admins').click();
                const ficha = t15.tarjeta(page, 'soporte.eurekapp@gmail.com');
                await expect(ficha).toBeVisible();
                await ficha.getByText('Desactivar', { exact: true }).click();
                const respuesta = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes('/admin/users'));
                await t15.dialogo(page).getByText('Desactivar', { exact: true }).click();
                expect((await respuesta).status()).toBeGreaterThanOrEqual(400);
                const [admin] = await t15.usuariosApi(request, page, 'ADMIN');
                expect(admin.active, 'el administrador sigue activo').toBe(true);
            });
        } finally {
            const u = await idNuevo();
            if (u && !u.active) await t15.fijarActivo(request, page, 'users', u.id, true);
            await context.close();
        }
    });

    test('casos 298 y 301 a 304: desactivar y reactivar la organización Terminal y lo que pasa con su gente y con la selección de establecimientos @admin @adminpanel @serie', async ({ browser, request }) => {
        const { context, page } = await t15.abrirAdmin(browser);
        const orgs = await t15.organizacionesApi(request, page);
        const terminal = orgs.find((o) => o.name === ORG_TERMINAL);
        expect(terminal, 'la organización Terminal existe en el seed').toBeTruthy();
        const tokenDueno = await t15.loginApi(request, DUENO_TERMINAL);
        const duenoAntes = (await t15.usuariosApi(request, page)).find((u) => u.username === DUENO_TERMINAL);
        const valeria = await abrirComo(browser, USUARIOS_PARALELO.usuarioValeria);
        const dueno = await abrirComo(browser, DUENO_TERMINAL);
        try {
            // Con la organización activa, Terminal sí se ofrece (si no, la comprobación de después no probaría nada).
            expect(await opcionesDeEstablecimiento(valeria.page)).toContain(ORG_TERMINAL);
            await t15.irAOrganizaciones(page);
            const ficha = () => t15.tarjeta(page, ORG_TERMINAL);

            await casoContinuo(301, 'desactivar pide confirmación: al cancelar sigue Activa; al confirmar pasa a Inactiva y sus empleados quedan deslogueados', async () => {
                await ficha().getByText('Desactivar', { exact: true }).click();
                await expect(t15.dialogo(page).getByText('¿Desactivar organización?')).toBeVisible();
                await expect(t15.dialogo(page).getByText('Cancelar', { exact: true })).toBeVisible();
                await t15.dialogo(page).getByText('Cancelar', { exact: true }).click();
                await expect(ficha().getByText('Activa', { exact: true })).toBeVisible();
                const sinConfirmar = (await t15.organizacionesApi(request, page)).find((x) => x.id === terminal.id);
                expect(sinConfirmar.active, 'sin confirmar, la organización sigue activa').toBe(true);

                await ficha().getByText('Desactivar', { exact: true }).click();
                const respuesta = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes('/admin/organizations'));
                await t15.dialogo(page).getByText('Desactivar', { exact: true }).click();
                expect((await respuesta).status()).toBeLessThan(300);
                await expect(ficha().getByText('Inactiva', { exact: true })).toBeVisible();
                const o = (await t15.organizacionesApi(request, page)).find((x) => x.id === terminal.id);
                expect(o.active).toBe(false);

                // El dueño, que tenía la sesión abierta, queda deslogueado.
                await dueno.page.reload();
                await expect(dueno.page.getByText('Logout'), 'el empleado de la organización desactivada sigue con la sesión abierta').toHaveCount(0, { timeout: 15_000 });
            });

            await casoContinuo(298, 'el listado muestra organizaciones activas e inactivas', async () => {
                await expect(page.getByText('Activa', { exact: true }).locator('visible=true').first()).toBeVisible();
                await expect(page.getByText('Inactiva', { exact: true }).locator('visible=true').first()).toBeVisible();
            });

            await casoContinuo(303, 'la organización desactivada no opera ni aparece en la selección de establecimientos', async () => {
                const r = await request.get(`${t15.URL_BACK}/organizations/policy`, { headers: t15.auth(tokenDueno) });
                expect.soft(r.status(), 'el dueño de la organización desactivada ya no puede operar').toBeGreaterThanOrEqual(400);
                const textos = await opcionesDeEstablecimiento(valeria.page);
                expect(textos).toContain('UTN FRC');
                expect(textos, 'la organización desactivada no debería ofrecerse al elegir establecimiento').not.toContain(ORG_TERMINAL);
            });

            await casoContinuo(304, 'los empleados mantienen su rol aunque la organización quede inactiva', async () => {
                const duenoDespues = (await t15.usuariosApi(request, page)).find((u) => u.username === DUENO_TERMINAL);
                expect(duenoDespues.role).toBe(duenoAntes.role);
                expect(duenoDespues.organizationName).toBe(ORG_TERMINAL);
                const o = (await t15.organizacionesApi(request, page)).find((x) => x.id === terminal.id);
                expect(o.employeeCount).toBe(terminal.employeeCount);
                await t15.irAUsuarios(page);
                await t15.chip(page, 'Responsables').click();
                const fichaDueno = t15.tarjeta(page, DUENO_TERMINAL);
                await expect(fichaDueno.getByText('Responsable', { exact: true })).toBeVisible();
            });

            await casoContinuo(302, 'el administrador reactiva la organización inactiva y pasa a Activa', async () => {
                await t15.irAOrganizaciones(page);
                await ficha().getByText('Activar', { exact: true }).click();
                const respuesta = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes('/admin/organizations'));
                await t15.dialogo(page).getByText('Activar', { exact: true }).click();
                expect((await respuesta).status()).toBeLessThan(300);
                await expect(ficha().getByText('Activa', { exact: true })).toBeVisible();
                const o = (await t15.organizacionesApi(request, page)).find((x) => x.id === terminal.id);
                expect(o.active).toBe(true);
            });
        } finally {
            await t15.fijarActivo(request, page, 'organizations', terminal.id, true);
            await valeria.context.close();
            await dueno.context.close();
            await context.close();
        }
    });

    test('caso 313: el contador de usuarios del dashboard sube al registrar un usuario nuevo @admin @adminpanel @serie', async ({ browser, request }) => {
        const { context, page } = await t15.abrirAdmin(browser);
        try {
            await caso(313, 'el total de usuarios aumenta después de registrar un usuario', async () => {
                await t15.abrirDashboard(page);
                const antes = await t15.valorTarjeta(page, 'Usuarios totales');
                await t15.registrarNuevo(request, 'cnt');
                await page.goto('/');
                await expect(page.getByText('Usuarios totales', { exact: true }).locator('visible=true')).toBeVisible();
                await expect.poll(() => t15.valorTarjeta(page, 'Usuarios totales')).toBeGreaterThan(antes);
            });
        } finally {
            await context.close();
        }
    });
});
