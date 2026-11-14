const { test, expect } = require('@playwright/test');
const { caso } = require('./helpers');
const t15 = require('./helpers/t15');

test.describe('Administración: gestión de organizaciones (lectura)', () => {
    test('casos 421, 423 y 424: el administrador entra a Organizaciones, revisa los datos de cada una y abre el detalle @admin @adminpanel @paralelo', async ({ browser, request }) => {
        const { context, page } = await t15.abrirAdmin(browser);
        try {
            await caso(421, 'el administrador entra a Gestión de organizaciones desde el menú', async () => {
                await t15.irAOrganizaciones(page);
                await expect(page.getByText('UTN FRC', { exact: true }).locator('visible=true').first()).toBeVisible();
            });

            const orgs = await t15.organizacionesApi(request, page);

            await caso(423, 'cada organización muestra nombre, tipo, ciudad, contacto, estado y cantidad de empleados', async () => {
                for (const o of orgs) {
                    await expect.soft(page.getByText(o.name, { exact: true }).locator('visible=true').first(), `nombre ${o.name}`).toBeVisible();
                    const ficha = t15.tarjeta(page, o.name);
                    await expect.soft(ficha.getByText(o.contactData, { exact: true }), `contacto de ${o.name}`).toBeVisible();
                    await expect.soft(ficha.getByText(new RegExp(`^${o.city}`)), `ciudad de ${o.name}`).toBeVisible();
                    await expect.soft(ficha.getByText(o.active ? 'Activa' : 'Inactiva', { exact: true }), `estado de ${o.name}`).toBeVisible();
                    await expect.soft(ficha.getByText(`${o.employeeCount} miembro${o.employeeCount !== 1 ? 's' : ''}`, { exact: true }), `empleados de ${o.name}`).toBeVisible();
                    // El tipo tiene que verse en lenguaje común, no como el código interno (por ejemplo UNIVERSITY).
                    await expect.soft(ficha.getByText(o.organizationType, { exact: true }), `el tipo de ${o.name} se muestra como código interno`).toHaveCount(0);
                }
            });

            await caso(424, 'al seleccionar una organización se muestra su detalle', async () => {
                const url = page.url();
                await page.getByText(orgs[0].name, { exact: true }).locator('visible=true').first().click();
                await page.waitForTimeout(800);
                const hayDetalle = await page.getByText(/detalle/i).locator('visible=true').count();
                expect(page.url() !== url || hayDetalle > 0, 'al tocar una organización no se abre ningún detalle').toBeTruthy();
            });
        } finally {
            await context.close();
        }
    });
});
