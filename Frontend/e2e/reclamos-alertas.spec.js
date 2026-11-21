// Alertas de fraude generadas por devoluciones: tipos de alerta, correos, falsa alarma, bloqueo y resolución.
// El listado de reclamos de la organización ya no existe (pasó a ser una búsqueda guardada).
const { test, expect } = require('@playwright/test');
const { USUARIOS, abrirComoUsuario, irAlMenu, irAlLogin, completarYEnviarLogin, CLAVE } = require('./helpers');
const { dniUnico } = require('./helpers/t04');
const { loginApi, alertaDelDni, resolverAlertaApi } = require('./helpers/t07');
const { casoContinuo } = require('./helpers/t17');
const T = require('./helpers/t12');
const { configFraudeApi, devolverVarias, intentarDevolverApi, intentarLoginApi, esperarCorreo } = require('./helpers/r05');

const MOTIVO_CASO_2 = 'Posible acuerdo entre quien registra y quien retira';
const ASUNTO_ADMIN = 'EurekApp — Nueva alerta de fraude';
const ASUNTO_BLOQUEO = 'EurekApp — Tu cuenta fue bloqueada temporalmente';
const EMPLEADO = 'emp2.utn@eurekapp.com';

/** Abre la pantalla de alertas de fraude del administrador. */
async function irALista(pagina) {
    await pagina.goto('/');
    await expect(pagina.getByText('Logout')).toBeVisible();
    await irAlMenu(pagina, 'Alertas de fraude');
    await expect(pagina.getByText('Ver reporte', { exact: true }).locator('visible=true')).toBeVisible();
}

test.describe('Alertas de fraude por devoluciones', () => {
    test('casos 203 y 204: alerta por acuerdo entre quien registra y quien retira, y avisos por correo y notificación @fraude @serie', async ({ browser, request }) => {
        test.setTimeout(420_000);
        const dni = dniUnico();
        const empleado = await loginApi(request, EMPLEADO);
        const admin = await loginApi(request, USUARIOS.admin);
        const dueno = await T.loginConOrg(request, USUARIOS.dueno);
        const finder = await T.registrarUsuario(request, 'fnd');
        const config = await configFraudeApi(request, admin.token);
        const contextos = [];
        const desde = Date.now() - 5000;
        const avisosAntes = (await T.notificacionesApi(request, dueno.token)).filter((n) => n.type === 'FRAUD_EMPLOYEE_INVOLVED').length;
        try {
            // Las devoluciones del mismo usuario que encontró y del mismo DNI quedan a una de llegar a N.
            await devolverVarias(request, empleado, dni, config.fraudThreshold - 1, finder.email);
            expect(await alertaDelDni(request, admin.token, dni), 'antes de llegar a N no debería haber alerta').toBeFalsy();
            // La devolución que alcanza N dispara la alerta.
            await devolverVarias(request, empleado, dni, 1, finder.email);

            const a = await abrirComoUsuario(browser, USUARIOS.admin);
            contextos.push(a.context);
            const pa = a.page;

            await casoContinuo(203, 'la alerta es Activa con el motivo de acuerdo entre quien registra y quien retira, y quedan bloqueados el DNI y quien encontró', async () => {
                expect(await alertaDelDni(request, admin.token, dni), 'no se generó la alerta').toBeTruthy();
                await irALista(pa);
                await pa.getByText(`DNI: ${dni}`, { exact: true }).locator('visible=true').click();
                await expect.soft(pa.getByText('Activa', { exact: true }).locator('visible=true').first()).toBeVisible();
                await expect.soft(pa.getByText(new RegExp(MOTIVO_CASO_2)).locator('visible=true').first()).toBeVisible();
                await expect.soft(pa.getByText(finder.email, { exact: true }).locator('visible=true')).toBeVisible();
                await expect.soft(pa.getByText(/fueron bloqueados automáticamente/).locator('visible=true')).toBeVisible();
                // Quien encontró no puede iniciar sesión y el DNI no admite nuevas devoluciones.
                const login = await intentarLoginApi(request, finder.email, CLAVE);
                expect.soft(login.status, `quien encontró debería estar bloqueado: ${login.cuerpo}`).toBe(400);
                expect.soft(login.cuerpo).toMatch(/bloquead/i);
                const devolucion = await intentarDevolverApi(request, empleado, dni);
                expect.soft(devolucion.status, `el DNI debería estar bloqueado: ${devolucion.cuerpo}`).toBe(400);
                expect.soft(devolucion.cuerpo).toMatch(/bloquead/i);
            });

            await casoContinuo(204, 'el administrador recibe el correo de nueva alerta con motivo, DNI y fecha, y el dueño recibe el aviso del integrante involucrado (verificado en el servidor de correo de prueba)', async () => {
                const correo = await esperarCorreo(request, USUARIOS.admin, ASUNTO_ADMIN, desde, [dni, MOTIVO_CASO_2], [/\d{2}\/\d{2}\/\d{4}/]);
                expect.soft(correo.asunto).toBe(ASUNTO_ADMIN);
                await expect.poll(async () => (await T.notificacionesApi(request, dueno.token)).filter((n) => n.type === 'FRAUD_EMPLOYEE_INVOLVED').length, { timeout: 30_000 }).toBeGreaterThan(avisosAntes);
                const d = await abrirComoUsuario(browser, USUARIOS.dueno);
                contextos.push(d.context);
                await irAlMenu(d.page, 'Notificaciones');
                await expect.soft(d.page.getByText('Integrante involucrado en una alerta de fraude').locator('visible=true').first()).toBeVisible();
            });
        } finally {
            for (const c of contextos) await c.close();
            const alerta = await alertaDelDni(request, admin.token, dni).catch(() => null);
            if (alerta && alerta.status === 'ACTIVE') await resolverAlertaApi(request, admin.token, alerta.id);
        }
    });

    test('casos 208, 205, 143 y 206: bloqueo automático, falsa alarma, la persona vuelve a operar y registro de la resolución @fraude @serie', async ({ browser, request }) => {
        test.setTimeout(420_000);
        const dni = dniUnico();
        const empleado = await loginApi(request, EMPLEADO);
        const admin = await loginApi(request, USUARIOS.admin);
        const config = await configFraudeApi(request, admin.token);
        const contextos = [];
        const desde = Date.now() - 5000;
        try {
            await devolverVarias(request, empleado, dni, config.fraudThreshold);
            expect(await alertaDelDni(request, admin.token, dni), 'no se generó la alerta').toBeTruthy();

            await casoContinuo(208, 'la persona recibe el correo de bloqueo y no puede iniciar sesión (verificado en el servidor de correo de prueba)', async () => {
                await esperarCorreo(request, EMPLEADO, ASUNTO_BLOQUEO, desde);
                const p = await browser.newContext();
                contextos.push(p);
                const pagina = await p.newPage();
                await irAlLogin(pagina);
                await completarYEnviarLogin(pagina, EMPLEADO, CLAVE);
                await expect(pagina.getByText(/bloqueado/i).first()).toBeVisible();
                await expect(pagina.getByText('Logout')).toHaveCount(0);
            });

            const a = await abrirComoUsuario(browser, USUARIOS.admin);
            contextos.push(a.context);
            const pa = a.page;
            const tarjeta = () => pa.getByText(`DNI: ${dni}`, { exact: true }).locator('visible=true');

            await casoContinuo(205, 'el administrador marca la alerta como falsa alarma, confirma, y la alerta pasa a Falsa alarma con los bloqueos levantados', async () => {
                await irALista(pa);
                await tarjeta().click();
                await pa.getByText('Marcar falsa alarma', { exact: true }).locator('visible=true').click();
                await pa.getByText('Marcar falsa alarma', { exact: true }).locator('visible=true').last().click();
                await expect.soft(pa.getByText('Falsa alarma', { exact: true }).locator('visible=true').first()).toBeVisible();
                await expect.soft(pa.getByText(/bloqueos que había generado se levantaron/).locator('visible=true')).toBeVisible();
                await expect.poll(async () => (await alertaDelDni(request, admin.token, dni)).status).toBe('FALSE_POSITIVE');
            });

            await casoContinuo(143, 'al levantarse el bloqueo la persona vuelve a iniciar sesión', async () => {
                const login = await intentarLoginApi(request, EMPLEADO, CLAVE);
                expect(login.status, `la persona debería poder operar: ${login.cuerpo}`).toBe(200);
            });

            await casoContinuo(206, 'el detalle de la alerta resuelta muestra Resuelto por con el correo y la Fecha de resolución', async () => {
                await irALista(pa);
                await tarjeta().click();
                await expect.soft(pa.getByText('Resuelto por', { exact: true }).locator('visible=true')).toBeVisible();
                await expect.soft(pa.getByText(USUARIOS.admin, { exact: true }).locator('visible=true').first()).toBeVisible();
                await expect.soft(pa.getByText('Fecha de resolución', { exact: true }).locator('visible=true')).toBeVisible();
                await expect.soft(pa.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/).locator('visible=true').first()).toBeVisible();
            });
        } finally {
            for (const c of contextos) await c.close();
            const alerta = await alertaDelDni(request, admin.token, dni).catch(() => null);
            if (alerta && alerta.status === 'ACTIVE') await resolverAlertaApi(request, admin.token, alerta.id);
        }
    });
});
