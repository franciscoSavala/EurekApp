const { test, expect } = require('@playwright/test');
const { caso, nombreUnico } = require('./helpers');
const t = require('./helpers/t13');

const { visible } = t;

test.describe('hitos de objetos devueltos', () => {
    test.setTimeout(600_000);

    test('casos 334, 335, 341, 342, 343, 346 y 347: insignias y puntos al llegar a 5 y 10 devoluciones @recompensas @serie', async ({ browser, request }) => {
        const u = await t.registrarPaciente(request, 't13h');
        const emp = await t.abrirSesionPaciente(browser, 'emp2.utn@eurekapp.com');
        const usr = await t.abrirSesionPaciente(browser, u.email);
        const pe = emp.page;
        const pu = usr.page;
        const tokenEmp = await t.tokenDe(pe);
        const xp = async () => (await t.logrosApi(request, u.token)).xp;
        try {
            // Diez objetos receptados de a cinco (la carga es lenta); las devoluciones van de a una.
            const titulos = Array.from({ length: 10 }, (_, i) => nombreUnico(`Hito ${i + 1}`));
            const uuids = [];
            for (let i = 0; i < 10; i += 5) {
                uuids.push(...await Promise.all(titulos.slice(i, i + 5).map((ti) => t.receptarApi(request, tokenEmp, ti, u.email))));
            }
            const devolver = async (i) => {
                const r = await t.devolverApi(request, tokenEmp, uuids[i]);
                expect(r.ok(), `devolución ${i + 1}`).toBeTruthy();
            };
            for (let i = 0; i < 4; i++) await devolver(i);
            expect(await xp()).toBe(40);

            await caso(346, 'una devolución inválida cerca del hito no suma puntos', async () => {
                await t.devolverInvalidoUi(pe, titulos[4]);
                expect(await xp()).toBe(40);
                await t.irA(pu, 'Logros');
                await expect(t.textoNivel(pu)).toContainText('40 XP');
            });

            await caso(341, 'una devolución fallida no otorga insignias', async () => {
                await expect(visible(pu.getByText('Mano Amiga')).first()).toBeVisible();
                await expect(visible(pu.getByText(/^Devolviste \d+ objetos?\./))).toHaveCount(1);
            });

            await devolver(4);

            await caso(334, 'la quinta devolución otorga la insignia de 5 objetos devueltos', async () => {
                await t.irA(pu, 'Logros');
                await expect(visible(pu.getByText('Devolviste 5 objetos.'))).toBeVisible();
                await expect(visible(pu.getByText('Mano Amiga'))).toBeVisible();
            });

            await caso(342, 'al llegar a 5 devoluciones se suman 50 puntos adicionales', async () => {
                // 40 de las cuatro anteriores + 10 de la quinta + 50 del hito.
                expect.soft(await xp(), 'debería haber 100 puntos con el hito de 5').toBe(100);
            });

            await caso(347, 'recargar no vuelve a dar los puntos del hito', async () => {
                const antes = await xp();
                await pu.reload();
                await expect(t.textoNivel(pu)).toContainText(`${antes} XP`);
                expect(await xp()).toBe(antes);
            });

            for (let i = 5; i < 9; i++) await devolver(i);
            const antes10 = await xp();
            await devolver(9);

            await caso(335, 'la décima devolución otorga la insignia de 10 objetos devueltos', async () => {
                await t.irA(pu, 'Logros');
                await expect(visible(pu.getByText('Devolviste 10 objetos.'))).toBeVisible();
                await expect(visible(pu.getByText('Buen Samaritano'))).toBeVisible();
            });

            await caso(343, 'al llegar a 10 devoluciones se suman 100 puntos adicionales', async () => {
                expect.soft((await xp()) - antes10, 'la décima devolución debería sumar 10 + 100 puntos').toBe(110);
            });
        } finally {
            await emp.context.close();
            await usr.context.close();
        }
    });
});
