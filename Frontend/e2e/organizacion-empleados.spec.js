const { test, expect } = require('@playwright/test');
const { USUARIOS, caso, abrirComoUsuario, iniciarSesion, irAlMenu } = require('./helpers');
const { loginApi, registrarUsuario, aceptarInvitacionApi, desvincularApi, empleadosApi, filaEmpleado, URL_BACK } = require('./helpers/t08');

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
        const r = await request.post(`${URL_BACK}/organizations/add_employee`, { headers: { Authorization: `Bearer ${tokenDueno}` }, data: { employeeUsername: u.email } });
        expect(r.ok()).toBeTruthy();
        await aceptarInvitacionApi(request, u);
    }
}

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

    test('casos 196, 197, 198, 225 y 228: datos de la organización y lista de empleados @organizacion @serie', async ({ browser, request }) => {
        const s = await abrirComoUsuario(browser, USUARIOS.dueno);
        ctx = s.context;
        const page = s.page;
        tokenDueno ??= await loginApi(request, USUARIOS.dueno);
        await irAMiOrganizacion(page);
        await caso(196, 'se muestran nombre e información de contacto', async () => {
            const org = JSON.parse(await page.evaluate(() => localStorage.getItem('organization')));
            expect(org.name).toBeTruthy();
            expect(org.contactData).toBeTruthy();
            await expect(visible(page.getByPlaceholder(org.name))).toBeVisible();
            await expect(visible(page.getByPlaceholder(org.contactData))).toBeVisible();
        });
        await caso(197, 'los empleados se listan con nombre, email y rol', async () => {
            for (const email of [USUARIOS.empleado, 'emp2.utn@eurekapp.com', USUARIOS.encargado]) {
                await expect(filaEmpleado(page, email)).toBeVisible();
            }
            const fila = filaEmpleado(page, USUARIOS.empleado);
            await expect(fila.getByText('Empleado', { exact: true })).toBeVisible();
            await expect(filaEmpleado(page, USUARIOS.encargado).getByText('Encargado', { exact: true })).toBeVisible();
            const emp = (await empleadosApi(request, tokenDueno)).find((e) => e.username === USUARIOS.empleado);
            await expect(fila.getByText(`${emp.firstName} ${emp.lastName}`)).toBeVisible();
        });
        await caso(198, 'Agregar un empleado muestra el formulario de alta', async () => {
            await abrirModalAlta(page);
            await expect(botonEnviar(page)).toBeVisible();
        });
        await cerrarModal(page);
        await caso(225, 'cada empleado (no encargado) muestra el botón Asignar encargado', async () => {
            await expect(filaEmpleado(page, USUARIOS.empleado).getByText('Asignar encargado', { exact: true })).toBeVisible();
        });
        await caso(228, 'cada empleado muestra el botón Eliminar', async () => {
            await expect(filaEmpleado(page, USUARIOS.empleado).getByText('Eliminar', { exact: true })).toBeVisible();
        });
    });

    test('casos 199 a 209: alta de empleado por correo (modal) @organizacion @serie', async ({ browser, request }) => {
        tokenDueno ??= await loginApi(request, USUARIOS.dueno);
        const a = await registrarUsuario(request, 'alta');
        nuevos.push(a);
        const s = await abrirComoUsuario(browser, USUARIOS.dueno);
        ctx = s.context;
        const page = s.page;
        await irAMiOrganizacion(page);

        await caso(200, 'email vacío: el sistema muestra errores', async () => {
            await abrirModalAlta(page);
            await botonEnviar(page).click();
            await expect(visible(page.getByText('El email es obligatorio.'))).toBeVisible();
        });
        await caso(202, 'formato de email inválido (juan123): mensaje de email inválido', async () => {
            await page.getByPlaceholder('E-mail').fill('juan123');
            await botonEnviar(page).click();
            await expect.soft(visible(page.getByText(/inválido|invalido/i))).toBeVisible({ timeout: 8000 });
        });
        await caso(205, 'email no registrado: error indicando que el usuario no existe', async () => {
            await page.getByPlaceholder('E-mail').fill(`noexiste.${Date.now()}@mail.com`);
            await botonEnviar(page).click();
            await expect(visible(page.getByText(/no existe/i))).toBeVisible();
        });
        await caso(208, 'Cerrar cierra el modal', async () => {
            await cerrarModal(page);
            await expect(page.getByPlaceholder('E-mail')).toHaveCount(0);
        });
        await abrirModalAlta(page);
        await caso(199, 'alta válida: se envía la solicitud al usuario', async () => {
            await page.getByPlaceholder('E-mail').fill(a.email);
            await botonEnviar(page).click();
            await expect(page.getByText('¡Solicitud enviada correctamente!')).toBeVisible();
        });
        await caso(203, 'email válido: la solicitud se envía correctamente', async () => {
            await expect(page.getByText('¡Solicitud enviada correctamente!')).toBeVisible();
        });
        await caso(204, 'email de usuario registrado: se envía la solicitud al usuario', async () => {
            const r = await request.get(`${URL_BACK}/organizations/getPendingAddEmployeeRequests`, { headers: { Authorization: `Bearer ${a.token}` } });
            expect((await r.json()).requests.length).toBeGreaterThan(0);
        });
        await caso(209, 'envío exitoso: mensaje de éxito visible', async () => {
            await expect(page.getByText('El usuario recibirá una notificación para unirse a la organización.')).toBeVisible();
        });
        await caso(207, 'usuario ya invitado: mensaje de solicitud ya enviada', async () => {
            await page.getByPlaceholder('E-mail').fill(a.email);
            await botonEnviar(page).click();
            await expect(visible(page.getByText(/solicitud pendiente|ya fue enviada|ya (se )?envi/i))).toBeVisible();
        });
        await cerrarModal(page);

        await aceptarInvitacionApi(request, a);
        await page.reload();
        await irAMiOrganizacion(page);
        await caso(201, 'el empleado agregado permanece en la lista tras recargar', async () => {
            await expect(filaEmpleado(page, a.email)).toBeVisible();
            await page.reload();
            await irAMiOrganizacion(page);
            await expect(filaEmpleado(page, a.email)).toBeVisible();
        });
        await caso(206, 'usuario que ya es empleado: mensaje indicando que ya es empleado', async () => {
            await abrirModalAlta(page);
            await page.getByPlaceholder('E-mail').fill(USUARIOS.empleado);
            await botonEnviar(page).click();
            await expect(visible(page.getByText(/ya (es|pertenece)/i))).toBeVisible();
            await cerrarModal(page);
        });
    });

    test('casos 226, 227, 364, 365, 366, 367, 368 y 369: asignar encargado @organizacion @serie', async ({ browser, request }) => {
        tokenDueno ??= await loginApi(request, USUARIOS.dueno);
        const a = await registrarUsuario(request, 'enc');
        const b = await registrarUsuario(request, 'encb');
        nuevos.push(a, b);
        await invitarYAceptar(request, tokenDueno, [a, b]);
        const s = await abrirComoUsuario(browser, USUARIOS.dueno);
        ctx = s.context;
        const page = s.page;
        await irAMiOrganizacion(page);

        await caso(364, 'selección múltiple de empleados para asignar encargado', async () => {
            // la pantalla debería permitir marcar a dos o más empleados y asignarlos juntos
            const marcas = visible(page.locator('input[type="checkbox"], [role="checkbox"]'));
            expect.soft(await marcas.count(), 'no hay casillas para seleccionar varios empleados').toBeGreaterThan(1);
        });

        await caso(226, 'Asignar encargado: el usuario pasa a rol encargado', async () => {
            await filaEmpleado(page, a.email).getByText('Asignar encargado', { exact: true }).click();
            await confirmar(page, 'Asignar').click();
            await expect(visible(page.getByText('Encargado asignado', { exact: true }))).toBeVisible();
            const emp = (await empleadosApi(request, tokenDueno)).find((e) => e.username === a.email);
            expect(emp.role).toBe('ENCARGADO');
        });
        await caso(365, 'mensaje de confirmación de que el rol fue asignado', async () => {
            await expect(visible(page.getByText('El rol de encargado fue asignado correctamente.'))).toBeVisible();
            await confirmar(page, 'Cerrar').click();
        });
        await caso(227, 'el empleado se ve como encargado', async () => {
            await expect(filaEmpleado(page, a.email).getByText('Encargado', { exact: true })).toBeVisible();
        });

        await caso(367, 'falla del servidor al asignar: mensaje de error claro (servidor simulado con page.route)', async () => {
            await page.route('**/organizations/assign_encargado', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"error"}' }));
            await filaEmpleado(page, b.email).getByText('Asignar encargado', { exact: true }).click();
            await confirmar(page, 'Asignar').click();
            await expect(visible(page.getByText(/Error al asignar el rol/))).toBeVisible();
            await confirmar(page, 'Cerrar').click();
            await page.unroute('**/organizations/assign_encargado');
            await expect(filaEmpleado(page, b.email).getByText('Empleado', { exact: true })).toBeVisible();
        });

        // el encargado nuevo entra con su cuenta
        const sa = await abrirComoUsuario(browser, a.email);
        await caso(366, 'el nuevo encargado ve en sus avisos que fue asignado', async () => {
            await irAlMenu(sa.page, 'Notificaciones');
            await expect(visible(sa.page.getByText(/designado como encargado/)).first()).toBeVisible();
        });
        await caso(368, 'Mi perfil muestra el tipo de usuario Encargado', async () => {
            await irAlMenu(sa.page, 'Mi perfil');
            await expect(visible(sa.page.getByText('Encargado', { exact: true }))).toBeVisible();
        });
        await caso(369, 'el rol permanece tras refrescar y volver a ingresar', async () => {
            await sa.page.reload();
            await irAlMenu(sa.page, 'Mi perfil');
            await expect(visible(sa.page.getByText('Encargado', { exact: true }))).toBeVisible();
            await page.reload();
            await irAMiOrganizacion(page);
            await expect(filaEmpleado(page, a.email).getByText('Encargado', { exact: true })).toBeVisible();
            const nueva = await browser.newContext({ baseURL: process.env.E2E_BASE_URL || 'http://localhost:8082' });
            const p2 = await nueva.newPage();
            await iniciarSesion(p2, a.email);
            await irAlMenu(p2, 'Mi perfil');
            await expect(visible(p2.getByText('Encargado', { exact: true }))).toBeVisible();
            await nueva.close();
        });
        await sa.context.close();
    });

    test('casos 229 a 234: eliminar empleados y encargados @organizacion @serie', async ({ browser, request }) => {
        tokenDueno ??= await loginApi(request, USUARIOS.dueno);
        const a = await registrarUsuario(request, 'del');
        const b = await registrarUsuario(request, 'encdel');
        const c = await registrarUsuario(request, 'revoca');
        nuevos.push(a, b, c);
        await invitarYAceptar(request, tokenDueno, [a, b, c]);
        for (const u of [b, c]) {
            const emp = (await empleadosApi(request, tokenDueno)).find((e) => e.username === u.email);
            await request.post(`${URL_BACK}/organizations/assign_encargado`, { headers: { Authorization: `Bearer ${tokenDueno}` }, data: { userId: emp.id } });
        }
        const s = await abrirComoUsuario(browser, USUARIOS.dueno);
        ctx = s.context;
        const page = s.page;
        await irAMiOrganizacion(page);

        await caso(231, 'cancelar la confirmación no elimina al empleado', async () => {
            await filaEmpleado(page, a.email).getByText('Eliminar', { exact: true }).click();
            await expect(visible(page.getByText('¿Eliminar empleado?'))).toBeVisible();
            await confirmar(page, 'Cancelar').click();
            await expect(filaEmpleado(page, a.email)).toBeVisible();
            await page.reload();
            await irAMiOrganizacion(page);
            await expect(filaEmpleado(page, a.email)).toBeVisible();
        });
        await caso(229, 'eliminar: el empleado desaparece de la lista', async () => {
            await filaEmpleado(page, a.email).getByText('Eliminar', { exact: true }).click();
            await confirmar(page, 'Eliminar').click();
            await expect(visible(page.getByText(a.email, { exact: true }))).toHaveCount(0);
        });
        await caso(230, 'confirmar la eliminación elimina al empleado correctamente', async () => {
            const lista = await empleadosApi(request, tokenDueno);
            expect(lista.find((e) => e.username === a.email)).toBeUndefined();
        });
        await caso(233, 'tras refrescar, el empleado eliminado no aparece', async () => {
            await page.reload();
            await irAMiOrganizacion(page);
            await expect(visible(page.getByText(a.email, { exact: true }))).toHaveCount(0);
        });
        await caso(232, 'eliminar a un encargado: se elimina o se valida la restricción', async () => {
            await filaEmpleado(page, b.email).getByText('Eliminar', { exact: true }).click();
            await confirmar(page, 'Eliminar').click();
            await expect(visible(page.getByText(b.email, { exact: true }))).toHaveCount(0);
            expect((await empleadosApi(request, tokenDueno)).find((e) => e.username === b.email)).toBeUndefined();
        });
        await caso(234, 'tras quitar el rol de encargado y refrescar, sigue como empleado sin el rol', async () => {
            await filaEmpleado(page, c.email).getByText('Eliminar encargado', { exact: true }).click();
            await confirmar(page, 'Revocar').click();
            await confirmar(page, 'Cerrar').click();
            await page.reload();
            await irAMiOrganizacion(page);
            const fila = filaEmpleado(page, c.email);
            await expect(fila).toBeVisible();
            await expect(fila.getByText('Empleado', { exact: true })).toBeVisible();
            await expect(fila.getByText('Encargado', { exact: true })).toHaveCount(0);
        });
    });
});
