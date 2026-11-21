const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, caso } = require('./helpers');
const t15 = require('./helpers/t15');

test.describe('Administración: dashboard de estadísticas globales', () => {
    test('casos 315: el panel de administración abre en el dashboard y también se llega desde el menú @admin @adminpanel @paralelo', async ({ browser }) => {
        const { context, page } = await t15.abrirAdmin(browser);
        try {
            await caso(315, 'el panel abre en el dashboard de estadísticas globales y también se llega desde el menú', async () => {
                await page.goto('/');
                // Con carga, el dashboard tarda en dejar el spinner.
                await expect(page.getByText('Plataforma', { exact: true }).locator('visible=true')).toBeVisible({ timeout: 60_000 });
                await expect(page.getByText('Usuarios totales', { exact: true }).locator('visible=true')).toBeVisible();
                await t15.irAlDashboardPorMenu(page);
                await expect(page.getByText('Usuarios por rol', { exact: true }).locator('visible=true')).toBeVisible();
            });
        } finally {
            await context.close();
        }
    });

    test('casos 305 a 312 y 317: el dashboard muestra las métricas principales y coinciden con el servidor @admin @adminpanel @paralelo', async ({ browser, request }) => {
        const { context, page } = await t15.abrirAdmin(browser);
        try {
            const antes = await t15.statsApi(request, page);
            const usuariosAntes = (await t15.usuariosApi(request, page)).length;
            const orgsAntes = (await t15.organizacionesApi(request, page)).filter((o) => o.active).length;
            const mostradas = await t15.abrirDashboard(page);
            const despues = await t15.statsApi(request, page);
            const usuariosDespues = (await t15.usuariosApi(request, page)).length;
            const orgsDespues = (await t15.organizacionesApi(request, page)).filter((o) => o.active).length;
            // Texto del contenido del dashboard (sin el menú lateral, que también nombra "Alertas de fraude").
            const contenido = () => page.getByText('Plataforma', { exact: true }).locator('visible=true').locator('xpath=..').innerText();
            const visible = (t) => page.getByText(t, { exact: true }).locator('visible=true').first();

            await caso(305, 'el dashboard muestra las siete métricas principales: usuarios, organizaciones activas, encontrados, perdidos, devoluciones, solicitudes y alertas de fraude pendientes', async () => {
                await expect.soft(visible('Usuarios totales'), 'usuarios registrados').toBeVisible();
                await expect.soft(visible('Organizaciones activas'), 'organizaciones activas').toBeVisible();
                await expect.soft(page.getByText(/objetos encontrados en total/).locator('visible=true'), 'objetos encontrados').toBeVisible();
                expect.soft(await contenido(), 'objetos perdidos').toMatch(/perdidos/i);
                await expect.soft(page.getByText(/Recuperados/).locator('visible=true').first(), 'devoluciones exitosas').toBeVisible();
                await expect.soft(visible('Pendientes'), 'solicitudes de alta pendientes').toBeVisible();
                expect.soft(await contenido(), 'alertas de fraude pendientes').toMatch(/fraude/i);
            });

            await caso(306, 'el total de usuarios coincide con el sistema', async () => {
                const v = await t15.valorTarjeta(page, 'Usuarios totales');
                expect(v).toBe(mostradas.totalUsers);
                expect(v).toBeGreaterThanOrEqual(usuariosAntes);
                expect(v).toBeLessThanOrEqual(usuariosDespues);
            });

            await caso(307, 'el total de organizaciones activas coincide con el sistema', async () => {
                const v = await t15.valorTarjeta(page, 'Organizaciones activas');
                expect(v).toBe(mostradas.activeOrgs);
                expect(v).toBeGreaterThanOrEqual(Math.min(orgsAntes, orgsDespues));
                expect(v).toBeLessThanOrEqual(Math.max(orgsAntes, orgsDespues));
            });

            await caso(308, 'el total de objetos encontrados coincide con el sistema', async () => {
                const texto = await page.getByText(/objetos encontrados en total/).locator('visible=true').first().innerText();
                const v = Number(/(\d+)/.exec(texto)[1]);
                expect(v).toBe(mostradas.totalFoundObjects);
                expect(v).toBeGreaterThanOrEqual(antes.totalFoundObjects);
                expect(v).toBeLessThanOrEqual(despues.totalFoundObjects);
            });

            await caso(309, 'el dashboard muestra el total de objetos perdidos reportados', async () => {
                expect.soft(await contenido(), 'el dashboard no tiene un contador de objetos perdidos').toMatch(/perdidos/i);
            });

            await caso(310, 'el total de devoluciones exitosas coincide con el sistema', async () => {
                const texto = await page.getByText(/Recuperados/).locator('visible=true').first().innerText();
                const v = Number(/Recuperados:\s*(\d+)/.exec(texto)[1]);
                expect(v).toBe(mostradas.returnedFoundObjects);
                expect(v).toBeGreaterThanOrEqual(antes.returnedFoundObjects);
                expect(v).toBeLessThanOrEqual(despues.returnedFoundObjects);
            });

            await caso(311, 'el total de solicitudes de alta pendientes coincide con el sistema', async () => {
                const v = await t15.valorTarjeta(page, 'Pendientes');
                expect(v).toBe(mostradas.orgRequestsPending);
                const r = await t15.consultar(request, page, '/organizations/requests/pending-count');
                expect(r.status()).toBe(200);
                const cuerpo = await r.text();
                const num = Number(/\d+/.exec(cuerpo)[0]);
                expect(num, 'contador de pendientes del servidor').toBe(v);
            });

            await caso(312, 'el dashboard muestra el total de alertas de fraude pendientes', async () => {
                expect.soft(await contenido(), 'el dashboard no tiene un contador de alertas de fraude pendientes').toMatch(/fraude|alertas/i);
            });
            await caso(317, 'usuarios por rol y solicitudes aprobadas y rechazadas coinciden con el sistema', async () => {
                const dePantalla = async (etiqueta) => {
                    const titulo = page.getByText('Usuarios por rol', { exact: true }).locator('visible=true');
                    const fila = titulo.locator('xpath=following-sibling::*[1]').getByText(etiqueta, { exact: true });
                    return Number((await fila.locator('xpath=../following-sibling::*[1]').innerText()).trim());
                };
                const roles = { USER: ['Usuarios', 'userUsers'], ORGANIZATION_OWNER: ['Responsables', 'orgOwnerUsers'], ORGANIZATION_EMPLOYEE: ['Empleados', 'orgEmployeeUsers'], ENCARGADO: ['Encargados', 'encargadoUsers'], ADMIN: ['Admins', 'adminUsers'] };
                for (const [rol, [etiqueta, clave]] of Object.entries(roles)) {
                    const v = await dePantalla(etiqueta);
                    expect.soft(v, `${etiqueta} en pantalla contra lo que mandó el servidor`).toBe(mostradas[clave]);
                    const enLista = (await t15.usuariosApi(request, page, rol)).length;
                    expect.soft(Math.abs(v - enLista), `${etiqueta} contra el listado de usuarios del rol`).toBeLessThanOrEqual(2);
                }
                const aprobadas = await t15.valorTarjeta(page, 'Aprobadas');
                const rechazadas = await t15.valorTarjeta(page, 'Rechazadas');
                expect.soft(aprobadas, 'solicitudes aprobadas').toBe(mostradas.orgRequestsApproved);
                expect.soft(rechazadas, 'solicitudes rechazadas').toBe(mostradas.orgRequestsRejected);
            });
        } finally {
            await context.close();
        }
    });

    test('caso 316: el dashboard de estadísticas se rechaza a quien no es administrador y el menú no lo ofrece @admin @adminpanel @paralelo', async ({ browser, request }) => {
        await caso(316, 'con sesión de usuario común y de dueño el servidor rechaza el dashboard y el menú no lo ofrece', async () => {
            for (const email of [USUARIOS_PARALELO.usuarioValeria, USUARIOS_PARALELO.duenoPatio]) {
                const { context, page } = await t15.abrirConToken(browser, email);
                try {
                    const r = await t15.consultar(request, page, '/admin/stats');
                    expect.soft(r.status(), `GET /admin/stats con ${email}`).toBe(403);
                    await page.goto('/');
                    await page.locator('button:has(img[src*="toggle-drawer-icon"])').last().click();
                    await expect(page.getByText('Logout')).toBeInViewport();
                    await expect(page.locator('a', { has: page.getByText('Dashboard', { exact: true }) }), `el menú de ${email} no debería ofrecer el dashboard`).toHaveCount(0);
                } finally {
                    await context.close();
                }
            }
        });
    });
});
