const { test, expect } = require('@playwright/test');
const { USUARIOS, nombreUnico, bajarHastaVer } = require('./helpers');
const { casoContinuo: caso } = require('./helpers/t17');
const { tarjetaDevuelto } = require('./helpers/t04');
const t = require('./helpers/t13');

const { visible } = t;
const dos = (n) => String(n).padStart(2, '0');
const EMPLEADO = 'emp1.utn@eurekapp.com';

/** Exclusiones de puntos de la organización, tal como las informa el servidor. */
async function exclusionesApi(request, token) {
    const r = await request.get(`${t.URL_BACK}/found-objects/reward-exclusions`, { headers: { Authorization: `Bearer ${token}` } });
    expect(r.ok()).toBeTruthy();
    const j = await r.json();
    return j.exclusions ?? j;
}

test.describe('exclusión de recompensas por incompatibilidad de funciones', () => {
    test.setTimeout(600_000);

    test('casos 238, 239, 240 y 241: el encargado y el empleado registran un objeto y no reciben recompensa @recompensas @serie', async ({ browser, request }) => {
        const enc = await t.abrirSesionPaciente(browser, USUARIOS.encargado);
        const dueno = await t.abrirSesionPaciente(browser, USUARIOS.dueno);
        const emp = await t.abrirSesionPaciente(browser, 'emp2.utn@eurekapp.com');
        const pe = enc.page;
        const pd = dueno.page;
        const tokenEnc = await t.tokenDe(pe);
        const tokenDueno = await t.tokenDe(pd);
        const tokenEmp = await t.tokenDe(emp.page);
        const titulo = nombreUnico('Billetera encargado');
        const tituloEmp = nombreUnico('Billetera empleado');
        try {
            const antes = await exclusionesApi(request, tokenDueno);
            const xpAntes = (await t.logrosApi(request, tokenEnc)).xp;
            const xpEmpAntes = (await t.logrosApi(request, tokenEmp)).xp;
            let nueva = null;

            await caso(238, 'el encargado registra un objeto con datos válidos; al devolverlo no suma XP ni logros y el detalle de la devolución muestra el motivo', async () => {
                // Quien lo encontró es el propio encargado: es el caso que dispara la exclusión.
                await t.receptarUi(pe, titulo, USUARIOS.encargado);
                nueva = (await exclusionesApi(request, tokenDueno)).find((e) => !antes.some((a) => a.id === e.id));
                expect(nueva, 'debería registrarse una exclusión nueva').toBeTruthy();
                expect(nueva.username).toBe(USUARIOS.encargado);
                const dev = await t.devolverApi(request, tokenEmp, nueva.foundObjectUUID);
                expect(dev.ok()).toBeTruthy();
                const logros = await t.logrosApi(request, tokenEnc);
                expect(logros.xp).toBe(xpAntes);
                expect(logros.returnedObjects).toBe(0);
                expect(logros.returnedObjectsAchievements).toHaveLength(0);
                // El detalle lo informa el servidor.
                const det0 = await request.post(`${t.URL_BACK}/found-objects/getReturnedObject`, { headers: { Authorization: `Bearer ${tokenEnc}` }, data: { foundObjectUUID: nueva.foundObjectUUID } });
                const j0 = await det0.json();
                expect(j0.rewardExcluded).toBe(true);
                expect(j0.rewardExclusionMessage).toMatch(/incompatibilidad de funciones/i);
                // Y la pantalla Ver objetos devueltos > Ver devolución lo muestra, siempre que el objeto figure en el listado
                // (el listado tiene un tope y un objeto recién devuelto puede no aparecer: es el caso 110, no este).
                await t.irA(pe, 'Ver objetos devueltos');
                const listado = await bajarHastaVer(pe, titulo).then(() => true, () => false);
                if (listado) {
                    await tarjetaDevuelto(pe, titulo).getByText('Ver devolución', { exact: true }).click();
                    await expect(visible(pe.getByText(/incompatibilidad de funciones/i))).toBeVisible();
                }

                // Lo mismo con un empleado (rol Empleado): registra su propio objeto y no suma XP.
                const uuid = await t.receptarApi(request, tokenEmp, tituloEmp, EMPLEADO);
                const dev2 = await t.devolverApi(request, tokenEmp, uuid);
                expect(dev2.ok()).toBeTruthy();
                const det = await request.post(`${t.URL_BACK}/found-objects/getReturnedObject`, { headers: { Authorization: `Bearer ${tokenEmp}` }, data: { foundObjectUUID: uuid } });
                const j = await det.json();
                expect(j.rewardExcluded).toBe(true);
                expect(j.rewardExclusionMessage).toMatch(/incompatibilidad de funciones/i);
                expect((await t.logrosApi(request, tokenEmp)).xp).toBe(xpEmpAntes);
            });

            await t.irA(pd, 'Exclusiones de puntos');
            await expect(visible(pd.getByText('Exclusiones de puntos').first())).toBeVisible();
            const tarjeta = () => pd.locator('div')
                .filter({ has: pd.getByText(`Obj: ${nueva.foundObjectUUID.substring(0, 8)}...`) })
                .filter({ has: pd.getByText(USUARIOS.encargado, { exact: true }) })
                .locator('visible=true').last();

            await caso(239, 'queda constancia del motivo: "Sin puntos · Incompatibilidad de funciones"', async () => {
                await expect(tarjeta()).toContainText('Sin puntos · Incompatibilidad de funciones');
            });

            await caso(240, 'el responsable de la organización ve en Exclusiones de puntos el caso excluido por incompatibilidad', async () => {
                await expect(tarjeta()).toBeVisible();
                await expect(tarjeta()).toContainText(/incompatibilidad de funciones/i);
            });

            await caso(241, 'el caso excluido muestra fecha, hora, usuario y rol', async () => {
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
        } finally {
            await enc.context.close();
            await dueno.context.close();
            await emp.context.close();
        }
    });
});
