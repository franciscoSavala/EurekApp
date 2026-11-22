// Aviso al dueño de una organización cuando un integrante queda involucrado en una alerta de fraude.
const { test, expect } = require('@playwright/test');
const { USUARIOS, USUARIOS_PARALELO, abrirMenu, nombreUnico } = require('./helpers');
const { casoContinuo: caso, noSePudoProbar } = require('./helpers/t17');
const T = require('./helpers/t12');
const { receptarApi, devolverApi, alertaDelDni, resolverAlertaApi, loginApi } = require('./helpers/t07');
const { dniUnico } = require('./helpers/t04');

const enlaceNotif = (page) => page.locator('a', { has: page.getByText('Notificaciones', { exact: true }) });

test.describe('Aviso de fraude al dueño', () => {
    test('caso 261: el dueño ve el aviso de integrante involucrado en una alerta de fraude @notificaciones @paralelo', async ({ browser, request }) => {
        test.setTimeout(240_000);
        // El test genera su propia alerta: un integrante de la organización devuelve tres objetos con el mismo DNI.
        const dueno = await T.loginConOrg(request, USUARIOS_PARALELO.duenoUnc);
        const emp = await loginApi(request, USUARIOS_PARALELO.empleadoUnc);
        const admin = await loginApi(request, USUARIOS.admin);
        const dni = dniUnico();
        for (let i = 0; i < 3; i++) {
            const uuid = await receptarApi(request, emp.token, emp.orgId, nombreUnico('Objeto aviso fraude'));
            await devolverApi(request, emp.token, emp.orgId, uuid, dni);
        }
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
            // Limpieza: la alerta pasa a falsa alarma y se levanta el bloqueo del integrante.
            const alerta = await alertaDelDni(request, admin.token, dni);
            if (alerta && alerta.status === 'ACTIVE') await resolverAlertaApi(request, admin.token, alerta.id);
            await context.close();
        }
    });
});
