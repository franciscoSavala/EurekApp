const { test, expect } = require('@playwright/test');
const { USUARIOS, abrirComoUsuario, irAlMenu } = require('./helpers');
const { casoContinuo } = require('./helpers/t17');
const { descargar, abrirPrecision, escribirFecha } = require('./helpers/r08');

const ENCABEZADO = 'ID;Organización;Objeto encontrado;¿Encontró el objeto?;Fecha';

test.describe('Exportaciones de reportes a CSV', () => {
    test('casos 195, 196 y 197: el administrador exporta el CSV del reporte de precisión con datos y sin datos @exportaciones @paralelo', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        let csv;

        await casoContinuo(195, 'Exportar CSV descarga feedback-report.csv con los registros de feedback del período', async () => {
            await abrirPrecision(page);
            await escribirFecha(page, 'Desde', '2026-01-01');
            csv = await descargar(page, page.getByText('Exportar CSV', { exact: true }).locator('visible=true'));
            expect(csv.nombre).toBe('feedback-report.csv');
            expect(csv.lineas.length, 'registros de feedback del período').toBeGreaterThan(1);
        });

        await casoContinuo(196, 'la primera fila es el encabezado y cada fila siguiente trae los cinco datos', async () => {
            expect(csv, 'archivo descargado en el caso anterior').toBeTruthy();
            expect(csv.lineas[0]).toBe(ENCABEZADO);
            for (const fila of csv.lineas.slice(1)) expect(fila.split(';').length, fila).toBe(5);
        });

        await casoContinuo(197, 'sin feedbacks en el período se descarga solo la fila de encabezado', async () => {
            await abrirPrecision(page);
            await escribirFecha(page, 'Desde', '2020-01-01');
            await escribirFecha(page, 'Hasta', '2020-01-31');
            const vacio = await descargar(page, page.getByText('Exportar CSV', { exact: true }).locator('visible=true'));
            expect(vacio.nombre).toBe('feedback-report.csv');
            expect(vacio.lineas).toEqual([ENCABEZADO]);
        });
        await context.close();
    });

    test('el administrador descarga el CSV del reporte de fraude con datos @exportaciones @paralelo', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        await irAlMenu(page, 'Alertas de fraude');
        await page.getByText('Ver reporte', { exact: true }).click();
        // Las alertas del seed son anteriores a los últimos 30 días que trae el filtro por defecto.
        await escribirFecha(page, 'Desde', '2026-01-01');
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
