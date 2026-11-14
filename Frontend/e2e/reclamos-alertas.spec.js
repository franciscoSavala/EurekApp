// "Reclamos" de la planilla: en la app el único listado con estados, resolución y notificación es el
// de alertas de fraude, que ve solo el administrador de EurekApp. La app no tiene un listado de reclamos.
const { test, expect } = require('@playwright/test');
const { USUARIOS, USUARIOS_PARALELO, nombreUnico, irAlMenu, abrirMenu, caso } = require('./helpers');
const { dniUnico } = require('./helpers/t04');
const { loginApi, alertaDelDni, resolverAlertaApi } = require('./helpers/t07');
const { aceptarInvitacionApi, empleadosApi, desvincularApi } = require('./helpers/t08');
const T = require('./helpers/t12');
const { abrirComo } = T;

const MOTIVO_CASO_2 = 'Posible acuerdo entre quien registra y quien retira';

test.describe('Reclamos y alertas de fraude', () => {
    test('casos 265 a 270 y 370 a 372: alerta generada por un encargado, detalle, falsa alarma, resolución y listado @reclamos @serie', async ({ browser, request }) => {
        test.setTimeout(420_000);
        const dueno = await T.loginConOrg(request, USUARIOS_PARALELO.duenoUnc);
        const admin = await loginApi(request, USUARIOS.admin);
        // Encargado propio de la corrida (organización 5) y un usuario que figura como quien encontró los objetos.
        const enc = await T.registrarUsuario(request, 'enc');
        const finder = await T.registrarUsuario(request, 'fnd');
        const dni = dniUnico();
        const contextos = [];
        try {
            await T.invitarApi(request, dueno.token, enc.email);
            await aceptarInvitacionApi(request, enc);
            const fila = (await empleadosApi(request, dueno.token)).find((e) => e.username === enc.email);
            await T.asignarEncargadoApi(request, dueno.token, fila.id);
            const sesion = await T.loginConOrg(request, enc.email);

            // Tres devoluciones del mismo DNI, con los objetos registrados por el mismo usuario.
            for (let i = 0; i < 3; i++) {
                const uuid = await T.receptarConFinder(request, sesion.token, sesion.orgId, nombreUnico('Objeto alerta'), finder.email);
                await T.devolver(request, sesion.token, sesion.orgId, uuid, dni);
            }

            const ad = await abrirComo(browser, USUARIOS.admin);
            contextos.push(ad.context);
            const pa = ad.page;
            const lista = async () => {
                await pa.goto('/');
                await irAlMenu(pa, 'Alertas de fraude');
                await expect(pa.getByText('Ver reporte', { exact: true }).locator('visible=true')).toBeVisible();
            };
            const dniCard = () => pa.getByText(`DNI: ${dni}`, { exact: true }).locator('visible=true');

            await caso(265, 'tras los registros sospechosos del encargado el sistema genera la alerta', async () => {
                const alerta = await alertaDelDni(request, admin.token, dni);
                expect.soft(alerta, 'no se generó ninguna alerta').toBeTruthy();
                await lista();
                await expect.soft(dniCard()).toBeVisible();
            });

            await caso(266, 'el análisis relaciona al usuario que registra con quien retira', async () => {
                await dniCard().click();
                await expect.soft(pa.getByText('Motivo', { exact: true }).locator('visible=true')).toBeVisible();
                await expect.soft(pa.getByText(new RegExp(MOTIVO_CASO_2)).locator('visible=true').first()).toBeVisible();
                await expect.soft(pa.getByText(finder.email, { exact: true }).locator('visible=true')).toBeVisible();
            });

            await caso(268, 'en el detalle de la alerta se puede elegir "Fraude confirmado" y guardar', async () => {
                await expect.soft(pa.getByText(/Fraude confirmado/).locator('visible=true').first(), 'el detalle solo ofrece "Marcar falsa alarma"').toBeVisible({ timeout: 2000 });
            });

            await caso(269, 'marcar falso positivo actualiza el estado de la alerta', async () => {
                await pa.getByText('Marcar falsa alarma', { exact: true }).locator('visible=true').click();
                await pa.getByText('Marcar falsa alarma', { exact: true }).locator('visible=true').last().click();
                await expect.soft(pa.getByText('Falsa alarma', { exact: true }).locator('visible=true').first()).toBeVisible();
                await expect.poll(async () => (await alertaDelDni(request, admin.token, dni)).status).toBe('FALSE_POSITIVE');
            });

            await caso(270, 'la alerta resuelta registra estado final, quién la resolvió y la fecha', async () => {
                await expect.soft(pa.getByText('Resuelto por', { exact: true }).locator('visible=true')).toBeVisible();
                await expect.soft(pa.getByText(USUARIOS.admin, { exact: true }).locator('visible=true').first()).toBeVisible();
                await expect.soft(pa.getByText('Fecha de resolución', { exact: true }).locator('visible=true')).toBeVisible();
                await expect.soft(pa.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/).locator('visible=true').first()).toBeVisible();
            });

            // El encargado ya está desbloqueado (la alerta fue falsa alarma) y puede entrar.
            const en = await abrirComo(browser, enc.email);
            contextos.push(en.context);
            await caso(267, 'el encargado recibe una notificación sobre el posible caso de fraude', async () => {
                await abrirMenu(en.page);
                await en.page.locator('a', { has: en.page.getByText('Notificaciones', { exact: true }) }).click();
                await expect.soft(en.page.getByText(/^(Alerta de fraude|Integrante involucrado en fraude|Posible caso de fraude)$/).locator('visible=true').first(), 'el encargado no recibe ningún aviso del posible caso de fraude (solo el de bloqueo levantado al resolver)').toBeVisible({ timeout: 5000 });
            });

            await caso(370, 'el encargado ve el listado y sigue el cambio de estado sin recargar', async () => {
                await en.page.goto('/');
                await abrirMenu(en.page);
                const opcion = en.page.locator('a', { has: en.page.getByText(/Alertas de fraude|Reclamos/) });
                await expect.soft(opcion, 'el menú del encargado no tiene ningún listado de reclamos ni de alertas').toBeVisible({ timeout: 3000 });
            });

            await caso(371, 'el listado destaca los casos urgentes o prioritarios', async () => {
                await lista();
                await expect.soft(pa.getByText(/urgente|prioridad|prioritari/i).locator('visible=true').first(), 'el listado no tiene ningún indicador de prioridad').toBeVisible({ timeout: 2000 });
            });

            await caso(372, 'el listado se puede ordenar por estado o prioridad', async () => {
                await expect.soft(pa.getByText(/Ordenar/i).locator('visible=true').first(), 'el listado no ofrece ordenar').toBeVisible({ timeout: 2000 });
            });
        } finally {
            for (const c of contextos) await c.close();
            const a = await alertaDelDni(request, admin.token, dni).catch(() => null);
            if (a && a.status === 'ACTIVE') await resolverAlertaApi(request, admin.token, a.id);
            await desvincularApi(request, dueno.token, enc.email);
        }
    });
});
