// PDF del reporte de fraude del administrador (casos 448 y 451) y restricción a quienes no tienen
// reportes (caso 452).
const { test, expect } = require('@playwright/test');
const { USUARIOS, USUARIOS_PARALELO } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const { enlaceMenu, abrirMenuDesdeInicio } = require('./helpers/t01');
const { irAlReporte, generarRango } = require('./helpers/t06');
const { URL_BACK, texto, auth, tokenDe, instalarCapturaPdf, leerPdf, descargaAlExportar } = require('./helpers/t11');

test('casos 448 y 451: el administrador ve Exportar PDF en el reporte de usuarios con fraudes y el navegador descarga el PDF @reportes @reportespdf @paralelo', async ({ browser }) => {
    const { context, page } = await abrirComo(browser, USUARIOS.admin);
    try {
        await irAlReporte(page);
        // Las alertas del seed son anteriores a los últimos 30 días que trae el filtro por defecto.
        await generarRango(page, '2026-01-01', '2100-01-01');
        const boton = texto(page, 'Exportar PDF');

        await test.step('caso 448: el reporte de fraude muestra el botón Exportar PDF', async () => {
            await expect(boton).toBeVisible();
        });

        await instalarCapturaPdf(page);
        const descarga = await descargaAlExportar(page, boton);

        await test.step('caso 451: el sistema genera y descarga el reporte de usuarios con fraudes detectados en PDF', async () => {
            // Lo que la app manda a imprimir sí es el reporte de fraude.
            const pdf = await leerPdf(page);
            expect.soft(pdf.texto).toMatch(/fraude/i);
            expect(descarga, 'descarga del navegador').not.toBeNull();
            expect(descarga.suggestedFilename()).toMatch(/\.pdf$/i);
        });
    } finally {
        await context.close();
    }
});

for (const [rol, email] of [['usuario común', USUARIOS_PARALELO.usuarioValeria], ['empleado', USUARIOS_PARALELO.empleadoUnc]]) {
    test(`caso 452: el ${rol} no tiene reportes para exportar a PDF y el servidor rechaza sus pedidos @reportes @reportespdf @paralelo`, async ({ browser }) => {
        const { context, page } = await abrirComo(browser, email);
        try {
            await abrirMenuDesdeInicio(page);
            for (const opcion of ['Reportes', 'Alertas de fraude', 'Opiniones sobre la app']) {
                await expect(enlaceMenu(page, opcion), `el menú no debería tener "${opcion}"`).toHaveCount(0);
            }
            await expect(page.getByText('Exportar PDF')).toHaveCount(0);

            // Tampoco puede pedir los datos del reporte por la API.
            const headers = auth(await tokenDe(page));
            for (const ruta of ['/feedback/report?from=2020-01-01&to=2100-01-01&groupBy=MONTH', '/feedback/records?from=2020-01-01&to=2100-01-01', '/reports?from=2020-01-01&to=2100-01-01&groupBy=MONTH', '/fraud-alerts/report?from=2020-01-01&to=2100-01-01']) {
                const r = await page.request.get(`${URL_BACK}${ruta}`, { headers });
                expect(r.ok(), `${ruta} respondió ${r.status()}`).toBe(false);
            }
        } finally {
            await context.close();
        }
    });
}
