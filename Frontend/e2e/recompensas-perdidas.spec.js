const { test, expect } = require('@playwright/test');
const { nombreUnico } = require('./helpers');
const { casoContinuo: caso } = require('./helpers/t17');
const t = require('./helpers/t13');
const r = require('./helpers/r10');

const { visible } = t;

/** Registra por la API una pérdida del usuario apuntando a un objeto encontrado. */
async function perderApi(request, token, descripcion, matchedUuid) {
    const multipart = { description: descripcion, organization_id: String(t.ORG_UTN) };
    if (matchedUuid) multipart.matched_object_uuid = matchedUuid;
    const res = await request.post(`${t.URL_BACK}/lost-objects`, { headers: { Authorization: `Bearer ${token}` }, multipart });
    if (!res.ok()) throw new Error(`perder: ${res.status()} ${await res.text()}`);
}

test.describe('recompensas por pérdidas y recuperaciones', () => {
    test.setTimeout(600_000);

    test('casos 226, 228 y 230: quien recupera su objeto perdido no suma puntos ni sube de nivel y no ve datos de la recompensa @recompensas @serie', async ({ browser, request }) => {
        const dueno = await t.registrarPaciente(request, 'r10d');
        const finder = await t.registrarPaciente(request, 'r10f');
        const tokenEmp = await t.loginPaciente(request, 'emp2.utn@eurekapp.com');
        const sesion = await t.abrirSesionPaciente(browser, dueno.email);
        const pd = sesion.page;
        try {
            const titulo = nombreUnico('Billetera recuperada');
            // El objeto lo encontró otro usuario; el dueño lo reclama y el empleado lo devuelve al dueño.
            const uuid = await t.receptarApi(request, tokenEmp, titulo, finder.email);
            await perderApi(request, dueno.token, titulo, uuid);
            const dev = await t.devolverApi(request, tokenEmp, uuid, { retirador: dueno.email });
            expect(dev.ok()).toBeTruthy();

            await caso(226, 'el dueño sigue en Nivel 1 - 0 XP y no recibe ninguna notificación de puntos', async () => {
                await t.irA(pd, 'Logros');
                await expect(t.textoNivel(pd)).toHaveText(/^Nivel 1 - 0\s*XP$/);
                expect(await r.cuantasRecompensas(request, dueno.token)).toBe(0);
                await t.irA(pd, 'Notificaciones');
                await pd.waitForTimeout(2000);
                await expect(visible(pd.getByText(/Sumaste \d+ puntos/))).toHaveCount(0);
            });

            await caso(230, 'el dueño no cambia de nivel ni de logros; quien lo encontró suma 10 XP', async () => {
                await t.irA(pd, 'Logros');
                await expect(t.textoNivel(pd)).toHaveText(/^Nivel 1 - 0\s*XP$/);
                await expect(visible(pd.getByText(/^Devolviste \d+ objetos?\./))).toHaveCount(0);
                expect((await t.logrosApi(request, dueno.token)).returnedObjects).toBe(0);
                expect((await t.logrosApi(request, finder.token)).xp).toBe(10);
            });

            await caso(228, 'el dueño, en el detalle de su búsqueda recuperada, no ve quién lo encontró ni la recompensa', async () => {
                await t.irA(pd, 'Mis búsquedas');
                await visible(pd.getByText(titulo).first()).click();
                await expect(visible(pd.getByText(/Retiraste tu objeto/))).toBeVisible();
                const pantalla = (await pd.locator('body').innerText()).toLowerCase();
                expect(pantalla).not.toContain(finder.email.toLowerCase());
                expect(pantalla).not.toContain('registrador del objeto');
                expect(pantalla).not.toContain('puntos otorgados');
                expect(pantalla).not.toContain('recompensa');
                // El detalle de la devolución del servidor tampoco se le entrega.
                const det = await request.post(`${t.URL_BACK}/found-objects/getReturnedObject`, {
                    headers: { Authorization: `Bearer ${dueno.token}` }, data: { foundObjectUUID: uuid },
                });
                expect(det.ok(), 'el usuario regular no debería recibir el detalle de la devolución').toBeFalsy();
            });
        } finally {
            await sesion.context.close();
        }
    });
});
