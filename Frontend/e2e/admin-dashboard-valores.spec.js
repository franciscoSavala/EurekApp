const { test, expect } = require('@playwright/test');
const { caso } = require('./helpers');
const t15 = require('./helpers/t15');

test.describe('Administración: dashboard de estadísticas globales', () => {
    test('casos 441 y 430: el panel de administración abre en el dashboard y también se llega desde el menú @admin @adminpanel @paralelo', async ({ browser }) => {
        const { context, page } = await t15.abrirAdmin(browser);
        try {
            await caso(441, 'al abrir el panel, la pantalla inicial es el dashboard', async () => {
                await page.goto('/');
                await expect(page.getByText('Plataforma', { exact: true }).locator('visible=true')).toBeVisible();
                await expect(page.getByText('Usuarios totales', { exact: true }).locator('visible=true')).toBeVisible();
            });
            await caso(430, 'el dashboard se abre desde el menú del administrador', async () => {
                await t15.irAlDashboardPorMenu(page);
                await expect(page.getByText('Usuarios por rol', { exact: true }).locator('visible=true')).toBeVisible();
            });
        } finally {
            await context.close();
        }
    });

    test('casos 431 a 438: el dashboard muestra las métricas principales y coinciden con el servidor @admin @adminpanel @paralelo', async ({ browser, request }) => {
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

            await caso(431, 'el dashboard muestra las siete métricas principales', async () => {
                await expect.soft(visible('Usuarios totales'), 'usuarios registrados').toBeVisible();
                await expect.soft(visible('Organizaciones activas'), 'organizaciones activas').toBeVisible();
                await expect.soft(page.getByText(/objetos encontrados en total/).locator('visible=true'), 'objetos encontrados').toBeVisible();
                expect.soft(await contenido(), 'objetos perdidos').toMatch(/perdidos/i);
                await expect.soft(page.getByText(/Recuperados/).locator('visible=true').first(), 'devoluciones exitosas').toBeVisible();
                await expect.soft(visible('Pendientes'), 'solicitudes de alta pendientes').toBeVisible();
                expect.soft(await contenido(), 'alertas de fraude pendientes').toMatch(/fraude/i);
            });

            await caso(432, 'el total de usuarios coincide con el sistema', async () => {
                const v = await t15.valorTarjeta(page, 'Usuarios totales');
                expect(v).toBe(mostradas.totalUsers);
                expect(v).toBeGreaterThanOrEqual(usuariosAntes);
                expect(v).toBeLessThanOrEqual(usuariosDespues);
            });

            await caso(433, 'el total de organizaciones activas coincide con el sistema', async () => {
                const v = await t15.valorTarjeta(page, 'Organizaciones activas');
                expect(v).toBe(mostradas.activeOrgs);
                expect(v).toBeGreaterThanOrEqual(Math.min(orgsAntes, orgsDespues));
                expect(v).toBeLessThanOrEqual(Math.max(orgsAntes, orgsDespues));
            });

            await caso(434, 'el total de objetos encontrados coincide con el sistema', async () => {
                const texto = await page.getByText(/objetos encontrados en total/).locator('visible=true').first().innerText();
                const v = Number(/(\d+)/.exec(texto)[1]);
                expect(v).toBe(mostradas.totalFoundObjects);
                expect(v).toBeGreaterThanOrEqual(antes.totalFoundObjects);
                expect(v).toBeLessThanOrEqual(despues.totalFoundObjects);
            });

            await caso(435, 'el dashboard muestra el total de objetos perdidos reportados', async () => {
                expect.soft(await contenido(), 'el dashboard no tiene un contador de objetos perdidos').toMatch(/perdidos/i);
            });

            await caso(436, 'el total de devoluciones exitosas coincide con el sistema', async () => {
                const texto = await page.getByText(/Recuperados/).locator('visible=true').first().innerText();
                const v = Number(/Recuperados:\s*(\d+)/.exec(texto)[1]);
                expect(v).toBe(mostradas.returnedFoundObjects);
                expect(v).toBeGreaterThanOrEqual(antes.returnedFoundObjects);
                expect(v).toBeLessThanOrEqual(despues.returnedFoundObjects);
            });

            await caso(437, 'el total de solicitudes de alta pendientes coincide con el sistema', async () => {
                const v = await t15.valorTarjeta(page, 'Pendientes');
                expect(v).toBe(mostradas.orgRequestsPending);
                const r = await t15.consultar(request, page, '/organizations/requests/pending-count');
                expect(r.status()).toBe(200);
                const cuerpo = await r.text();
                const num = Number(/\d+/.exec(cuerpo)[0]);
                expect(num, 'contador de pendientes del servidor').toBe(v);
            });

            await caso(438, 'el dashboard muestra el total de alertas de fraude pendientes', async () => {
                expect.soft(await contenido(), 'el dashboard no tiene un contador de alertas de fraude pendientes').toMatch(/fraude|alertas/i);
            });
        } finally {
            await context.close();
        }
    });
});
