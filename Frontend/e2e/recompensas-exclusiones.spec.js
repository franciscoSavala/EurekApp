const { test, expect } = require('@playwright/test');
const { USUARIOS, caso, nombreUnico } = require('./helpers');
const t = require('./helpers/t13');

const { visible } = t;
const dos = (n) => String(n).padStart(2, '0');

/** Exclusiones de recompensa de la organización, tal como las informa el servidor. */
async function exclusionesApi(request, token) {
    const r = await request.get(`${t.URL_BACK}/found-objects/reward-exclusions`, { headers: { Authorization: `Bearer ${token}` } });
    expect(r.ok()).toBeTruthy();
    const j = await r.json();
    return j.exclusions ?? j;
}

test.describe('exclusión de recompensas por incompatibilidad de funciones', () => {
    test.setTimeout(600_000);

    test('casos 353, 354, 355, 356, 357 y 358: el encargado registra un objeto y no recibe recompensa @recompensas @serie', async ({ browser, request }) => {
        const enc = await t.abrirSesionPaciente(browser, USUARIOS.encargado);
        const dueno = await t.abrirSesionPaciente(browser, USUARIOS.dueno);
        const pe = enc.page;
        const pd = dueno.page;
        const tokenEnc = await t.tokenDe(pe);
        const tokenDueno = await t.tokenDe(pd);
        const titulo = nombreUnico('Billetera encargado');
        try {
            const antes = await exclusionesApi(request, tokenDueno);
            const xpAntes = (await t.logrosApi(request, tokenEnc)).xp;

            await caso(358, 'el encargado receptar un objeto con datos válidos queda registrado', async () => {
                // Quien lo encontró es el propio encargado: es el caso que dispara la exclusión.
                await t.receptarUi(pe, titulo, USUARIOS.encargado);
            });

            const despues = await exclusionesApi(request, tokenDueno);
            const nueva = despues.find((e) => !antes.some((a) => a.id === e.id));

            await caso(353, 'el objeto queda registrado pero el encargado no recibe recompensas', async () => {
                expect(nueva, 'debería registrarse una exclusión nueva').toBeTruthy();
                expect(nueva.username).toBe(USUARIOS.encargado);
                const logros = await t.logrosApi(request, tokenEnc);
                expect(logros.xp).toBe(xpAntes);
                expect(logros.returnedObjects).toBe(0);
            });

            await t.irA(pd, 'Exclusiones de recompensa');
            await expect(visible(pd.getByText('Exclusiones de recompensa').first())).toBeVisible();
            const tarjeta = () => pd.locator('div')
                .filter({ has: pd.getByText(`Obj: ${nueva.foundObjectUUID.substring(0, 8)}...`) })
                .filter({ has: pd.getByText(USUARIOS.encargado, { exact: true }) })
                .locator('visible=true').last();

            await caso(355, 'el responsable de la organización ve los casos excluidos', async () => {
                await expect(tarjeta()).toBeVisible();
            });

            await caso(354, 'queda constancia del motivo de la exclusión', async () => {
                await expect(tarjeta()).toContainText('Incompatibilidad de funciones');
                await expect(tarjeta()).toContainText('Sin recompensa');
            });

            await caso(356, 'se registran fecha, hora, usuario y rol del caso excluido', async () => {
                const f = nueva.excludedAt; // AAAA-MM-DDTHH:mm:ss (hora local del servidor)
                const dia = `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
                const hora = f.slice(11, 16);
                const texto = await tarjeta().innerText();
                expect(texto).toContain(USUARIOS.encargado);
                expect(texto).toContain('Encargado');
                expect(texto).toContain(dia);
                expect(texto).toContain(hora);
                // Y es de hoy.
                const hoy = new Date();
                expect(dia).toBe(`${dos(hoy.getDate())}/${dos(hoy.getMonth() + 1)}/${hoy.getFullYear()}`);
            });

            await caso(357, 'el encargado no recibe puntos, niveles ni insignias y puede consultarlo en Logros', async () => {
                // El objeto se devuelve para que, de haber recompensa, ya se hubiera otorgado.
                const tokenEmp = await (async () => {
                    const e = await t.abrirSesionPaciente(browser, 'emp2.utn@eurekapp.com');
                    const tk = await t.tokenDe(e.page);
                    await e.context.close();
                    return tk;
                })();
                const r = await t.devolverApi(request, tokenEmp, nueva.foundObjectUUID);
                expect(r.ok()).toBeTruthy();
                const logros = await t.logrosApi(request, tokenEnc);
                expect(logros.xp).toBe(xpAntes);
                expect(logros.returnedObjects).toBe(0);
                expect(logros.returnedObjectsAchievements).toHaveLength(0);
                // La pantalla Logros no existe en el menú del encargado.
                await pe.goto('/');
                await expect(pe.getByText('Logout')).toBeVisible();
                await (require('../e2e/helpers').abrirMenu)(pe);
                expect.soft(await visible(pe.getByText('Logros', { exact: true })).count(), 'el encargado debería poder abrir Logros').toBeGreaterThan(0);
            });
        } finally {
            await enc.context.close();
            await dueno.context.close();
        }
    });
});
