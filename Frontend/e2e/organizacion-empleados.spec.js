const { test, expect } = require('@playwright/test');
const { USUARIOS, abrirComoUsuario, iniciarSesion, irAlMenu } = require('./helpers');
const { loginApi, registrarUsuario, aceptarInvitacionApi, desvincularApi, empleadosApi, filaEmpleado, URL_BACK, auth } = require('./helpers/t08');
const { tarjeta, notificacionesApi } = require('./helpers/t12');
const { esperarCorreo } = require('./helpers/r05');

const { casoContinuo: caso, noSePudoProbar } = require('./helpers/t17');

const visible = (loc) => loc.locator('visible=true');

// Abre el modal de alta de empleado desde "Mi organización".
async function abrirModalAlta(page) {
    await visible(page.getByText('Agregar un empleado', { exact: true })).click();
    await expect(page.getByPlaceholder('E-mail')).toBeVisible();
}
const botonEnviar = (page) => visible(page.getByText('Agregar empleado', { exact: true }));
const confirmar = (page, texto) => visible(page.getByText(texto, { exact: true })).last();
const cerrarModal = (page) => visible(page.getByText('Cerrar', { exact: true })).last().click();

async function irAMiOrganizacion(page) {
    await irAlMenu(page, 'Mi organización');
    await expect(visible(page.getByText('Empleados:'))).toBeVisible();
}

async function invitarYAceptar(request, tokenDueno, usuarios) {
    for (const u of usuarios) {
        const r = await request.post(`${URL_BACK}/organizations/add_employee`, { headers: auth(tokenDueno), data: { employeeUsername: u.email } });
        expect(r.ok()).toBeTruthy();
        await aceptarInvitacionApi(request, u);
    }
}

// Asigna el rol de encargado por la interfaz y deja visto el aviso de éxito.
async function asignarPorPantalla(page, email) {
    await filaEmpleado(page, email).getByText('Asignar encargado', { exact: true }).click();
    await expect(visible(page.getByText('¿Asignar encargado?'))).toBeVisible();
    await confirmar(page, 'Asignar').click();
    await expect(visible(page.getByText('Encargado asignado', { exact: true }))).toBeVisible();
    await expect(visible(page.getByText('El rol de encargado fue asignado correctamente.'))).toBeVisible();
    await confirmar(page, 'Cerrar').click();
}

const nombreOrg = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('organization')).name);

test.describe('organización y empleados', () => {
    test.setTimeout(300_000);

    let tokenDueno;
    let ctx;
    const nuevos = [];

    test.afterEach(async ({ request }) => {
        // limpieza: los usuarios nuevos quedan fuera de la organización
        if (!tokenDueno) tokenDueno = await loginApi(request, USUARIOS.dueno);
        for (const u of nuevos) await desvincularApi(request, tokenDueno, u.email);
        nuevos.length = 0;
        if (ctx) { await ctx.close(); ctx = null; }
    });

    test('casos 154, 155 y 156: datos de la organización, lista de empleados y acceso al alta @organizacion @serie', async ({ browser, request }) => {
        const s = await abrirComoUsuario(browser, USUARIOS.dueno);
        ctx = s.context;
        const page = s.page;
        tokenDueno ??= await loginApi(request, USUARIOS.dueno);
        await irAMiOrganizacion(page);
        await caso(154, 'se muestran nombre e información de contacto', async () => {
            const org = JSON.parse(await page.evaluate(() => localStorage.getItem('organization')));
            expect(org.name).toBeTruthy();
            expect(org.contactData).toBeTruthy();
            await expect(visible(page.getByPlaceholder(org.name))).toBeVisible();
            await expect(visible(page.getByPlaceholder(org.contactData))).toBeVisible();
        });
        await caso(155, 'los empleados se listan con nombre, email y rol', async () => {
            for (const email of [USUARIOS.empleado, 'emp2.utn@eurekapp.com', USUARIOS.encargado]) {
                await expect(filaEmpleado(page, email)).toBeVisible();
            }
            const fila = filaEmpleado(page, USUARIOS.empleado);
            await expect(fila.getByText('Empleado', { exact: true })).toBeVisible();
            await expect(filaEmpleado(page, USUARIOS.encargado).getByText('Encargado', { exact: true })).toBeVisible();
            const emp = (await empleadosApi(request, tokenDueno)).find((e) => e.username === USUARIOS.empleado);
            await expect(fila.getByText(`${emp.firstName} ${emp.lastName}`)).toBeVisible();
        });
        await caso(156, 'Agregar un empleado muestra el formulario de alta', async () => {
            await abrirModalAlta(page);
            await expect(botonEnviar(page)).toBeVisible();
        });
        await cerrarModal(page);
    });

    test('casos 157 a 164: alta de empleado por correo (modal) @organizacion @serie', async ({ browser, request }) => {
        tokenDueno ??= await loginApi(request, USUARIOS.dueno);
        const a = await registrarUsuario(request, 'alta');
        nuevos.push(a);
        const s = await abrirComoUsuario(browser, USUARIOS.dueno);
        ctx = s.context;
        const page = s.page;
        await irAMiOrganizacion(page);
        const pendientes = async () => {
            const r = await request.get(`${URL_BACK}/organizations/getPendingAddEmployeeRequests`, { headers: auth(a.token) });
            return (await r.json()).requests;
        };

        await caso(158, 'email vacío: "El email es obligatorio." y no se envía solicitud', async () => {
            await abrirModalAlta(page);
            await botonEnviar(page).click();
            await expect(visible(page.getByText('El email es obligatorio.'))).toBeVisible();
            expect(await pendientes()).toHaveLength(0);
        });
        await caso(160, 'juan123: "El usuario con email \'juan123\' no existe." y no se envía solicitud', async () => {
            await page.getByPlaceholder('E-mail').fill('juan123');
            await botonEnviar(page).click();
            await expect(visible(page.getByText("El usuario con email 'juan123' no existe."))).toBeVisible();
            await expect(page.getByText('¡Solicitud enviada correctamente!')).toHaveCount(0);
        });
        await caso(161, 'email que no es de ningún usuario: mensaje de que no existe y no se crea solicitud', async () => {
            const inexistente = `noexiste.${Date.now()}@mail.com`;
            await page.getByPlaceholder('E-mail').fill(inexistente);
            await botonEnviar(page).click();
            await expect(visible(page.getByText(`El usuario con email '${inexistente}' no existe.`))).toBeVisible();
            await expect(page.getByText('¡Solicitud enviada correctamente!')).toHaveCount(0);
        });
        await caso(157, 'alta válida: mensaje de éxito, notificación "Solicitud de organización" y correo de invitación', async () => {
            const desde = Date.now() - 5000;
            await page.getByPlaceholder('E-mail').fill(a.email);
            await botonEnviar(page).click();
            await expect(page.getByText('¡Solicitud enviada correctamente!')).toBeVisible();
            await expect(page.getByText('El usuario recibirá una notificación para unirse a la organización.')).toBeVisible();
            expect((await pendientes()).length).toBeGreaterThan(0);
            await expect.poll(async () => (await notificacionesApi(request, a.token)).some((n) => n.title === 'Solicitud de organización'), { timeout: 30000 }).toBe(true);
            // verificado en el servidor de correo de prueba
            await esperarCorreo(request, a.email, 'EurekApp — Invitación para unirte a una organización', desde);
        });
        await caso(163, 'usuario ya invitado: mensaje de solicitud pendiente y no se crea una segunda', async () => {
            await page.getByPlaceholder('E-mail').fill(a.email);
            await botonEnviar(page).click();
            await expect(visible(page.getByText(`El usuario con email '${a.email}' ya tiene una solicitud pendiente de tu organización.`))).toBeVisible();
            expect(await pendientes()).toHaveLength(1);
        });
        await caso(164, 'Cerrar cierra el modal', async () => {
            await cerrarModal(page);
            await expect(page.getByPlaceholder('E-mail')).toHaveCount(0);
        });

        await caso(159, 'el invitado aparece como Empleado solo después de aceptar y sigue tras recargar', async () => {
            expect((await empleadosApi(request, tokenDueno)).find((e) => e.username === a.email)).toBeUndefined();
            await expect(visible(page.getByText(a.email, { exact: true }))).toHaveCount(0);
            // el usuario acepta la solicitud desde Notificaciones
            const sa = await abrirComoUsuario(browser, a.email);
            try {
                await irAlMenu(sa.page, 'Notificaciones');
                const t = tarjeta(sa.page, 'Solicitud de organización', 'quiere que te unas a su organización');
                await t.getByText('Aceptar', { exact: true }).click();
                await expect(visible(sa.page.getByText('¡Solicitud aceptada!'))).toBeVisible();
            } finally {
                await sa.context.close();
            }
            await page.reload();
            await irAMiOrganizacion(page);
            await expect(filaEmpleado(page, a.email).getByText('Empleado', { exact: true })).toBeVisible();
            await page.reload();
            await irAMiOrganizacion(page);
            await expect(filaEmpleado(page, a.email).getByText('Empleado', { exact: true })).toBeVisible();
        });
        await caso(162, 'usuario que ya es empleado: mensaje de que ya pertenece a una organización', async () => {
            await abrirModalAlta(page);
            await page.getByPlaceholder('E-mail').fill(USUARIOS.empleado);
            await botonEnviar(page).click();
            await expect(visible(page.getByText(`El usuario con email '${USUARIOS.empleado}' ya pertenece a una organización.`))).toBeVisible();
            await expect(page.getByText('¡Solicitud enviada correctamente!')).toHaveCount(0);
            await cerrarModal(page);
        });
    });

    test('casos 174, 245, 246, 247 y 248: asignar encargado @organizacion @serie', async ({ browser, request }) => {
        tokenDueno ??= await loginApi(request, USUARIOS.dueno);
        const a = await registrarUsuario(request, 'enc');
        const b = await registrarUsuario(request, 'encb');
        const c = await registrarUsuario(request, 'encc');
        nuevos.push(a, b, c);
        await invitarYAceptar(request, tokenDueno, [a, b, c]);
        const s = await abrirComoUsuario(browser, USUARIOS.dueno);
        ctx = s.context;
        const page = s.page;
        await irAMiOrganizacion(page);
        const org = await nombreOrg(page);
        const rolDe = async (email) => (await empleadosApi(request, tokenDueno)).find((e) => e.username === email)?.role;

        await caso(247, 'falla del servidor al asignar: mensaje de error claro (servidor simulado con page.route)', async () => {
            await page.route('**/organizations/assign_encargado', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"error"}' }));
            await filaEmpleado(page, a.email).getByText('Asignar encargado', { exact: true }).click();
            await confirmar(page, 'Asignar').click();
            await expect(visible(page.getByText(/Error al asignar el rol/))).toBeVisible();
            await confirmar(page, 'Cerrar').click();
            await page.unroute('**/organizations/assign_encargado');
            await expect(filaEmpleado(page, a.email).getByText('Empleado', { exact: true })).toBeVisible();
            expect(await rolDe(a.email)).not.toBe('ENCARGADO');
        });

        await caso(174, 'Asignar encargado: aviso de éxito, etiqueta Encargado y botón Eliminar encargado', async () => {
            const fila = filaEmpleado(page, a.email);
            await expect(fila.getByText('Asignar encargado', { exact: true })).toBeVisible();
            await asignarPorPantalla(page, a.email);
            await expect(fila.getByText('Encargado', { exact: true })).toBeVisible();
            await expect(fila.getByText('Eliminar encargado', { exact: true })).toBeVisible();
            expect(await rolDe(a.email)).toBe('ENCARGADO');
        });

        await caso(245, 'asignar a dos empleados seguidos: los dos quedan como Encargado, sin límite', async () => {
            for (const u of [b, c]) {
                await asignarPorPantalla(page, u.email);
                await expect(filaEmpleado(page, u.email).getByText('Eliminar encargado', { exact: true })).toBeVisible();
            }
            for (const u of [a, b, c]) {
                await expect(filaEmpleado(page, u.email).getByText('Encargado', { exact: true })).toBeVisible();
                expect(await rolDe(u.email)).toBe('ENCARGADO');
            }
        });

        // el encargado nuevo entra con su cuenta
        const sa = await abrirComoUsuario(browser, a.email);
        try {
            await caso(246, 'el nuevo encargado ve "Nuevo rol asignado" y le llega el correo', async () => {
                if ((await rolDe(a.email)) !== 'ENCARGADO') return noSePudoProbar('el usuario no quedó como encargado en el servidor');
                await irAlMenu(sa.page, 'Notificaciones');
                const t = tarjeta(sa.page, 'Nuevo rol asignado', 'Fuiste designado como encargado');
                await expect(t.getByText('Nuevo rol asignado', { exact: true })).toBeVisible();
                await expect(t.getByText(`Fuiste designado como encargado en ${org}.`)).toBeVisible();
                // verificado en el servidor de correo de prueba
                await esperarCorreo(request, a.email, 'Rol de encargado asignado — EurekApp', Date.now() - 600_000);
            });
            await caso(248, 'Mi perfil muestra Encargado antes y después de volver a ingresar; el dueño lo sigue viendo Encargado', async () => {
                if ((await rolDe(a.email)) !== 'ENCARGADO') return noSePudoProbar('el usuario no quedó como encargado en el servidor');
                await irAlMenu(sa.page, 'Mi perfil');
                await expect(visible(sa.page.getByText('Encargado', { exact: true }))).toBeVisible();
                const nueva = await browser.newContext({ baseURL: process.env.E2E_BASE_URL || 'http://localhost:8082' });
                try {
                    const p2 = await nueva.newPage();
                    await iniciarSesion(p2, a.email);
                    await irAlMenu(p2, 'Mi perfil');
                    await expect(visible(p2.getByText('Encargado', { exact: true }))).toBeVisible();
                } finally {
                    await nueva.close();
                }
                await page.reload();
                await irAMiOrganizacion(page);
                await expect(filaEmpleado(page, a.email).getByText('Encargado', { exact: true })).toBeVisible();
            });
        } finally {
            await sa.context.close();
        }
    });

    test('casos 175, 176, 177 y 178: eliminar empleados y encargados @organizacion @serie', async ({ browser, request }) => {
        tokenDueno ??= await loginApi(request, USUARIOS.dueno);
        const a = await registrarUsuario(request, 'del');
        const b = await registrarUsuario(request, 'encdel');
        const c = await registrarUsuario(request, 'revoca');
        nuevos.push(a, b, c);
        await invitarYAceptar(request, tokenDueno, [a, b, c]);
        for (const u of [b, c]) {
            const emp = (await empleadosApi(request, tokenDueno)).find((e) => e.username === u.email);
            await request.post(`${URL_BACK}/organizations/assign_encargado`, { headers: auth(tokenDueno), data: { userId: emp.id } });
        }
        const s = await abrirComoUsuario(browser, USUARIOS.dueno);
        ctx = s.context;
        const page = s.page;
        await irAMiOrganizacion(page);
        const org = await nombreOrg(page);
        const titulos = async (u) => (await notificacionesApi(request, u.token)).map((n) => n.title);

        await caso(176, 'cancelar la confirmación no elimina al empleado', async () => {
            await filaEmpleado(page, a.email).getByText('Eliminar', { exact: true }).click();
            await expect(visible(page.getByText('¿Eliminar empleado?'))).toBeVisible();
            await confirmar(page, 'Cancelar').click();
            await expect(visible(page.getByText('¿Eliminar empleado?'))).toHaveCount(0);
            await expect(filaEmpleado(page, a.email)).toBeVisible();
        });
        await caso(175, 'eliminar empleado: desaparece de la lista tras recargar, queda como usuario común y recibe aviso', async () => {
            await filaEmpleado(page, a.email).getByText('Eliminar', { exact: true }).click();
            await expect(visible(page.getByText('¿Eliminar empleado?'))).toBeVisible();
            await confirmar(page, 'Eliminar').click();
            await expect(visible(page.getByText(a.email, { exact: true }))).toHaveCount(0);
            await page.reload();
            await irAMiOrganizacion(page);
            await expect(visible(page.getByText(a.email, { exact: true }))).toHaveCount(0);
            expect((await empleadosApi(request, tokenDueno)).find((e) => e.username === a.email)).toBeUndefined();
            const login = await (await request.post(`${URL_BACK}/login`, { data: { username: a.email, password: 'Eurekapp1!' } })).json();
            expect(login.user.role).toBe('USER');
            expect(login.organization ?? null).toBeNull();
            expect(await titulos(a)).toContain(`Fuiste desvinculado de ${org}`);
        });
        await caso(177, 'eliminar encargado: desaparece de la lista y pierde su vínculo con la organización', async () => {
            await filaEmpleado(page, b.email).getByText('Eliminar', { exact: true }).click();
            await confirmar(page, 'Eliminar').click();
            await expect(visible(page.getByText(b.email, { exact: true }))).toHaveCount(0);
            expect((await empleadosApi(request, tokenDueno)).find((e) => e.username === b.email)).toBeUndefined();
            const login = await (await request.post(`${URL_BACK}/login`, { data: { username: b.email, password: 'Eurekapp1!' } })).json();
            expect(login.user.role).toBe('USER');
            expect(login.organization ?? null).toBeNull();
        });
        await caso(178, 'revocar encargado: aviso, sigue como Empleado tras recargar y recibe "Cambio de rol"', async () => {
            await filaEmpleado(page, c.email).getByText('Eliminar encargado', { exact: true }).click();
            await expect(visible(page.getByText('¿Revocar encargado?'))).toBeVisible();
            await confirmar(page, 'Revocar').click();
            await expect(visible(page.getByText('El rol de encargado fue revocado correctamente.'))).toBeVisible();
            await confirmar(page, 'Cerrar').click();
            await page.reload();
            await irAMiOrganizacion(page);
            const fila = filaEmpleado(page, c.email);
            await expect(fila).toBeVisible();
            await expect(fila.getByText('Empleado', { exact: true })).toBeVisible();
            await expect(fila.getByText('Encargado', { exact: true })).toHaveCount(0);
            expect(await titulos(c)).toContain('Cambio de rol');
        });
    });
});
