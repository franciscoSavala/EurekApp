const { test, expect } = require('@playwright/test');
const { caso, nombreUnico } = require('./helpers');
const t = require('./helpers/t13');

const { visible } = t;

/** Notificaciones del usuario, abiertas por el menú. */
async function abrirNotificaciones(page) {
    await t.irA(page, 'Notificaciones');
    await page.waitForTimeout(2000);
}

test.describe('logros y recompensas de un usuario nuevo', () => {
    test.setTimeout(600_000);

    test('casos 135, 136, 137, 138, 140 y 330: pantalla de Logros de un usuario sin logros @recompensas @serie', async ({ browser, request }) => {
        const u = await t.registrarPaciente(request, 't13a');
        const s = await t.abrirSesionPaciente(browser, u.email);
        const page = s.page;
        try {
            await caso(135, 'desde el menú, Logros muestra la pantalla de logros', async () => {
                await t.irA(page, 'Logros');
                await expect(visible(page.getByText('Logros:'))).toBeVisible();
            });
            await caso(136, 'arriba se ve el nivel y la experiencia ("Nivel 1 - 0 XP")', async () => {
                await expect(t.textoNivel(page)).toHaveText(/^Nivel 1 - 0\s*XP$/);
            });
            await caso(137, 'la barra de progreso está vacía con 0 XP', async () => {
                // Con 0 de 20 XP la barra no avanza (a lo sumo el 1% de redondeo).
                expect(await t.anchoBarraNivel(page)).toBeLessThanOrEqual(1);
            });
            await caso(138, 'se muestra el mensaje de cuánto falta para el próximo nivel', async () => {
                await expect(visible(page.getByText('Te faltan 20 puntos para alcanzar el nivel 2'))).toBeVisible();
            });
            await caso(140, 'sin logros: 0 XP y ningún logro desbloqueado', async () => {
                await expect(t.textoNivel(page)).toContainText('0 XP');
                // Solo aparece el logro en progreso (0 de 1); ninguno desbloqueado.
                await expect(visible(page.getByText(/^Devolviste \d+ objetos?\./))).toHaveCount(0);
                await expect(visible(page.getByText('0/1'))).toBeVisible();
            });
            await caso(330, 'el nivel se muestra con su título (por ejemplo "Explorador novato")', async () => {
                const texto = await t.textoNivel(page).innerText();
                // La app muestra solo el número del nivel, sin un título.
                expect.soft(texto, 'el nivel debería llevar un título, no solo un número').not.toMatch(/^Nivel \d+ - /);
            });
        } finally {
            await s.context.close();
        }
    });

    test('casos 139, 141, 142, 319, 320, 321, 322, 325, 326, 327, 328, 331, 332, 333, 337, 338, 339, 340, 345, 347, 348, 349, 350, 351 y 352: recorrido de un usuario que recibe recompensas @recompensas @serie', async ({ browser, request }) => {
        const u = await t.registrarPaciente(request, 't13b');
        const emp = await t.abrirSesionPaciente(browser, 'emp2.utn@eurekapp.com');
        const usr = await t.abrirSesionPaciente(browser, u.email);
        const pe = emp.page;
        const pu = usr.page;
        const xp = async () => (await t.logrosApi(request, u.token)).xp;
        const objeto1 = nombreUnico('Billetera logros');
        const objeto2 = nombreUnico('Billetera nivel');
        try {
            const xp0 = await xp();
            expect(xp0).toBe(0);

            await caso(320, 'un registro de objeto con datos inválidos no suma puntos', async () => {
                await t.irA(pe, 'Receptar un objeto');
                await pe.getByPlaceholder('Ingresa el email del usuario').fill(u.email);
                await pe.getByText('Receptar objeto encontrado', { exact: true }).click();
                await expect(pe.getByText('El objeto fue cargado al inventario con éxito.')).toHaveCount(0);
                expect(await xp()).toBe(xp0);
            });

            await caso(319, 'registrar un objeto encontrado suma 10 puntos a quien lo encontró', async () => {
                await t.receptarUi(pe, objeto1, u.email);
                // Los puntos del hallazgo solo se dan al devolver el objeto: al receptarlo no se suma nada.
                expect.soft(await xp(), 'receptar el objeto debería sumar 10 puntos').toBe(xp0 + 10);
            });

            await caso(322, 'una devolución con datos inválidos no se completa ni suma puntos', async () => {
                await t.devolverInvalidoUi(pe, objeto1);
                expect(await xp()).toBe(0);
            });

            await caso(331, 'tras una devolución fallida no cambian el nivel ni el progreso', async () => {
                await t.irA(pu, 'Logros');
                await expect(t.textoNivel(pu)).toHaveText(/^Nivel 1 - 0\s*XP$/);
                await expect(visible(pu.getByText('0/1'))).toBeVisible();
            });

            const antes = await xp();
            await t.devolverUi(pe, objeto1);

            await caso(321, 'una devolución exitosa suma 20 puntos', async () => {
                const despues = await xp();
                expect.soft(despues - antes, 'la devolución debería sumar 20 puntos').toBe(20);
            });

            await caso(325, 'el total de puntos se actualiza sumando los puntos de la acción', async () => {
                const despues = await xp();
                expect(despues).toBeGreaterThan(antes);
                await t.irA(pu, 'Logros');
                expect(await t.xpEnPantalla(pu)).toBe(despues);
            });

            await caso(327, 'Logros muestra el total de puntos actualizado', async () => {
                await expect(t.textoNivel(pu)).toContainText(`${await xp()} XP`);
            });

            await caso(141, 'después de devolver, Logros muestra la XP y el progreso actualizados', async () => {
                await expect(visible(pu.getByText('1/5'))).toBeVisible();
                await expect(visible(pu.getByText('Te faltan 10 puntos para alcanzar el nivel 2'))).toBeVisible();
                // 10 de 20 XP: la barra queda a la mitad.
                const ancho = await t.anchoBarraNivel(pu);
                expect(ancho).toBeGreaterThan(45);
                expect(ancho).toBeLessThan(55);
            });

            await caso(328, 'la devolución exitosa aumenta el progreso del usuario', async () => {
                await expect(t.textoNivel(pu)).not.toHaveText(/^Nivel 1 - 0\s*XP$/);
                expect((await t.logrosApi(request, u.token)).returnedObjects).toBe(1);
            });

            await caso(333, 'la primera devolución otorga la insignia correspondiente', async () => {
                await expect(visible(pu.getByText('Primer Acto de Bondad'))).toBeVisible();
                await expect(visible(pu.getByText('Devolviste 1 objeto.'))).toBeVisible();
            });

            await caso(139, 'con logros, la lista de logros se ve al bajar por la pantalla', async () => {
                await visible(pu.getByText('Primer Acto de Bondad')).scrollIntoViewIfNeeded();
                await expect(visible(pu.getByText('Primer Acto de Bondad'))).toBeVisible();
                await expect(visible(pu.getByText('Mano Amiga', { exact: true }))).toBeVisible();
            });

            await caso(338, 'las insignias desbloqueadas se muestran en Logros', async () => {
                await expect(visible(pu.getByText('Devolviste 1 objeto.'))).toHaveCount(1);
            });

            await caso(339, 'se muestra el progreso hacia la próxima insignia', async () => {
                await expect(visible(pu.getByText(/Devuelve 4 objetos más para obtener el logro "Mano Amiga"/))).toBeVisible();
            });

            await caso(337, 'una acción positiva definida por la organización otorga una insignia de comportamiento', async () => {
                // Las únicas insignias son por objetos devueltos: no hay ninguna de comportamiento positivo.
                expect.soft(await visible(pu.getByText(/comportamiento positivo/i)).count(), 'debería existir una insignia de comportamiento positivo').toBeGreaterThan(0);
            });

            await caso(340, 'no se otorga dos veces la misma insignia', async () => {
                await expect(visible(pu.getByText('Primer Acto de Bondad'))).toHaveCount(1);
            });

            await caso(332, 'repetir la misma devolución no suma progreso otra vez', async () => {
                const tokenEmp = await t.tokenDe(pe);
                const uuidDevuelto = await (async () => {
                    // Se vuelve a intentar con el mismo objeto devuelto: el servidor lo rechaza.
                    const r = await request.get(`${t.URL_BACK}/found-objects/getReturnedObjects`, { headers: { Authorization: `Bearer ${tokenEmp}` } });
                    const lista = await r.json();
                    const todos = Array.isArray(lista) ? lista : (lista.returned_objects ?? lista.found_objects ?? []);
                    const el = todos.find((o) => o.title === objeto1);
                    return el?.id;
                })();
                if (uuidDevuelto) {
                    const otra = await t.devolverApi(request, tokenEmp, uuidDevuelto);
                    expect(otra.ok()).toBeFalsy();
                }
                await t.irA(pu, 'Logros');
                expect(await t.xpEnPantalla(pu)).toBe(10);
                await expect(visible(pu.getByText('1/5'))).toBeVisible();
            });

            await caso(347, 'recargar la pantalla no vuelve a dar puntos por lo ya logrado', async () => {
                await pu.reload();
                await expect(t.textoNivel(pu)).toContainText('10 XP');
            });

            await caso(350, 'se avisa que se desbloqueó una insignia', async () => {
                await abrirNotificaciones(pu);
                // La única notificación habla de puntos; no hay aviso de insignia.
                expect.soft(await visible(pu.getByText(/insignia|Primer Acto de Bondad/i)).count(), 'debería haber una notificación de insignia').toBeGreaterThan(0);
            });

            await caso(348, 'se muestra una notificación con la cantidad de puntos obtenidos', async () => {
                await expect.soft(visible(pu.getByText(/Sumaste 10 puntos/))).toBeVisible();
            });

            await caso(351, 'la notificación muestra el tipo de recompensa y la información asociada', async () => {
                await expect.soft(visible(pu.getByText('Recompensa obtenida', { exact: true }))).toBeVisible();
                await expect.soft(visible(pu.getByText('¡Obtuviste una recompensa!'))).toBeVisible();
                await expect.soft(visible(pu.getByText(new RegExp(`${objeto1}.*10 puntos`)))).toBeVisible();
            });

            await caso(326, 'queda registrado el motivo por el que se otorgaron los puntos', async () => {
                // El único registro es la notificación, que dice que el objeto fue devuelto a su dueño.
                await expect.soft(visible(pu.getByText(/fue devuelto a su dueño\. Sumaste 10 puntos/))).toBeVisible();
            });

            await caso(352, 'no se repite la notificación de una recompensa ya avisada', async () => {
                await pu.reload();
                await abrirNotificaciones(pu);
                expect(await visible(pu.getByText('¡Obtuviste una recompensa!')).count()).toBeLessThanOrEqual(1);
            });

            // Segunda devolución: el usuario llega a 20 XP y sube de nivel.
            const tokenEmp2 = await t.tokenDe(pe);
            const uuid2 = await t.receptarApi(request, tokenEmp2, objeto2, u.email);
            const r2 = await t.devolverApi(request, tokenEmp2, uuid2);
            expect(r2.ok()).toBeTruthy();

            await caso(349, 'se avisa que el usuario alcanzó un nuevo nivel', async () => {
                await t.irA(pu, 'Logros');
                await expect(t.textoNivel(pu)).toHaveText(/^Nivel 2 - 20\s*XP$/);
                await abrirNotificaciones(pu);
                expect.soft(await visible(pu.getByText(/nuevo nivel|alcanzaste el nivel|subiste de nivel/i)).count(), 'debería haber una notificación de nivel').toBeGreaterThan(0);
            });

            await caso(345, 'los puntos coinciden con la cantidad de objetos devueltos por 10', async () => {
                const l = await t.logrosApi(request, u.token);
                expect(l.xp).toBe(l.returnedObjects * 10);
                await t.irA(pu, 'Logros');
                expect(await t.xpEnPantalla(pu)).toBe(l.returnedObjects * 10);
            });

            await caso(142, 'al salir y volver a entrar se mantienen el nivel y el progreso', async () => {
                await t.cerrarSesion(pu);
                await pu.getByText('Iniciar sesión', { exact: true }).click();
                await pu.getByPlaceholder('Email').fill(u.email);
                await pu.getByPlaceholder('Contraseña').fill('Eurekapp1!');
                await pu.getByText('Iniciar sesión', { exact: true }).last().click();
                await expect(pu.getByText('Logout')).toBeVisible();
                await t.irA(pu, 'Logros');
                await expect(t.textoNivel(pu)).toHaveText(/^Nivel 2 - 20\s*XP$/);
                await expect(visible(pu.getByText('2/5'))).toBeVisible();
            });
        } finally {
            await emp.context.close();
            await usr.context.close();
        }
    });
});
