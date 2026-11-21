const { test, expect } = require('@playwright/test');
const { casoContinuo: caso } = require('./helpers/t17');
const t = require('./helpers/t13');
const r = require('./helpers/r10');

const { visible } = t;

test.describe('hitos de objetos devueltos y niveles', () => {
    test.setTimeout(600_000);

    test('casos 115, 232 y 233: insignias por hito, subida de niveles 2 a 5 y nivel máximo @recompensas @serie', async ({ browser, request }) => {
        // Cuatro usuarios con 0, 4, 9 y 19 devoluciones previas (después de la primera devolución de A: 10, 40, 90 y 190 XP).
        const previas = { A: 0, B: 4, C: 9, D: 19 };
        const us = {};
        for (const k of Object.keys(previas)) us[k] = await t.registrarPaciente(request, `r10${k.toLowerCase()}`);
        const emp = await t.abrirSesionPaciente(browser, 'emp2.utn@eurekapp.com');
        const sesiones = {};
        for (const k of Object.keys(us)) sesiones[k] = await t.abrirSesionPaciente(browser, us[k].email);
        const tokenEmp = await t.tokenDe(emp.page);
        try {
            // Preparación: las devoluciones previas de cada usuario (los usuarios van en paralelo).
            await Promise.all(Object.keys(previas).map((k) => r.devolverVarios(request, tokenEmp, us[k].email, previas[k], `Hito ${k}`)));
            for (const k of Object.keys(previas)) expect((await t.logrosApi(request, us[k].token)).xp).toBe(previas[k] * 10);

            await caso(233, 'la devolución que completa 1, 5, 10 y 20 objetos otorga el logro del hito (el hito de 50 no se prueba: exige 49 devoluciones previas)', async () => {
                await Promise.all(Object.keys(us).map((k) => r.devolverVarios(request, tokenEmp, us[k].email, 1, `Hito ${k} final`)));
                const hito = { A: ['Primer Acto de Bondad', 'Devolviste 1 objeto.'], B: ['Mano Amiga', 'Devolviste 5 objetos.'], C: ['Buen Samaritano', 'Devolviste 10 objetos.'], D: ['Guardián de la Comunidad', 'Devolviste 20 objetos.'] };
                for (const [k, [nombre, texto]] of Object.entries(hito)) {
                    await t.irA(sesiones[k].page, 'Logros');
                    await expect(visible(sesiones[k].page.getByText(nombre, { exact: true })).first(), `logro ${nombre}`).toBeVisible();
                    await expect(visible(sesiones[k].page.getByText(texto)), `texto de ${nombre}`).toBeVisible();
                }
            });

            await caso(232, 'una devolución a usuarios con 10, 40, 90 y 190 XP los pasa a los niveles 2, 3, 4 y 5', async () => {
                // A tenía 10 XP: su segunda devolución lo lleva a 20. B, C y D llegaron a 50, 100 y 200 con la devolución anterior.
                await r.devolverVarios(request, tokenEmp, us.A.email, 1, 'Nivel A');
                const esperado = { A: [2, 20], B: [3, 50], C: [4, 100], D: [5, 200] };
                for (const [k, [nivel, puntos]] of Object.entries(esperado)) {
                    await t.irA(sesiones[k].page, 'Logros');
                    await expect(t.textoNivel(sesiones[k].page), `usuario ${k}`).toHaveText(new RegExp(`^Nivel ${nivel} - ${puntos}\\s*XP$`));
                }
            });

            await caso(115, 'con 200 XP (nivel 5, el máximo) se muestra "¡Alcanzaste la cima!" y no el texto de puntos que faltan', async () => {
                const page = sesiones.D.page;
                await t.irA(page, 'Logros');
                await expect(visible(page.getByText('¡Alcanzaste la cima!'))).toBeVisible();
                await expect(visible(page.getByText(/Te falta(n)? \d+ punto/))).toHaveCount(0);
            });
        } finally {
            await emp.context.close();
            for (const k of Object.keys(sesiones)) await sesiones[k].context.close();
        }
    });
});
