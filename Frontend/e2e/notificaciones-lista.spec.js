// Notificaciones de un usuario: menú, listado, leídas/no leídas, coincidencias y recompensas.
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, nombreUnico, abrirMenu, caso } = require('./helpers');
const { dniUnico } = require('./helpers/t04');
const T = require('./helpers/t12');
const { abrirComo } = T;

const enlaceNotif = (page) => page.locator('a', { has: page.getByText('Notificaciones', { exact: true }) });

test.describe('Notificaciones del usuario', () => {
    test('casos 373, 374, 375, 377, 378, 381, 384 y 385: menú, listado, detalle, leídas, indicador, coincidencia y recompensa @notificaciones @paralelo', async ({ browser, request }) => {
        test.setTimeout(420_000);
        // Usuario nuevo con una búsqueda guardada única: un empleado recepta algo parecido (coincidencia)
        // y otro objeto suyo (él lo encontró) se devuelve a su dueño (recompensa).
        const u = await T.registrarUsuario(request, 'n1');
        const emp = await T.loginConOrg(request, USUARIOS_PARALELO.empleadoAero);
        const descripcion = nombreUnico('billetera negra notificacion');
        await T.guardarBusqueda(request, u.token, descripcion, emp.orgId);
        await T.receptarConFinder(request, emp.token, emp.orgId, descripcion);
        await T.esperarNotificacion(request, u.token, 'MATCH_FOUND');
        const tituloRecompensa = nombreUnico('Objeto encontrado por usuario');
        const uuid = await T.receptarConFinder(request, emp.token, emp.orgId, tituloRecompensa, u.email);
        await T.devolver(request, emp.token, emp.orgId, uuid, dniUnico());
        await T.esperarNotificacion(request, u.token, 'REWARD_EARNED');

        const { context, page } = await abrirComo(browser, u.email);
        try {
            await abrirMenu(page);
            await caso(373, 'el menú lateral muestra la opción Notificaciones', async () => {
                await expect.soft(enlaceNotif(page)).toBeVisible();
            });
            await caso(381, 'con notificaciones sin leer el menú muestra un indicador con la cantidad', async () => {
                await expect.soft(enlaceNotif(page).getByText(/^\d+$/), 'no aparece un número de pendientes junto a Notificaciones').toBeVisible();
            });
            await caso(374, 'elegir Notificaciones lleva a la pantalla de notificaciones', async () => {
                await enlaceNotif(page).click();
                await expect.soft(page).toHaveURL(/NotificationsStackScreen/);
                await expect.soft(page.getByText('Coincidencia encontrada', { exact: true }).locator('visible=true').first()).toBeVisible();
            });

            const titMatch = 'Alguien podría haber encontrado tu objeto';
            const titReward = '¡Obtuviste una recompensa!';
            await caso(375, 'el listado muestra las notificaciones del usuario', async () => {
                await expect.soft(page.getByText(titMatch, { exact: true }).locator('visible=true').first()).toBeVisible();
                await expect.soft(page.getByText(titReward, { exact: true }).locator('visible=true')).toBeVisible();
            });
            await caso(384, 'la coincidencia aparece como notificación con la búsqueda guardada', async () => {
                const t = T.tarjeta(page, titMatch, descripcion);
                await expect.soft(t).toBeVisible();
                await expect.soft(t.getByText('Ver coincidencia', { exact: true })).toBeVisible();
            });
            await caso(385, 'la recompensa aparece como notificación con el objeto y los puntos', async () => {
                const t = T.tarjeta(page, titReward, tituloRecompensa);
                await expect.soft(t).toBeVisible();
                await expect.soft(t.getByText(/Sumaste 10 puntos/)).toBeVisible();
            });

            // Al entrar, la lista llega con todo sin leer; se toca una para tener leídas y no leídas.
            await caso(378, 'las no leídas se distinguen visualmente de las leídas', async () => {
                const match = T.tarjeta(page, titMatch, descripcion);
                const reward = T.tarjeta(page, titReward, tituloRecompensa);
                const antes = await T.fondoDe(match);
                expect.soft(antes, 'la no leída no se distingue de una tarjeta blanca').not.toBe('rgb(255, 255, 255)');
                await reward.click();
                await expect.poll(() => T.fondoDe(reward)).toBe('rgb(255, 255, 255)');
                expect.soft(await T.fondoDe(match)).not.toBe(await T.fondoDe(reward));
            });

            await caso(377, 'seleccionar una notificación muestra su detalle', async () => {
                // La tarjeta ya trae el contenido; el caso pide una vista de detalle al seleccionarla.
                const url = page.url();
                await T.tarjeta(page, titMatch, descripcion).getByText(titMatch, { exact: true }).click();
                await page.waitForTimeout(1000);
                expect.soft(page.url() !== url || !(await page.getByText(titReward, { exact: true }).locator('visible=true').isVisible()),
                    'al seleccionar una notificación no se abre ninguna pantalla de detalle').toBe(true);
            });
        } finally {
            await context.close();
        }
    });

    test('caso 382: un usuario sin notificaciones ve el aviso de que no hay @notificaciones @paralelo', async ({ browser, request }) => {
        test.setTimeout(240_000);
        const u = await T.registrarUsuario(request, 'n2');
        const { context, page } = await abrirComo(browser, u.email);
        try {
            await caso(382, 'se muestra el mensaje de que no hay notificaciones', async () => {
                await abrirMenu(page);
                await enlaceNotif(page).click();
                await expect.soft(page.getByText(/No tenés notificaciones/).locator('visible=true')).toBeVisible();
            });
        } finally {
            await context.close();
        }
    });
});
