const { test, expect } = require('@playwright/test');
const { caso, nombreUnico } = require('./helpers');
const t = require('./helpers/t13');

const { visible } = t;

/** Registra por la API una pérdida del usuario (opcionalmente ya apuntando a un objeto encontrado). */
async function perderApi(request, token, descripcion, matchedUuid) {
    const multipart = { description: descripcion, organization_id: String(t.ORG_UTN) };
    if (matchedUuid) multipart.matched_object_uuid = matchedUuid;
    const r = await request.post(`${t.URL_BACK}/lost-objects`, { headers: { Authorization: `Bearer ${token}` }, multipart });
    if (!r.ok()) throw new Error(`perder: ${r.status()} ${await r.text()}`);
}

test.describe('recompensas por pérdidas y recuperaciones', () => {
    test.setTimeout(600_000);

    test('casos 323, 324 y 329: registrar una pérdida y recuperar el objeto no dan puntos ni progreso @recompensas @serie', async ({ browser, request }) => {
        const u = await t.registrarPaciente(request, 't13p');
        const tokenEmp = await t.loginPaciente(request, 'emp2.utn@eurekapp.com');
        const usr = await t.abrirSesionPaciente(browser, u.email);
        const pu = usr.page;
        try {
            await caso(323, 'registrar una pérdida suma 10 puntos', async () => {
                await perderApi(request, u.token, nombreUnico('Billetera marron perdida'));
                await t.irA(pu, 'Logros');
                // Registrar la pérdida no otorga puntos.
                expect.soft(await t.xpEnPantalla(pu), 'registrar la pérdida debería sumar 10 puntos').toBe(10);
            });

            const titulo = nombreUnico('Billetera recuperada');
            const uuid = await t.receptarApi(request, tokenEmp, titulo);
            await perderApi(request, u.token, titulo, uuid);
            const r = await t.devolverApi(request, tokenEmp, uuid, { retirador: u.email });
            expect(r.ok()).toBeTruthy();

            await caso(324, 'recuperar el objeto perdido suma 20 puntos a quien lo recuperó', async () => {
                await t.irA(pu, 'Logros');
                expect.soft(await t.xpEnPantalla(pu), 'recuperar el objeto debería sumar 20 puntos').toBeGreaterThanOrEqual(20);
            });

            await caso(329, 'recuperar el objeto aumenta el progreso de quien lo recuperó', async () => {
                expect.soft(await t.textoNivel(pu).innerText(), 'recuperar el objeto debería aumentar el progreso').not.toMatch(/^Nivel 1 - 0\s*XP$/);
            });
        } finally {
            await usr.context.close();
        }
    });
});
