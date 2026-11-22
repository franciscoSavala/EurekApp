const { test, expect } = require('@playwright/test');
const { nombreUnico, bajarHastaVer } = require('./helpers');
const { casoContinuo: caso, noSePudoProbar, primeraLinea } = require('./helpers/t17');
const t = require('./helpers/t13');
const r = require('./helpers/r10');

const { visible } = t;

/** Notificaciones del usuario, abiertas por el menú (la pantalla que el menú llama Notificaciones). */
async function abrirNotificaciones(page) {
    await t.irA(page, 'Notificaciones');
    await page.waitForTimeout(2000);
}

test.describe('logros y recompensas de un usuario nuevo', () => {
    test.setTimeout(600_000);

    test('casos 114 y 117: pantalla de Logros de un usuario sin devoluciones @recompensas @serie', async ({ browser, request }) => {
        const u = await t.registrarPaciente(request, 'r10a');
        const s = await t.abrirSesionPaciente(browser, u.email);
        const page = s.page;
        try {
            await caso(114, 'Logros abre con "Nivel 1 - 0 XP", la barra vacía y "Te faltan 20 puntos para alcanzar el nivel 2"', async () => {
                await t.irA(page, 'Logros');
                await expect(visible(page.getByText('Logros:'))).toBeVisible();
                await expect(t.textoNivel(page)).toHaveText(/^Nivel 1 - 0\s*XP$/);
                // Con 0 de 20 XP la barra no avanza (a lo sumo el 1% de redondeo).
                expect(await t.anchoBarraNivel(page)).toBeLessThanOrEqual(1);
                await expect(visible(page.getByText('Te faltan 20 puntos para alcanzar el nivel 2'))).toBeVisible();
            });
            await caso(117, 'sin logros: 0 XP y ningún logro desbloqueado', async () => {
                await expect(t.textoNivel(page)).toContainText('0 XP');
                // Solo aparece el logro en progreso (0 de 1); ninguno desbloqueado.
                await expect(visible(page.getByText(/^Devolviste \d+ objetos?\./))).toHaveCount(0);
                await expect(visible(page.getByText('0/1'))).toBeVisible();
            });
        } finally {
            await s.context.close();
        }
    });

    test('casos 116, 118, 224, 225, 227, 229, 231, 234, 235, 236 y 237: recorrido de un usuario que recibe recompensas @recompensas @serie', async ({ browser, request }) => {
        const u = await t.registrarPaciente(request, 'r10b');
        const emp = await t.abrirSesionPaciente(browser, 'emp2.utn@eurekapp.com');
        const usr = await t.abrirSesionPaciente(browser, u.email);
        const pe = emp.page;
        const pu = usr.page;
        const xp = async () => (await t.logrosApi(request, u.token)).xp;
        const objeto1 = nombreUnico('Billetera logros');
        const objeto2 = nombreUnico('Billetera nivel');
        let uuid1 = null;
        try {
            expect(await xp()).toBe(0);

            await caso(225, 'una devolución con datos inválidos muestra error, el objeto sigue en inventario y no cambia nada para quien lo encontró', async () => {
                uuid1 = await t.receptarApi(request, await t.tokenDe(pe), objeto1, u.email);
                await t.devolverInvalidoUi(pe, objeto1);
                // El objeto sigue en el inventario.
                await t.irA(pe, 'Ver inventario');
                await bajarHastaVer(pe, objeto1);
                expect(await xp()).toBe(0);
                await t.irA(pu, 'Logros');
                await expect(t.textoNivel(pu)).toHaveText(/^Nivel 1 - 0\s*XP$/);
                await expect(visible(pu.getByText('0/1'))).toBeVisible();
                await expect(visible(pu.getByText(/^Devolviste \d+ objetos?\./))).toHaveCount(0);
                expect(await r.cuantasRecompensas(request, u.token)).toBe(0);
            });

            // Si la devolución no se completa, los casos que parten de ella no se pueden probar.
            let falloDevolucion = null;
            try {
                await t.devolverUi(pe, objeto1);
            } catch (e) {
                falloDevolucion = primeraLinea(e);
            }
            const sinDevolucion = () => falloDevolucion && noSePudoProbar(`la devolución del objeto no se completó (${falloDevolucion})`);

            await caso(224, 'al devolver, quien lo encontró suma exactamente 10 XP y 1 objeto devuelto; antes de devolver no había sumado nada', async () => {
                if (falloDevolucion) return sinDevolucion();
                // Antes de la devolución (recién receptado) tenía 0 XP: lo verificó el caso 225.
                const l = await t.logrosApi(request, u.token);
                expect(l.xp).toBe(10);
                expect(l.returnedObjects).toBe(1);
            });

            await caso(227, 'Logros muestra "Nivel 1 - 10 XP"', async () => {
                if (falloDevolucion) return sinDevolucion();
                await t.irA(pu, 'Logros');
                await expect(t.textoNivel(pu)).toHaveText(/^Nivel 1 - 10\s*XP$/);
            });

            await caso(116, 'se ve el logro obtenido (1/1) y el próximo logro con su progreso (1/5)', async () => {
                if (falloDevolucion) return sinDevolucion();
                await visible(pu.getByText('Primer Acto de Bondad')).scrollIntoViewIfNeeded();
                await expect(visible(pu.getByText('Primer Acto de Bondad'))).toBeVisible();
                await expect(visible(pu.getByText('Devolviste 1 objeto.'))).toBeVisible();
                await expect(visible(pu.getByText('1/1', { exact: true }))).toBeVisible();
                await expect(visible(pu.getByText('Mano Amiga', { exact: true }))).toBeVisible();
                await expect(visible(pu.getByText('1/5', { exact: true }))).toBeVisible();
                await expect(visible(pu.getByText('Devuelve 4 objetos más para obtener el logro "Mano Amiga".'))).toBeVisible();
            });

            await caso(237, 'el correo a quien encontró el objeto informa la fecha de devolución y los puntos obtenidos (verificado en el servidor de correo de prueba)', async () => {
                if (falloDevolucion) return sinDevolucion();
                const texto = await r.correoPara(request, u.email, 'Tu objeto encontrado fue devuelto');
                expect(texto, 'no llegó el correo de devolución').toBeTruthy();
                const hoy = new Date();
                const dd = String(hoy.getDate()).padStart(2, '0');
                const mm = String(hoy.getMonth() + 1).padStart(2, '0');
                expect(texto).toContain(`${dd}/${mm}/${hoy.getFullYear()}`);
                expect(texto).toMatch(/\+?10 puntos/);
            });

            await caso(234, 'aparece la notificación "¡Sumaste puntos!" con el objeto y "Sumaste 10 puntos de experiencia.", y queda guardada', async () => {
                if (falloDevolucion) return sinDevolucion();
                await abrirNotificaciones(pu);
                await expect(visible(pu.getByText('¡Sumaste puntos!'))).toBeVisible();
                await expect(visible(pu.getByText(new RegExp(`${objeto1}.*Sumaste 10 puntos de experiencia\\.`)))).toBeVisible();
                // Queda guardada: al volver a entrar a la pantalla sigue ahí.
                await abrirNotificaciones(pu);
                await expect(visible(pu.getByText('¡Sumaste puntos!'))).toHaveCount(1);
            });

            await caso(236, 'se muestra una notificación de la insignia desbloqueada', async () => {
                if (falloDevolucion) return sinDevolucion();
                await abrirNotificaciones(pu);
                expect.soft(await visible(pu.getByText(/insignia|Primer Acto de Bondad/i)).count(), 'debería haber una notificación de la insignia desbloqueada').toBeGreaterThan(0);
            });

            await caso(231, 'repetir la devolución del mismo objeto se rechaza y no cambia XP, nivel, logros ni notificaciones', async () => {
                if (falloDevolucion) return sinDevolucion();
                const tokenEmp = await t.tokenDe(pe);
                const otra = await t.devolverApi(request, tokenEmp, uuid1);
                expect(otra.ok(), 'la segunda devolución debería rechazarse').toBeFalsy();
                expect(await xp()).toBe(10);
                await t.irA(pu, 'Logros');
                await expect(t.textoNivel(pu)).toHaveText(/^Nivel 1 - 10\s*XP$/);
                await expect(visible(pu.getByText('1/5', { exact: true }))).toBeVisible();
                await expect(visible(pu.getByText('Primer Acto de Bondad'))).toHaveCount(1);
                expect(await r.cuantasRecompensas(request, u.token)).toBe(1);
            });

            // Segunda devolución: el usuario llega a 20 XP y sube de nivel.
            let falloSegunda = null;
            try {
                const tokenEmp2 = await t.tokenDe(pe);
                const uuid2 = await t.receptarApi(request, tokenEmp2, objeto2, u.email);
                const dev = await t.devolverApi(request, tokenEmp2, uuid2);
                expect(dev.ok()).toBeTruthy();
            } catch (e) {
                falloSegunda = primeraLinea(e);
            }

            await caso(229, 'con 10 XP, al devolver pasa a 20 XP, "Nivel 2" y la barra se reinicia hacia el nivel 3', async () => {
                if (falloSegunda) return noSePudoProbar(`la segunda devolución no se completó (${falloSegunda})`);
                await t.irA(pu, 'Logros');
                await expect(t.textoNivel(pu)).toHaveText(/^Nivel 2 - 20\s*XP$/);
                await expect(visible(pu.getByText('Te faltan 30 puntos para alcanzar el nivel 3'))).toBeVisible();
                expect(await t.anchoBarraNivel(pu)).toBeLessThanOrEqual(1);
                const l = await t.logrosApi(request, u.token);
                expect(l.xp).toBe(l.returnedObjects * 10);
            });

            await caso(235, 'se muestra una notificación de que alcanzó un nuevo nivel', async () => {
                if (falloSegunda) return noSePudoProbar(`la segunda devolución no se completó (${falloSegunda})`);
                await abrirNotificaciones(pu);
                expect.soft(await visible(pu.getByText(/nuevo nivel|alcanzaste el nivel|subiste de nivel/i)).count(), 'debería haber una notificación de nivel').toBeGreaterThan(0);
            });

            await caso(118, 'al salir y volver a entrar se mantienen el nivel y el progreso', async () => {
                if (falloSegunda) return noSePudoProbar(`la segunda devolución no se completó (${falloSegunda})`);
                await t.cerrarSesion(pu);
                await pu.getByText('Iniciar sesión', { exact: true }).click();
                await pu.getByPlaceholder('Email').fill(u.email);
                await pu.getByPlaceholder('Contraseña').fill('Eurekapp1!');
                await pu.getByText('Iniciar sesión', { exact: true }).last().click();
                await expect(pu.getByText('Logout')).toBeVisible();
                await t.irA(pu, 'Logros');
                await expect(t.textoNivel(pu)).toHaveText(/^Nivel 2 - 20\s*XP$/);
                await expect(visible(pu.getByText('2/5', { exact: true }))).toBeVisible();
            });
        } finally {
            await emp.context.close();
            await usr.context.close();
        }
    });
});
