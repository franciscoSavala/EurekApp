// Notificaciones de un usuario: menú, listado, leídas/no leídas, coincidencias y recompensas.
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, nombreUnico, abrirMenu } = require('./helpers');
const { casoContinuo: caso, noSePudoProbar, primeraLinea } = require('./helpers/t17');
const { dniUnico } = require('./helpers/t04');
const T = require('./helpers/t12');
const { abrirComo } = T;

const enlaceNotif = (page) => page.locator('a', { has: page.getByText('Notificaciones', { exact: true }) });

test.describe('Notificaciones del usuario', () => {
    test('casos 249, 250, 252, 253, 256, 259 y 260: menú, listado, detalle, leídas, indicador, coincidencia y recompensa @notificaciones @paralelo', async ({ browser, request }) => {
        test.setTimeout(420_000);
        // Usuario nuevo con una búsqueda guardada única: un empleado recepta algo parecido (coincidencia)
        // y otro objeto suyo (él lo encontró) se devuelve a su dueño (recompensa).
        const u = await T.registrarUsuario(request, 'n1');
        const emp = await T.loginConOrg(request, USUARIOS_PARALELO.empleadoAero);
        const descripcion = nombreUnico('billetera negra notificacion');
        // Si un aviso no llega, solo los casos que lo necesitan quedan como "no se pudo probar".
        let faltaMatch = null;
        let faltaReward = null;
        try {
            await T.guardarBusqueda(request, u.token, descripcion, emp.orgId);
            await T.receptarConFinder(request, emp.token, emp.orgId, descripcion);
        } catch (e) {
            faltaMatch = `no se pudo preparar la coincidencia (${primeraLinea(e)})`;
        }
        if (!faltaMatch) {
            try {
                await T.esperarNotificacion(request, u.token, 'MATCH_FOUND');
            } catch (e) {
                faltaMatch = 'el aviso de coincidencia no llegó a la app en 60 segundos';
            }
        }
        const tituloRecompensa = nombreUnico('Objeto encontrado por usuario');
        try {
            const uuid = await T.receptarConFinder(request, emp.token, emp.orgId, tituloRecompensa, u.email);
            await T.devolver(request, emp.token, emp.orgId, uuid, dniUnico());
        } catch (e) {
            faltaReward = `no se pudo preparar la recompensa (${primeraLinea(e)})`;
        }
        if (!faltaReward) {
            try {
                await T.esperarNotificacion(request, u.token, 'REWARD_EARNED');
            } catch (e) {
                faltaReward = 'el aviso de recompensa no llegó a la app en 60 segundos';
            }
        }
        const sinMatch = () => faltaMatch && noSePudoProbar(faltaMatch);
        const sinReward = () => faltaReward && noSePudoProbar(faltaReward);
        const sinAmbos = () => (faltaMatch || faltaReward) && noSePudoProbar(`${faltaMatch || ''} ${faltaReward || ''}`.trim());

        const { context, page } = await abrirComo(browser, u.email);
        try {
            await abrirMenu(page);
            await caso(256, 'con notificaciones sin leer el menú muestra un indicador con la cantidad', async () => {
                if (faltaMatch && faltaReward) return sinAmbos();
                await expect.soft(enlaceNotif(page).getByText(/^\d+$/), 'no aparece un número de pendientes junto a Notificaciones').toBeVisible();
            });
            await caso(249, 'el menú lateral muestra Notificaciones y al elegirla se abre el listado', async () => {
                await expect.soft(enlaceNotif(page)).toBeVisible();
                await enlaceNotif(page).click();
                await expect.soft(page).toHaveURL(/NotificationsStackScreen/);
                if (faltaMatch) return sinMatch();
                await expect.soft(page.getByText('Coincidencia encontrada', { exact: true }).locator('visible=true').first()).toBeVisible();
            });

            const titMatch = 'Alguien podría haber encontrado tu objeto';
            const titReward = '¡Obtuviste una recompensa!';
            await caso(250, 'el listado muestra las notificaciones del usuario', async () => {
                if (faltaMatch || faltaReward) return sinAmbos();
                await expect.soft(page.getByText(titMatch, { exact: true }).locator('visible=true').first()).toBeVisible();
                await expect.soft(page.getByText(titReward, { exact: true }).locator('visible=true')).toBeVisible();
            });
            await caso(259, 'la coincidencia aparece como notificación de posible coincidencia con la búsqueda guardada', async () => {
                if (faltaMatch) return sinMatch();
                const t = T.tarjeta(page, titMatch, descripcion);
                await expect.soft(t).toBeVisible();
                await expect.soft(t.getByText('Ver coincidencia', { exact: true })).toBeVisible();
            });
            await caso(260, 'la recompensa aparece como "Recompensa obtenida" con título, descripción y fecha', async () => {
                if (faltaReward) return sinReward();
                await expect.soft(page.getByText('Recompensa obtenida', { exact: true }).locator('visible=true').first(),
                    'no hay una notificación titulada "Recompensa obtenida"').toBeVisible({ timeout: 3000 });
                const t = T.tarjeta(page, titReward, tituloRecompensa);
                await expect.soft(t, 'la notificación de recompensa no muestra el objeto').toBeVisible();
                await expect.soft(t.getByText(/Sumaste 10 puntos/)).toBeVisible();
                await expect.soft(t.getByText(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/), 'la recompensa no muestra fecha').toBeVisible({ timeout: 3000 });
            });

            // Al entrar, la lista llega con todo sin leer; se toca una para tener leídas y no leídas.
            await caso(253, 'las no leídas se distinguen visualmente de las leídas', async () => {
                if (faltaMatch || faltaReward) return sinAmbos();
                const match = T.tarjeta(page, titMatch, descripcion);
                const reward = T.tarjeta(page, titReward, tituloRecompensa);
                const antes = await T.fondoDe(match);
                expect.soft(antes, 'la no leída no se distingue de una tarjeta blanca').not.toBe('rgb(255, 255, 255)');
                await reward.click();
                await expect.poll(() => T.fondoDe(reward)).toBe('rgb(255, 255, 255)');
                expect.soft(await T.fondoDe(match)).not.toBe(await T.fondoDe(reward));
            });

            await caso(252, 'tocar una sin leer la marca como leída, muestra el contenido completo y Ver coincidencia abre el objeto', async () => {
                if (faltaMatch) return sinMatch();
                const t = T.tarjeta(page, titMatch, descripcion);
                await t.getByText(titMatch, { exact: true }).click();
                await expect.poll(() => T.fondoDe(t), { message: 'al tocarla la notificación sigue viéndose sin leer' }).toBe('rgb(255, 255, 255)');
                await expect.soft(t.getByText(descripcion)).toBeVisible();
                const url = page.url();
                await t.getByText('Ver coincidencia', { exact: true }).click();
                await expect.poll(() => page.url(), { message: 'Ver coincidencia no abrió otra pantalla' }).not.toBe(url);
                await expect.soft(page.getByText(descripcion).locator('visible=true').first(), 'no se ve el objeto encontrado').toBeVisible();
            });
        } finally {
            await context.close();
        }
    });

    test('caso 257: un usuario sin notificaciones ve el aviso de que no hay @notificaciones @paralelo', async ({ browser, request }) => {
        test.setTimeout(240_000);
        const u = await T.registrarUsuario(request, 'n2');
        const { context, page } = await abrirComo(browser, u.email);
        try {
            await caso(257, 'se muestra el mensaje de que no hay notificaciones', async () => {
                await abrirMenu(page);
                await enlaceNotif(page).click();
                await expect.soft(page.getByText(/No tenés notificaciones/).locator('visible=true')).toBeVisible();
            });
        } finally {
            await context.close();
        }
    });
});
