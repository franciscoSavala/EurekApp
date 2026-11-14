const { test, expect } = require('@playwright/test');
const { USUARIOS, nombreUnico, abrirComoUsuario, irAlMenu, abrirMenu, caso } = require('./helpers');
const { dniUnico } = require('./helpers/t04');
const { loginApi, receptarApi, devolverApi, alertaDelDni, resolverAlertaApi } = require('./helpers/t07');

// La pantalla Alertas de fraude es del dueño de Eurekapp (administrador): las alertas son globales.
// Limpieza: la alerta que crea el test se marca como falsa alarma por la API (única acción que
// permite la app). Eso levanta el bloqueo de emp2.utn y del DNI y deja la alerta inactiva.

test.describe('Alertas de fraude', () => {
    // Los casos 169, 171, 172 y 180 piden al dueño de organización (owner.utn); 170 y 179 no indican
    // rol y se prueban con el administrador. Los pasos del dueño usan expect.soft para que el test
    // siga y la limpieza corra aunque ese rol no vea la pantalla.
    test('casos 169 a 172, 179 y 180: alertas de fraude del administrador y del dueño de organización @fraude @serie', async ({ browser, request }) => {
        test.setTimeout(300_000);
        const dni = dniUnico();
        const empleado = await loginApi(request, 'emp2.utn@eurekapp.com');
        const admin = await loginApi(request, USUARIOS.admin);
        const contextos = [];
        try {
            // Tres devoluciones con el mismo DNI en la organización 1 generan la alerta.
            for (let i = 0; i < 3; i++) {
                const uuid = await receptarApi(request, empleado.token, empleado.orgId, nombreUnico('Objeto fraude'));
                await devolverApi(request, empleado.token, empleado.orgId, uuid, dni);
            }
            expect(await alertaDelDni(request, admin.token, dni)).toBeTruthy();

            // Administrador: casos 170 y 179.
            const a = await abrirComoUsuario(browser, USUARIOS.admin);
            contextos.push(a.context);
            const pa = a.page;
            await irAlMenu(pa, 'Alertas de fraude');
            await caso(170, 'se ve el botón Ver reporte y el listado de alertas', async () => {
                await expect.soft(pa.getByText('Ver reporte', { exact: true }).locator('visible=true')).toBeVisible();
                await expect.soft(pa.getByText(/^DNI: \d+$/).locator('visible=true').first()).toBeVisible();
            });
            await caso(179, 'la alerta recién generada aparece en la pantalla', async () => {
                await expect.soft(pa.getByText(`DNI: ${dni}`, { exact: true }).locator('visible=true')).toBeVisible();
            });

            // Dueño de organización: casos 169, 171, 172 y 180.
            const d = await abrirComoUsuario(browser, USUARIOS.dueno);
            contextos.push(d.context);
            const pd = d.page;
            const verReporte = () => pd.getByText('Ver reporte', { exact: true }).locator('visible=true');
            const dniVisible = () => pd.getByText(`DNI: ${dni}`, { exact: true }).locator('visible=true');
            const opcion = () => pd.locator('a', { has: pd.getByText('Alertas de fraude', { exact: true }) });
            /** Entra a la pantalla por el menú si el dueño tiene la opción. Devuelve si llegó. */
            const entrar = async () => {
                await abrirMenu(pd);
                if (await opcion().count() === 0) return false;
                await opcion().click();
                return await verReporte().isVisible({ timeout: 10_000 }).catch(() => false);
            };

            let llego = false;
            await caso(169, 'el dueño de organización ve la opción en el menú y entra a la pantalla', async () => {
                llego = await entrar();
                expect.soft(llego, 'el dueño de organización no ve la opción Alertas de fraude en su menú').toBe(true);
            });

            await caso(171, 'sin datos aparece el mensaje de que no hay alertas', async () => {
                expect.soft(llego, 'el dueño no llega a la pantalla').toBe(true);
                if (!llego) return;
                // Las alertas son globales y el seed ya trae varias: el servidor se simula sin alertas.
                await pd.route('**/fraud-alerts', (r) =>
                    r.request().method() === 'GET'
                        ? r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
                        : r.continue());
                await pd.reload();
                await expect(pd.getByText('Logout')).toBeVisible();
                await entrar();
                await expect.soft(pd.getByText('No hay alertas de fraude').locator('visible=true')).toBeVisible();
                await pd.unroute('**/fraud-alerts');
            });

            await caso(172, 'la alerta muestra estado, motivo, DNI, usuarios involucrados y fecha', async () => {
                expect.soft(llego, 'el dueño no llega a la pantalla').toBe(true);
                if (!llego) return;
                await pd.reload();
                await expect(pd.getByText('Logout')).toBeVisible();
                await entrar();
                const t = pd.locator('div')
                    .filter({ has: pd.getByText(`DNI: ${dni}`, { exact: true }) })
                    .filter({ has: pd.getByText('Activa', { exact: true }) })
                    .last();
                await expect.soft(t.getByText('Activa', { exact: true })).toBeVisible();
                await expect.soft(t.getByText(/Retiros repetidos del mismo DNI/)).toBeVisible();
                await expect.soft(t.getByText(`DNI: ${dni}`, { exact: true })).toBeVisible();
                await expect.soft(t.getByText(/usuarios? involucrados?/)).toBeVisible();
                await expect.soft(t.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).toBeVisible();
            });

            await caso(180, 'tras recargar la pantalla las alertas siguen visibles', async () => {
                expect.soft(llego, 'el dueño no llega a la pantalla').toBe(true);
                if (!llego) return;
                await pd.reload();
                await expect(pd.getByText('Logout')).toBeVisible();
                await entrar();
                await expect.soft(dniVisible()).toBeVisible();
            });
        } finally {
            for (const c of contextos) await c.close();
            // Limpieza: la alerta del test se marca como falsa alarma por la API (levanta el bloqueo de emp2.utn y del DNI).
            const alerta = await alertaDelDni(request, admin.token, dni);
            if (alerta && alerta.status === 'ACTIVE') await resolverAlertaApi(request, admin.token, alerta.id);
        }
    });
});
