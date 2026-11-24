const { test, expect } = require('@playwright/test');
const { USUARIOS, abrirComoUsuario } = require('./helpers');
const { irAlMenu, visible, leerPoliticas, restaurarPoliticas, abrirPoliticas, campoDias, interruptores, elegirTipo, guardar, loginApi } = require('./helpers/t09');
const { loginConOrg, receptarConFinder, devolver } = require('./helpers/t12');
const { casoContinuo: caso } = require('./helpers/t17');

const DETALLE = 'Ej: foto del objeto con el dueño';
const EMPLEADO = USUARIOS.empleado;

// Deja el interruptor en el estado pedido, sin suponer cómo estaba.
const fijar = async (sw, valor) => {
    if ((await sw.isChecked()) !== valor) await sw.click({ force: true });
    await expect(sw).toBeChecked({ checked: valor });
};

test.describe('políticas de la organización', () => {
    test.setTimeout(300_000);

    let tokenDueno;
    let original;
    let ctx;
    let ctxEmp;

    test.beforeEach(async ({ request }) => {
        tokenDueno = await loginApi(request, USUARIOS.dueno);
        original = await leerPoliticas(request, tokenDueno);
    });

    test.afterEach(async ({ request }) => {
        // se restauran los valores originales aunque el test falle
        if (tokenDueno && original) await restaurarPoliticas(request, tokenDueno, original);
        if (ctx) await ctx.close();
        if (ctxEmp) await ctxEmp.close();
        ctx = null;
        ctxEmp = null;
    });

    test('casos 165 a 173: pantalla de políticas, campos, guardado y persistencia @organizacion @politicas @serie', async ({ browser, request }) => {
        const s = await abrirComoUsuario(browser, USUARIOS.dueno);
        ctx = s.context;
        const page = s.page;
        await abrirPoliticas(page);

        await caso(165, 'se ven tiempo de almacenamiento, tipo, los dos interruptores y Guardar políticas', async () => {
            await expect(visible(page.getByText('Tiempo máximo de almacenamiento (días)', { exact: true }))).toBeVisible();
            await expect(visible(page.getByText('Tipo de organización', { exact: true })).first()).toBeVisible();
            await expect(visible(page.getByText('Requerir validación de identidad', { exact: true }))).toBeVisible();
            await expect(visible(page.getByText('Requerir evidencia adicional de propiedad', { exact: true }))).toBeVisible();
            await expect(interruptores(page)).toHaveCount(2);
            await expect(visible(page.getByText('Guardar políticas', { exact: true }))).toBeVisible();
        });

        await caso(166, 'el tiempo de almacenamiento se puede ingresar y modificar', async () => {
            await campoDias(page).fill('3000');
            await expect(campoDias(page)).toHaveValue('3000');
            await campoDias(page).fill('3650');
            await expect(campoDias(page)).toHaveValue('3650');
        });

        await caso(167, 'el selector muestra solo la última opción elegida y lista los tipos', async () => {
            await elegirTipo(page, 'Hotel');
            await expect(visible(page.getByText('Hotel', { exact: true }))).toHaveCount(1);
            // se abre de nuevo: la lista trae los tipos
            await visible(page.getByText('Hotel', { exact: true })).first().click();
            for (const t of ['Universidad', 'Hotel', 'Terminal de ómnibus']) {
                await expect(visible(page.getByText(t, { exact: true })).first()).toBeVisible();
            }
            await visible(page.getByText('Universidad', { exact: true })).last().click();
            await expect(visible(page.getByText('Universidad', { exact: true }))).toHaveCount(1);
            await expect(visible(page.getByText('Hotel', { exact: true }))).toHaveCount(0);
        });

        await caso(168, 'el interruptor de validación de identidad cambia de estado', async () => {
            const sw = interruptores(page).first();
            await expect(sw).not.toBeChecked();
            await sw.click({ force: true });
            await expect(sw).toBeChecked();
            await sw.click({ force: true });
            await expect(sw).not.toBeChecked();
            await sw.click({ force: true });
            await expect(sw).toBeChecked();
        });

        await caso(169, 'evidencia adicional: al activar aparece el detalle (sin carga de archivos); al desactivar desaparece', async () => {
            const sw = interruptores(page).nth(1);
            await expect(sw).not.toBeChecked();
            await sw.click({ force: true });
            await expect(sw).toBeChecked();
            await visible(page.getByPlaceholder(DETALLE)).fill('foto del objeto con el dueño');
            await expect(visible(page.locator('input[type="file"]'))).toHaveCount(0);
            await sw.click({ force: true });
            await expect(sw).not.toBeChecked();
            await expect(visible(page.getByPlaceholder(DETALLE))).toHaveCount(0);
            await sw.click({ force: true });
            await expect(sw).toBeChecked();
            await visible(page.getByPlaceholder(DETALLE)).fill('foto del objeto con el dueño');
        });

        await caso(170, 'guardar las políticas muestra el aviso de éxito y queda en el servidor', async () => {
            await guardar(page);
            const p = await leerPoliticas(request, tokenDueno);
            expect(p.maxStorageDays).toBe(3650);
            expect(p.requiresIdentityValidation).toBe(true);
            expect(p.requiresAdditionalEvidence).toBe(true);
            expect(p.organizationType).toBe('UNIVERSITY');
            expect(p.additionalEvidenceDetails).toBe('foto del objeto con el dueño');
        });

        await caso(171, 'guardar sin cambios no rompe y mantiene los valores', async () => {
            await guardar(page);
            await expect(campoDias(page)).toHaveValue('3650');
            const p = await leerPoliticas(request, tokenDueno);
            expect(p.maxStorageDays).toBe(3650);
            expect(p.organizationType).toBe('UNIVERSITY');
        });

        await caso(172, 'al salir y volver a entrar se mantienen los valores guardados', async () => {
            await irAlMenu(page, 'Ver inventario');
            await abrirPoliticas(page);
            await expect(campoDias(page)).toHaveValue('3650');
            await expect(visible(page.getByText('Universidad', { exact: true }))).toHaveCount(1);
            await expect(interruptores(page).first()).toBeChecked();
            await expect(interruptores(page).nth(1)).toBeChecked();
            await expect(visible(page.getByPlaceholder(DETALLE))).toHaveValue('foto del objeto con el dueño');
        });

        await caso(173, 'campos opcionales vacíos y interruptores apagados: se guarda y siguen vacíos al volver', async () => {
            await campoDias(page).fill('');
            await visible(page.getByPlaceholder(DETALLE)).fill('');
            await fijar(interruptores(page).first(), false);
            await fijar(interruptores(page).nth(1), false);
            await guardar(page);
            await expect(visible(page.getByText('Error al guardar. Intenta de nuevo.'))).toHaveCount(0);
            await irAlMenu(page, 'Ver inventario');
            await abrirPoliticas(page);
            await expect(campoDias(page)).toHaveValue('');
            await expect(interruptores(page).first()).not.toBeChecked();
            await expect(interruptores(page).nth(1)).not.toBeChecked();
            const p = await leerPoliticas(request, tokenDueno);
            expect(p.maxStorageDays).toBeNull();
            expect(p.requiresAdditionalEvidence).toBe(false);
        });
    });

    test('caso 243: el historial de cambios registra cada guardado @organizacion @politicas @serie', async ({ browser, request }) => {
        // políticas ya guardadas antes
        await restaurarPoliticas(request, tokenDueno, original);
        const s = await abrirComoUsuario(browser, USUARIOS.dueno);
        ctx = s.context;
        const page = s.page;
        await abrirPoliticas(page);
        const cantidad = async () => (await leerPoliticas(request, tokenDueno)).history.length;
        const antes = await cantidad();

        await caso(243, 'el historial suma una entrada con fecha, hora y "Por: <email del dueño>" sin indicar qué política cambió', async () => {
            const sw = interruptores(page).nth(1);
            await fijar(sw, !(await sw.isChecked()));
            await guardar(page);
            expect(await cantidad()).toBe(antes + 1);
            await visible(page.getByText(/^Historial de cambios \(\d+\)$/)).click();
            await expect(visible(page.getByText(`Historial de cambios (${antes + 1})`, { exact: true }))).toBeVisible();
            const entrada = visible(page.getByText(/^Por: /)).first();
            await expect(entrada).toBeVisible();
            await expect(entrada).toContainText(USUARIOS.dueno);
            // la fecha y la hora se muestran en la línea de la entrada
            const fecha = entrada.locator('xpath=preceding-sibling::*[1]');
            await expect(fecha).toHaveText(/\d{1,2}\/\d{1,2}\/\d{2,4}.*\d{1,2}:\d{2}/);
            // no indica qué política cambió
            await expect(entrada.locator('xpath=..')).not.toContainText(/almacenamiento|identidad|evidencia|tipo de organizaci/i);
        });
    });

    test('caso 244: las políticas guardadas se aplican al devolver un objeto @organizacion @politicas @serie', async ({ browser, request }) => {
        const s = await abrirComoUsuario(browser, USUARIOS.dueno);
        ctx = s.context;
        const page = s.page;
        await abrirPoliticas(page);
        await campoDias(page).fill('');
        await fijar(interruptores(page).first(), true);
        await fijar(interruptores(page).nth(1), true);
        await visible(page.getByPlaceholder(DETALLE)).fill('foto del objeto con el dueño');
        await guardar(page);

        // el empleado tiene un objeto propio en el inventario
        const emp = await loginConOrg(request, EMPLEADO);
        const uuid = await receptarConFinder(request, emp.token, emp.orgId, `Billetera politicas ${Date.now()}`);

        await caso(244, 'el formulario de devolución muestra los requisitos de entrega y no deja devolver si no se cumplen', async () => {
            const e = await abrirComoUsuario(browser, EMPLEADO);
            ctxEmp = e.context;
            await irAlMenu(e.page, 'Ver inventario');
            await visible(e.page.getByText('Devolver', { exact: true })).first().click({ timeout: 15000 });
            await expect(visible(e.page.getByText('Registrar devolución', { exact: true }))).toBeVisible();
            await expect.soft(visible(e.page.getByText('Requisitos de entrega', { exact: true }))).toBeVisible({ timeout: 3000 });
            await expect.soft(visible(e.page.getByText(/Verificar identidad del reclamante/))).toBeVisible({ timeout: 3000 });
            await expect.soft(visible(e.page.getByText(/Solicitar evidencia adicional de propiedad/))).toBeVisible({ timeout: 3000 });
            // el servidor tampoco debería dejar devolver sin cumplir los requisitos
            const dni = String(30_000_000 + (Date.now() % 9_000_000));
            let rechazo = false;
            try {
                await devolver(request, emp.token, emp.orgId, uuid, dni);
            } catch (err) {
                rechazo = true;
            }
            expect.soft(rechazo, 'el servidor dejó registrar la devolución sin exigir los requisitos de la política').toBe(true);
        });
    });
});
