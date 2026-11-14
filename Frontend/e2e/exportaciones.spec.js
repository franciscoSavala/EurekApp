const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { USUARIOS, abrirComoUsuario, irAlMenu } = require('./helpers');

/** Aprieta el botón y devuelve el contenido del archivo descargado, sin la marca de orden de bytes. */
async function descargar(page, boton) {
    const [descarga] = await Promise.all([page.waitForEvent('download'), boton.click()]);
    const contenido = fs.readFileSync(await descarga.path(), 'utf8').replace(/^﻿/, '');
    return { nombre: descarga.suggestedFilename(), lineas: contenido.split(/\r?\n/).filter(Boolean) };
}

/** Cambia el filtro "Desde" o "Hasta" de la pantalla de reportes escribiendo la fecha. */
async function cambiarFecha(page, etiqueta, fecha) {
    await page.getByText(etiqueta, { exact: true }).locator('xpath=following-sibling::*[1]').click();
    const campo = page.locator('input[type="date"]');
    await campo.fill(fecha);
    await campo.press('Enter');
}

test.describe('Exportaciones de reportes a CSV', () => {
    test('casos 259 y 260: el dueño de la organización descarga el CSV del reporte de uso con su encabezado @exportaciones @serie', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.dueno);
        await irAlMenu(page, 'Reportes');
        const exportar = page.getByText('Exportar CSV', { exact: true });
        await expect(exportar).toBeVisible();

        const csv = await descargar(page, exportar);

        expect(csv.nombre).toBe('feedback-report.csv');
        expect(csv.lineas[0]).toBe('ID;Organización;Objeto encontrado;¿Encontró el objeto?;Fecha');
        await context.close();
    });

    test('caso 261: sin datos en el período el CSV se descarga solo con el encabezado @exportaciones @serie', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.dueno);
        await irAlMenu(page, 'Reportes');
        await cambiarFecha(page, 'Desde', '2020-01-01');
        await cambiarFecha(page, 'Hasta', '2020-01-31');
        await expect(page.getByText('2020-01-31')).toBeVisible();

        const csv = await descargar(page, page.getByText('Exportar CSV', { exact: true }));

        expect(csv.lineas).toEqual(['ID;Organización;Objeto encontrado;¿Encontró el objeto?;Fecha']);
        await context.close();
    });

    test('casos 259 y 260: el administrador descarga el CSV del reporte de fraude con datos @exportaciones @paralelo', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        await irAlMenu(page, 'Alertas de fraude');
        await page.getByText('Ver reporte', { exact: true }).click();
        // Las alertas del seed son anteriores a los últimos 30 días que trae el filtro por defecto.
        await cambiarFecha(page, 'Desde', '2026-01-01');
        await page.getByText('Generar reporte', { exact: true }).click();
        const exportar = page.getByText('Exportar CSV', { exact: true });
        await expect(exportar).toBeVisible();

        const csv = await descargar(page, exportar);

        expect(csv.nombre).toBe('fraud-report.csv');
        expect(csv.lineas[0]).toBe('userId;email;fullName;fraudCount;activeCount;falsePositiveCount;historicalCount;reasons');
        expect(csv.lineas.length).toBeGreaterThan(1);
        await context.close();
    });

    test('el administrador descarga el CSV del reporte de opiniones de usabilidad de la app @exportaciones @paralelo', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        await irAlMenu(page, 'Opiniones sobre la app');
        const exportar = page.getByText('Exportar CSV', { exact: true });
        await expect(exportar).toBeVisible();

        const csv = await descargar(page, exportar);

        expect(csv.nombre).toBe('usability-feedback-report.csv');
        expect(csv.lineas[0]).toBe('id;starRating;aspects;comment;context;createdAt');
        await context.close();
    });
});
