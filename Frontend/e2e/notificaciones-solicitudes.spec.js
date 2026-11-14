// Notificaciones de solicitudes de organización y de cambio de rol.
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, abrirMenu, caso } = require('./helpers');
const { empleadosApi, desvincularApi, auth, URL_BACK } = require('./helpers/t08');
const T = require('./helpers/t12');
const { abrirComo } = T;

const enlaceNotif = (page) => page.locator('a', { has: page.getByText('Notificaciones', { exact: true }) });
const irANotificaciones = async (page) => {
    await page.goto('/');
    await abrirMenu(page);
    await enlaceNotif(page).click();
    await expect(page.getByText('Cambio de rol', { exact: true }).or(page.getByText('Solicitud de organización', { exact: true })).or(page.getByText(/No tenés notificaciones/)).locator('visible=true').first()).toBeVisible();
};

test.describe('Notificaciones de solicitudes y cambio de rol', () => {
    test('casos 376, 379, 380 y 383: solicitud recibida, aceptar, rechazar y cambio de rol @notificaciones @paralelo', async ({ browser, request }) => {
        test.setTimeout(480_000);
        // El dueño de la organización 5 invita a dos usuarios nuevos: uno acepta y el otro rechaza.
        const dueno = await T.loginConOrg(request, USUARIOS_PARALELO.duenoUnc);
        const acepta = await T.registrarUsuario(request, 'sa');
        const rechaza = await T.registrarUsuario(request, 'sr');
        const contextos = [];
        try {
            await T.invitarApi(request, dueno.token, acepta.email);
            await T.invitarApi(request, dueno.token, rechaza.email);

            const a = await abrirComo(browser, acepta.email);
            contextos.push(a.context);
            await irANotificaciones(a.page);
            await caso(376, 'la solicitud recibida muestra título, descripción, fecha y hora, y estado', async () => {
                const t = T.tarjeta(a.page, 'Solicitud de organización', 'quiere que te unas a su organización');
                await expect.soft(t.getByText('Solicitud de organización', { exact: true }).last()).toBeVisible();
                await expect.soft(t.getByText(/quiere que te unas a su organización/)).toBeVisible();
                await expect.soft(t.getByText(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/), 'no se ve fecha y hora').toBeVisible();
                await expect.soft(t.getByText(/Pendiente|Aceptada|Rechazada/), 'la solicitud no muestra su estado').toBeVisible({ timeout: 2000 });
            });

            await caso(379, 'Aceptar suma a la persona a la organización y la solicitud deja de estar pendiente', async () => {
                const t = T.tarjeta(a.page, 'Solicitud de organización', 'quiere que te unas a su organización');
                await t.getByText('Aceptar', { exact: true }).click();
                await expect.soft(a.page.getByText('¡Solicitud aceptada!').locator('visible=true')).toBeVisible();
                // La web se recarga sola y el menú pasa a ser el de un empleado.
                await expect(a.page.getByText('Logout')).toBeVisible({ timeout: 20000 });
                await irANotificaciones(a.page);
                await expect.soft(T.tarjeta(a.page, 'Solicitud de organización', 'quiere que te unas a su organización').getByText('Aceptar', { exact: true })).toHaveCount(0);
                const emp = (await empleadosApi(request, dueno.token)).find((e) => e.username === acepta.email);
                expect.soft(emp, 'la persona no figura entre los empleados de la organización').toBeTruthy();
            });

            await caso(383, 'al recibir el rol de encargado aparece la notificación del cambio de rol', async () => {
                const emp = (await empleadosApi(request, dueno.token)).find((e) => e.username === acepta.email);
                await T.asignarEncargadoApi(request, dueno.token, emp.id);
                await irANotificaciones(a.page);
                const t = T.tarjeta(a.page, 'Nuevo rol asignado', 'encargado');
                await expect.soft(t.getByText('Cambio de rol', { exact: true })).toBeVisible();
                await expect.soft(t.getByText(/Fuiste designado como encargado/)).toBeVisible();
            });

            const r = await abrirComo(browser, rechaza.email);
            contextos.push(r.context);
            await irANotificaciones(r.page);
            await caso(380, 'Rechazar descarta la solicitud y la persona no entra a la organización', async () => {
                const t = T.tarjeta(r.page, 'Solicitud de organización', 'quiere que te unas a su organización');
                await t.getByText('Rechazar', { exact: true }).click();
                await expect.soft(T.tarjeta(r.page, 'Solicitud de organización', 'quiere que te unas a su organización').getByText('Rechazar', { exact: true })).toHaveCount(0);
                // Los botones desaparecen al instante; el servidor confirma un momento después.
                await expect.configure({ soft: true }).poll(async () => {
                    const pend = await request.get(`${URL_BACK}/organizations/getPendingAddEmployeeRequests`, { headers: auth(rechaza.token) });
                    return (await pend.json()).requests.length;
                }, { message: 'la solicitud sigue pendiente' }).toBe(0);
                expect.soft((await empleadosApi(request, dueno.token)).some((e) => e.username === rechaza.email), 'la persona entró igual a la organización').toBe(false);
            });
        } finally {
            for (const c of contextos) await c.close();
            await desvincularApi(request, dueno.token, acepta.email);
            await desvincularApi(request, dueno.token, rechaza.email);
        }
    });
});
