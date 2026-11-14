const { test, expect } = require('@playwright/test');
const { USUARIOS, USUARIOS_PARALELO, caso, irAlMenu } = require('./helpers');
const t15 = require('./helpers/t15');

const ETIQUETAS_ROL = { USER: 'Usuario', ORGANIZATION_OWNER: 'Responsable', ORGANIZATION_EMPLOYEE: 'Empleado', ENCARGADO: 'Encargado', ADMIN: 'Administrador' };
const CHIPS = { USER: 'Usuarios', ORGANIZATION_OWNER: 'Responsables', ORGANIZATION_EMPLOYEE: 'Empleados', ENCARGADO: 'Encargados', ADMIN: 'Admins' };

test.describe('Administración: gestión de usuarios (lectura)', () => {
    test('casos 411, 413, 414, 415 y 416: el administrador entra a Usuarios, ve el listado, filtra por rol y revisa los datos @admin @adminpanel @paralelo', async ({ browser, request }) => {
        const { context, page } = await t15.abrirAdmin(browser);
        try {
            await caso(411, 'el administrador entra a Gestión de usuarios desde el menú', async () => {
                await t15.irAUsuarios(page);
                await expect(page.getByText('Todos', { exact: true }).locator('visible=true').first()).toBeVisible();
                await expect(page.getByText(USUARIOS.admin, { exact: true }).locator('visible=true').first()).toBeVisible();
            });

            await caso(413, 'el listado muestra a todos los usuarios registrados', async () => {
                const delServidor = await t15.usuariosApi(request, page);
                const enPantalla = await t15.emailsVisibles(page);
                const faltan = delServidor.map((u) => u.username).filter((e) => !enPantalla.has(e));
                expect(faltan, 'usuarios del servidor que no aparecen en el listado').toEqual([]);
            });

            await caso(414, 'cada filtro de rol muestra solo los usuarios de ese rol', async () => {
                for (const [rol, texto] of Object.entries(CHIPS)) {
                    const respuesta = page.waitForResponse((r) => r.url().includes('/admin/users?role=' + rol));
                    await t15.chip(page, texto).click();
                    const esperados = await (await respuesta).json();
                    const enPantalla = await t15.emailsVisibles(page);
                    expect.soft([...enPantalla].sort(), `filtro ${texto}`).toEqual(esperados.map((u) => u.username).sort());
                    // Todas las insignias visibles son del rol elegido.
                    const insignias = await page.getByText(new RegExp(`^(${Object.values(ETIQUETAS_ROL).join('|')})$`)).locator('visible=true').allInnerTexts();
                    expect.soft(insignias.filter((t) => t !== ETIQUETAS_ROL[rol]), `insignias de otro rol con el filtro ${texto}`).toEqual([]);
                }
                await t15.chip(page, 'Todos').click();
            });

            await caso(415, 'cada usuario muestra nombre completo, email, rol, estado, XP y objetos devueltos', async () => {
                await t15.chip(page, 'Admins').click();
                const [admin] = await t15.usuariosApi(request, page, 'ADMIN');
                const fichaAdmin = t15.tarjeta(page, admin.username);
                await expect(fichaAdmin).toBeVisible();
                await expect.soft(fichaAdmin.getByText(`${admin.firstName} ${admin.lastName}`)).toBeVisible();
                await expect.soft(fichaAdmin.getByText(ETIQUETAS_ROL.ADMIN, { exact: true })).toBeVisible();
                await expect.soft(fichaAdmin.getByText(/^\d+ XP$/)).toBeVisible();
                await expect.soft(fichaAdmin.getByText(/^\d+ devueltos$/)).toBeVisible();
                // El estado tiene que verse como dato de la ficha (no solo como el nombre del botón de acción).
                await expect.soft(fichaAdmin.getByText(/^(Activo|Activa|Inactivo|Inactiva)$/), 'la ficha debería mostrar el estado del usuario').toBeVisible({ timeout: 2000 });
            });

            await caso(416, 'al seleccionar un usuario se muestra su detalle', async () => {
                await t15.chip(page, 'Todos').click();
                const [admin] = await t15.usuariosApi(request, page, 'ADMIN');
                const url = page.url();
                await page.getByText(admin.username, { exact: true }).locator('visible=true').first().click();
                await page.waitForTimeout(800);
                const cambioDePantalla = page.url() !== url;
                const hayDetalle = await page.getByText(/detalle/i).locator('visible=true').count();
                expect(cambioDePantalla || hayDetalle > 0, 'al tocar un usuario no se abre ningún detalle').toBeTruthy();
            });
        } finally {
            await context.close();
        }
    });

    test('caso 412: un usuario que no es administrador no ve Gestión de usuarios y el servidor responde 403 @admin @adminpanel @paralelo', async ({ browser, request }) => {
        const { context, page } = await t15.abrirConToken(browser, USUARIOS_PARALELO.usuarioValeria);
        try {
            await caso(412, 'el menú no ofrece la gestión y el servidor responde 403', async () => {
                await page.goto('/');
                await page.locator('button:has(img[src*="toggle-drawer-icon"])').last().click();
                await expect(page.getByText('Logout')).toBeInViewport();
                for (const opcion of ['Usuarios', 'Organizaciones', 'Dashboard']) {
                    await expect(page.locator('a', { has: page.getByText(opcion, { exact: true }) }), `el menú de un usuario común no debería tener ${opcion}`).toHaveCount(0);
                }
                for (const ruta of ['/admin/users', '/admin/organizations', '/admin/stats']) {
                    const r = await t15.consultar(request, page, ruta);
                    expect(r.status(), `GET ${ruta}`).toBe(403);
                }
                const u = await t15.consultar(request, page, '/admin/users?role=ADMIN');
                expect(u.status()).toBe(403);
            });
        } finally {
            await context.close();
        }
    });
});
