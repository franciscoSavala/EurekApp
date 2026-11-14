const { test, expect } = require('@playwright/test');
const { USUARIOS, nombreUnico, abrirComoUsuario, irAlMenu, caso } = require('./helpers');
const { dniUnico } = require('./helpers/t04');
const { loginApi, receptarApi, devolverApi, alertaDelDni, resolverAlertaApi } = require('./helpers/t07');

// La pantalla Alertas de fraude es del dueño de Eurekapp (administrador): las alertas son globales.
// Limpieza: la alerta que crea el test se marca como falsa alarma por la API (única acción que
// permite la app). Eso levanta el bloqueo de emp2.utn y del DNI y deja la alerta inactiva.

test.describe('Alertas de fraude', () => {
    test('casos 169, 170, 172, 179 y 180: acceso, elementos, datos de una alerta nueva y persistencia al recargar @fraude @serie', async ({ browser, request }) => {
        test.setTimeout(240_000);
        const dni = dniUnico();
        const empleado = await loginApi(request, 'emp2.utn@eurekapp.com');
        const admin = await loginApi(request, USUARIOS.admin);
        let context;
        try {
            // Tres devoluciones con el mismo DNI en la organización 1 generan la alerta.
            for (let i = 0; i < 3; i++) {
                const uuid = await receptarApi(request, empleado.token, empleado.orgId, nombreUnico('Objeto fraude'));
                await devolverApi(request, empleado.token, empleado.orgId, uuid, dni);
            }
            expect(await alertaDelDni(request, admin.token, dni)).toBeTruthy();

            let page;
            ({ context, page } = await abrirComoUsuario(browser, USUARIOS.admin));
            const verReporte = () => page.getByText('Ver reporte', { exact: true }).locator('visible=true');
            const dniVisible = () => page.getByText(`DNI: ${dni}`, { exact: true }).locator('visible=true');

            await caso(169, 'el menú lleva a la pantalla Alertas de fraude', async () => {
                await irAlMenu(page, 'Alertas de fraude');
                await expect(verReporte()).toBeVisible();
            });

            await caso(170, 'se ve el botón Ver reporte y el listado de alertas', async () => {
                await expect(verReporte()).toBeVisible();
                await expect(page.getByText(/^DNI: \d+$/).locator('visible=true').first()).toBeVisible();
            });

            await caso(179, 'la alerta recién generada aparece en la pantalla', async () => {
                await expect(dniVisible()).toBeVisible();
            });

            await caso(172, 'la alerta muestra estado, motivo, DNI, usuarios involucrados y fecha', async () => {
                const t = page.locator('div')
                    .filter({ has: page.getByText(`DNI: ${dni}`, { exact: true }) })
                    .filter({ has: page.getByText('Activa', { exact: true }) })
                    .last();
                await expect.soft(t.getByText('Activa', { exact: true })).toBeVisible();
                await expect.soft(t.getByText(/Retiros repetidos del mismo DNI/)).toBeVisible();
                await expect.soft(t.getByText(`DNI: ${dni}`, { exact: true })).toBeVisible();
                await expect.soft(t.getByText(/usuarios? involucrados?/)).toBeVisible();
                await expect.soft(t.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).toBeVisible();
            });

            await caso(180, 'tras recargar la pantalla las alertas siguen visibles', async () => {
                await page.reload();
                await expect(page.getByText('Logout')).toBeVisible();
                await irAlMenu(page, 'Alertas de fraude');
                await expect(dniVisible()).toBeVisible();
            });
        } finally {
            if (context) await context.close();
            const alerta = await alertaDelDni(request, admin.token, dni);
            if (alerta && alerta.status === 'ACTIVE') await resolverAlertaApi(request, admin.token, alerta.id);
        }
    });

    test('caso 171: sin alertas se muestra "No hay alertas de fraude" @fraude @serie', async ({ browser }) => {
        // Las alertas son globales y el seed ya trae varias, así que el servidor se simula sin alertas.
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        try {
            await page.route('**/fraud-alerts', (route) =>
                route.request().method() === 'GET'
                    ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
                    : route.continue());
            await caso(171, 'sin datos aparece el mensaje de que no hay alertas', async () => {
                await irAlMenu(page, 'Alertas de fraude');
                await expect(page.getByText('No hay alertas de fraude').locator('visible=true')).toBeVisible();
                await expect(page.getByText('Ver reporte', { exact: true }).locator('visible=true')).toBeVisible();
            });
        } finally {
            await context.close();
        }
    });
});
