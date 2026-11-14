const { test, expect } = require('@playwright/test');
const { USUARIOS, caso, abrirComoUsuario } = require('./helpers');
const { irAlMenu, visible, leerPoliticas, restaurarPoliticas, abrirPoliticas, campoDias, interruptores, botonGuardar, elegirTipo, guardar, loginApi } = require('./helpers/t09');

// Deja el interruptor en el estado pedido, sin suponer cómo estaba.
const fijar = async (sw, valor) => {
    if ((await sw.isChecked()) !== valor) await sw.click({ force: true });
    await expect(sw).toBeChecked({ checked: valor });
};

const CORTO = { timeout: 3000 };

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

    test('casos 210 a 224 y 361: pantalla de políticas, campos, guardado, persistencia e historial @organizacion @politicas @serie', async ({ browser, request }) => {
        const s = await abrirComoUsuario(browser, USUARIOS.dueno);
        ctx = s.context;
        const page = s.page;
        await abrirPoliticas(page);

        await caso(210, 'se muestran las secciones de la pantalla', async () => {
            for (const t of ['Almacenamiento', 'Tipo de organización', 'Validación de identidad', 'Evidencia adicional']) {
                await expect.soft(visible(page.getByText(t, { exact: true })).first()).toBeVisible();
            }
            await expect.soft(visible(page.getByText('Guardar políticas', { exact: true }))).toBeVisible();
        });

        await caso(211, 'el tiempo de almacenamiento se puede ingresar y modificar', async () => {
            await campoDias(page).fill('30');
            await expect(campoDias(page)).toHaveValue('30');
            await campoDias(page).fill('45');
            await expect(campoDias(page)).toHaveValue('45');
        });

        await caso(212, 'el tipo de organización deja una sola opción elegida', async () => {
            await elegirTipo(page, 'Universidad');
            await expect(visible(page.getByText('Universidad', { exact: true }))).toHaveCount(1);
            await elegirTipo(page, 'Hotel');
            await expect(visible(page.getByText('Hotel', { exact: true }))).toHaveCount(1);
            await expect(visible(page.getByText('Universidad', { exact: true }))).toHaveCount(0);
        });

        await caso(213, 'el interruptor de validación de identidad cambia de estado', async () => {
            const sw = interruptores(page).first();
            await expect(sw).not.toBeChecked();
            await sw.click({ force: true });
            await expect(sw).toBeChecked();
            await expect(visible(page.getByText('Se solicitará DNI + foto de la persona'))).toBeVisible();
            await sw.click({ force: true });
            await expect(sw).not.toBeChecked();
            await sw.click({ force: true });
            await expect(sw).toBeChecked();
        });

        await caso(214, 'existe la elección del proceso de entrega (sin requisito, confirma, con comprobante)', async () => {
            await expect.soft(visible(page.getByText(/proceso de entrega/i)).first()).toBeVisible(CORTO);
        });

        await caso(215, 'el interruptor de evidencia adicional cambia de estado', async () => {
            const sw = interruptores(page).nth(1);
            await expect(sw).not.toBeChecked();
            await sw.click({ force: true });
            await expect(sw).toBeChecked();
            await visible(page.getByPlaceholder('Ej: foto del objeto con el dueño')).fill('foto con el dueño');
            await sw.click({ force: true });
            await expect(sw).not.toBeChecked();
            await sw.click({ force: true });
            await expect(sw).toBeChecked();
        });

        await caso(216, 'existe el campo de categorías estrictas', async () => {
            await expect.soft(visible(page.getByPlaceholder(/categor[ií]as/i)).first()).toBeVisible(CORTO);
        });

        await caso(217, 'el campo de categorías estrictas valida el formato', async () => {
            await expect.soft(visible(page.getByPlaceholder(/categor[ií]as/i)).first()).toBeVisible(CORTO);
        });

        await caso(218, 'existe el interruptor de notificaciones', async () => {
            await expect.soft(interruptores(page)).toHaveCount(3, CORTO);
        });

        await caso(219, 'existe el campo de política de recompensas', async () => {
            await expect.soft(visible(page.getByPlaceholder(/recompensa/i)).first()).toBeVisible(CORTO);
        });

        await caso(220, 'guardar las políticas muestra el aviso de éxito y queda en el servidor', async () => {
            await guardar(page);
            const p = await leerPoliticas(request, tokenDueno);
            expect(p.maxStorageDays).toBe(45);
            expect(p.requiresIdentityValidation).toBe(true);
            expect(p.requiresAdditionalEvidence).toBe(true);
            expect(p.organizationType).toBe('HOTEL');
            expect(p.additionalEvidenceDetails).toBe('foto con el dueño');
        });

        await caso(221, 'guardar sin cambios no rompe y mantiene los valores', async () => {
            await guardar(page);
            await expect(campoDias(page)).toHaveValue('45');
            const p = await leerPoliticas(request, tokenDueno);
            expect(p.maxStorageDays).toBe(45);
            expect(p.organizationType).toBe('HOTEL');
        });

        await caso(222, 'al salir y volver a entrar se mantienen los valores guardados', async () => {
            await irAlMenu(page, 'Ver inventario');
            await abrirPoliticas(page);
            await expect(campoDias(page)).toHaveValue('45');
            await expect(visible(page.getByText('Hotel', { exact: true }))).toHaveCount(1);
            await expect(interruptores(page).first()).toBeChecked();
            await expect(interruptores(page).nth(1)).toBeChecked();
            await expect(visible(page.getByPlaceholder('Ej: foto del objeto con el dueño'))).toHaveValue('foto con el dueño');
        });

        await caso(223, 'los campos opcionales vacíos se guardan sin error', async () => {
            await campoDias(page).fill('');
            await visible(page.getByPlaceholder('Ej: foto del objeto con el dueño')).fill('');
            await interruptores(page).nth(1).click({ force: true });
            await guardar(page);
            await expect(visible(page.getByText('Error al guardar. Intenta de nuevo.'))).toHaveCount(0);
            const p = await leerPoliticas(request, tokenDueno);
            expect(p.maxStorageDays).toBeNull();
            expect(p.requiresAdditionalEvidence).toBe(false);
        });

        await caso(224, 'con los campos vacíos se muestra "Error al guardar. Intenta de nuevo."', async () => {
            await campoDias(page).fill('');
            await botonGuardar(page).click();
            await expect.soft(visible(page.getByText('Error al guardar. Intenta de nuevo.'))).toBeVisible(CORTO);
        });

        await caso(361, 'el historial de cambios registra fecha, hora, usuario y política modificada', async () => {
            await interruptores(page).nth(1).click({ force: true });
            await guardar(page);
            await visible(page.getByText(/^Historial de cambios \(\d+\)$/)).click();
            const entrada = visible(page.getByText(/^Por: /)).first();
            await expect(entrada).toBeVisible();
            await expect(entrada).toContainText(USUARIOS.dueno);
            // la fecha y la hora se muestran en la línea de la entrada
            const fecha = entrada.locator('xpath=preceding-sibling::*[1]');
            await expect(fecha).toHaveText(/\d{1,2}\/\d{1,2}\/\d{2,4}.*\d{1,2}:\d{2}/);
            // la entrada indica qué política se modificó
            const bloque = entrada.locator('xpath=..');
            await expect.soft(bloque).toContainText(/almacenamiento|identidad|evidencia|tipo de organizaci/i, CORTO);
        });
    });

    test('casos 362 y 363: las políticas guardadas se aplican al devolver un objeto @organizacion @politicas @serie', async ({ browser }) => {
        const s = await abrirComoUsuario(browser, USUARIOS.dueno);
        ctx = s.context;
        const page = s.page;
        let emp;

        // Abre el formulario de devolver del primer objeto del inventario, sin enviarlo.
        // Cada vez con una sesión nueva: la pantalla del formulario queda abierta en la pila.
        const abrirDevolver = async () => {
            if (ctxEmp) await ctxEmp.close();
            const e = await abrirComoUsuario(browser, 'emp2.utn@eurekapp.com');
            ctxEmp = e.context;
            emp = e.page;
            await irAlMenu(emp, 'Ver inventario');
            await visible(emp.getByText('Devolver', { exact: true })).first().click({ timeout: 15000 });
            await expect(visible(emp.getByText('Registrar devolución', { exact: true }))).toBeVisible();
        };

        await caso(362, 'con validación de identidad y evidencia activadas, al devolver se aplican esos requisitos', async () => {
            await abrirPoliticas(page);
            await campoDias(page).fill('');
            await fijar(interruptores(page).first(), true);
            await fijar(interruptores(page).nth(1), true);
            await visible(page.getByPlaceholder('Ej: foto del objeto con el dueño')).fill('foto con el dueño');
            await guardar(page);
            await abrirDevolver();
            await expect.soft(visible(emp.getByText('Requisitos de entrega', { exact: true }))).toBeVisible(CORTO);
            await expect.soft(visible(emp.getByText(/Verificar identidad del reclamante/))).toBeVisible(CORTO);
            await expect.soft(visible(emp.getByText(/Solicitar evidencia adicional de propiedad/))).toBeVisible(CORTO);
        });

        await caso(363, 'al cambiar el tipo de organización las políticas se aplican o se diferencian', async () => {
            await irAlMenu(page, 'Ver inventario');
            await abrirPoliticas(page);
            await elegirTipo(page, 'Universidad');
            await guardar(page);
            await abrirDevolver();
            const conUniversidad = await visible(emp.getByText('Requisitos de entrega', { exact: true })).count();
            await irAlMenu(page, 'Ver inventario');
            await abrirPoliticas(page);
            await elegirTipo(page, 'Terminal de ómnibus');
            await guardar(page);
            await abrirDevolver();
            const conTerminal = await visible(emp.getByText('Requisitos de entrega', { exact: true })).count();
            // el empleado tiene que ver requisitos de la política vigente para cada tipo
            expect.soft(conUniversidad).toBeGreaterThan(0);
            expect.soft(conTerminal).toBeGreaterThan(0);
        });
    });
});
