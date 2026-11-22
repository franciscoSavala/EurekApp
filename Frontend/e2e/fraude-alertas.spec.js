const { test, expect } = require('@playwright/test');
const { USUARIOS, abrirComoUsuario, irAlMenu } = require('./helpers');
const { dniUnico } = require('./helpers/t04');
const { loginApi, alertaDelDni, resolverAlertaApi } = require('./helpers/t07');
const { casoContinuo } = require('./helpers/t17');
const { abrirMenuDesdeInicio, enlaceMenu } = require('./helpers/t01');
const { configFraudeApi, guardarConfigFraudeApi, devolverVarias, intentarDevolverApi } = require('./helpers/r05');

// La pantalla Alertas de fraude es del administrador de EurekApp: las alertas son globales.
// Limpieza: la alerta que crea cada test se marca como falsa alarma por la API (levanta el bloqueo
// de emp2.utn y del DNI y deja la alerta inactiva) y la configuración vuelve a su valor original.

test.describe('Alertas de fraude', () => {
    test('casos 134, 135, 136, 137, 141 y 142: pantalla de alertas del administrador, estado sin alertas, datos y persistencia @fraude @serie', async ({ browser, request }) => {
        test.setTimeout(300_000);
        const dni = dniUnico();
        const empleado = await loginApi(request, 'emp2.utn@eurekapp.com');
        const admin = await loginApi(request, USUARIOS.admin);
        const config = await configFraudeApi(request, admin.token);
        const contextos = [];
        try {
            // Las devoluciones al mismo DNI que alcanzan el umbral generan la alerta.
            await devolverVarias(request, empleado, dni, config.fraudThreshold);
            expect(await alertaDelDni(request, admin.token, dni)).toBeTruthy();

            const a = await abrirComoUsuario(browser, USUARIOS.admin);
            contextos.push(a.context);
            const pa = a.page;
            const verReporte = () => pa.getByText('Ver reporte', { exact: true }).locator('visible=true');
            const tarjetaDni = () => pa.getByText(`DNI: ${dni}`, { exact: true }).locator('visible=true');

            await casoContinuo(134, 'el administrador entra desde el menú y ve el botón Ver reporte y el listado de alertas', async () => {
                await irAlMenu(pa, 'Alertas de fraude');
                await expect(verReporte()).toBeVisible();
                await expect(pa.getByText(/^DNI: \d+$/).locator('visible=true').first()).toBeVisible();
            });

            await casoContinuo(135, 'se ven el botón Ver reporte y el listado de alertas', async () => {
                await expect(verReporte()).toBeVisible();
                await expect(pa.getByText(/^DNI: \d+$/).locator('visible=true').first()).toBeVisible();
            });

            await casoContinuo(141, 'la alerta recién generada aparece en la pantalla', async () => {
                await expect(tarjetaDni()).toBeVisible();
            });

            await casoContinuo(142, 'tras recargar la pantalla las mismas alertas siguen visibles', async () => {
                await pa.reload();
                await expect(pa.getByText('Logout')).toBeVisible();
                await irAlMenu(pa, 'Alertas de fraude');
                await expect(tarjetaDni()).toBeVisible();
            });

            await casoContinuo(137, 'el listado muestra estado, motivo, DNI, usuarios y fecha, y el detalle suma los demás datos', async () => {
                const t = pa.locator('div')
                    .filter({ has: pa.getByText(`DNI: ${dni}`, { exact: true }) })
                    .filter({ has: pa.getByText('Activa', { exact: true }) })
                    .last();
                await expect.soft(t.getByText('Activa', { exact: true })).toBeVisible();
                await expect.soft(t.getByText(/Retiros repetidos del mismo DNI/)).toBeVisible();
                await expect.soft(t.getByText(`DNI: ${dni}`, { exact: true })).toBeVisible();
                await expect.soft(t.getByText(/usuarios? involucrados?/)).toBeVisible();
                await expect.soft(t.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).toBeVisible();
                await tarjetaDni().click();
                for (const etiqueta of ['Detalle', 'Empleado que entregó', 'Fecha de detección']) {
                    await expect.soft(pa.getByText(etiqueta, { exact: true }).locator('visible=true').first(), `el detalle muestra "${etiqueta}"`).toBeVisible();
                }
            });

            await casoContinuo(136, 'sin alertas aparece el mensaje "No hay alertas de fraude" (verificado con el servidor simulado sin datos)', async () => {
                // Las alertas son globales y el seed ya trae varias: el servidor se simula sin alertas.
                await pa.route('**/fraud-alerts', (r) =>
                    r.request().method() === 'GET'
                        ? r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
                        : r.continue());
                await pa.goto('/');
                await expect(pa.getByText('Logout')).toBeVisible();
                await irAlMenu(pa, 'Alertas de fraude');
                await expect(pa.getByText('No hay alertas de fraude').locator('visible=true')).toBeVisible();
                await pa.unroute('**/fraud-alerts');
            });
        } finally {
            for (const c of contextos) await c.close();
            const alerta = await alertaDelDni(request, admin.token, dni).catch(() => null);
            if (alerta && alerta.status === 'ACTIVE') await resolverAlertaApi(request, admin.token, alerta.id);
        }
    });

    test('casos 207 y 202: configuración de parámetros de fraude y detección con el umbral nuevo @fraude @serie', async ({ browser, request }) => {
        test.setTimeout(420_000);
        const dni = dniUnico();
        const empleado = await loginApi(request, 'emp2.utn@eurekapp.com');
        const admin = await loginApi(request, USUARIOS.admin);
        const original = await configFraudeApi(request, admin.token);
        const contextos = [];
        try {
            const a = await abrirComoUsuario(browser, USUARIOS.admin);
            contextos.push(a.context);
            const pa = a.page;
            const campos = () => pa.locator('input').locator('visible=true');

            await casoContinuo(207, 'el administrador cambia umbral, ventana y duración, guarda, y al reabrir ve los valores nuevos', async () => {
                await irAlMenu(pa, 'Configuración de fraude');
                await expect(pa.getByText('Ventana de detección (días)')).toBeVisible();
                await campos().nth(0).fill('5');
                await campos().nth(1).fill('1');
                await campos().nth(2).fill('7');
                await pa.getByText('Guardar cambios', { exact: true }).click();
                await expect(pa.getByText('Configuración guardada correctamente.').first()).toBeVisible();
                // Se reabre la pantalla desde cero.
                await pa.goto('/');
                await expect(pa.getByText('Logout')).toBeVisible();
                await irAlMenu(pa, 'Configuración de fraude');
                await expect(pa.getByText('Ventana de detección (días)')).toBeVisible();
                await expect(campos().nth(0)).toHaveValue('5');
                await expect(campos().nth(1)).toHaveValue('1');
                await expect(campos().nth(2)).toHaveValue('7');
                // Una devolución posterior se evalúa con los valores nuevos: con N=5, cuatro devoluciones no generan alerta.
                await devolverVarias(request, empleado, dni, 4);
                expect(await alertaDelDni(request, admin.token, dni), 'con umbral 5 cuatro devoluciones no deberían generar alerta').toBeFalsy();
            });

            await casoContinuo(202, 'la 5.ª devolución al mismo DNI genera una alerta Activa por retiros repetidos y bloquea el DNI', async () => {
                await devolverVarias(request, empleado, dni, 1);
                const alerta = await alertaDelDni(request, admin.token, dni);
                expect(alerta, 'no se generó la alerta con la 5.ª devolución').toBeTruthy();
                await pa.goto('/');
                await expect(pa.getByText('Logout')).toBeVisible();
                await irAlMenu(pa, 'Alertas de fraude');
                const t = pa.locator('div')
                    .filter({ has: pa.getByText(`DNI: ${dni}`, { exact: true }) })
                    .filter({ has: pa.getByText('Activa', { exact: true }) })
                    .last();
                await expect.soft(t.getByText('Activa', { exact: true })).toBeVisible();
                await expect.soft(t.getByText(/Retiros repetidos del mismo DNI/)).toBeVisible();
                const intento = await intentarDevolverApi(request, empleado, dni);
                expect.soft(intento.status, `una devolución al DNI bloqueado debería rechazarse: ${intento.cuerpo}`).toBe(400);
                expect.soft(intento.cuerpo).toMatch(/bloquead/i);
            });
        } finally {
            for (const c of contextos) await c.close();
            const alerta = await alertaDelDni(request, admin.token, dni).catch(() => null);
            if (alerta && alerta.status === 'ACTIVE') await resolverAlertaApi(request, admin.token, alerta.id);
            await guardarConfigFraudeApi(request, admin.token, original);
        }
    });

    test('caso 209: el dueño, el empleado y el usuario final no ven las opciones de fraude en su menú @fraude @serie', async ({ browser }) => {
        test.setTimeout(180_000);
        const roles = [
            ['dueño de organización', USUARIOS.dueno],
            ['empleado', USUARIOS.empleado],
            ['usuario final', USUARIOS.usuario],
        ];
        await casoContinuo(209, 'ninguno ve "Alertas de fraude" ni "Configuración de fraude"', async () => {
            for (const [rol, email] of roles) {
                const s = await abrirComoUsuario(browser, email);
                try {
                    await abrirMenuDesdeInicio(s.page);
                    await expect.soft(s.page.getByText('Logout'), `el menú del ${rol} se abrió`).toBeVisible();
                    await expect.soft(enlaceMenu(s.page, 'Alertas de fraude'), `el ${rol} no debería ver Alertas de fraude`).toHaveCount(0);
                    await expect.soft(enlaceMenu(s.page, 'Configuración de fraude'), `el ${rol} no debería ver Configuración de fraude`).toHaveCount(0);
                } finally {
                    await s.context.close();
                }
            }
        });
    });
});
