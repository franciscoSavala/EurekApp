// Aviso al dueño de una organización cuando un integrante queda involucrado en una alerta de fraude.
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, abrirMenu } = require('./helpers');
const { casoContinuo: caso, noSePudoProbar } = require('./helpers/t17');
const T = require('./helpers/t12');

const enlaceNotif = (page) => page.locator('a', { has: page.getByText('Notificaciones', { exact: true }) });

test.describe('Aviso de fraude al dueño', () => {
    test('caso 261: el dueño ve el aviso de integrante involucrado en una alerta de fraude @notificaciones @paralelo', async ({ browser, request }) => {
        test.setTimeout(240_000);
        // El dueño de la organización 5 ya recibió el aviso cuando la app generó alertas con empleados de su organización.
        const dueno = await T.loginConOrg(request, USUARIOS_PARALELO.duenoUnc);
        const hay = (await T.notificacionesApi(request, dueno.token)).some((n) => n.type === 'FRAUD_EMPLOYEE_INVOLVED');
        const { context, page } = await T.abrirComo(browser, USUARIOS_PARALELO.duenoUnc);
        try {
            await caso(261, 'el dueño abre Notificaciones y ve "Integrante involucrado en una alerta de fraude"', async () => {
                if (!hay) return noSePudoProbar('el dueño no tiene ninguna alerta de fraude con un integrante de su organización');
                await page.goto('/');
                await abrirMenu(page);
                await enlaceNotif(page).click();
                await expect.soft(page.getByText('Integrante involucrado en una alerta de fraude', { exact: true }).locator('visible=true').first()).toBeVisible();
            });
        } finally {
            await context.close();
        }
    });
});
