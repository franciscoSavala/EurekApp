// PDF del reporte de fraude del administrador (caso 324) y restricción a quienes no tienen
// reportes (caso 325).
const { test, expect } = require('@playwright/test');
const { USUARIOS, USUARIOS_PARALELO } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const { enlaceMenu, abrirMenuDesdeInicio } = require('./helpers/t01');
const { irAlReporte, generarRango } = require('./helpers/t06');
const { URL_BACK, texto, auth, tokenDe, instalarCapturaPdf, leerPdf, descargaAlExportar } = require('./helpers/t11');

test('caso 324: el administrador exporta el reporte de usuarios con fraude y se abre el diálogo de impresión del PDF @reportes @reportespdf @paralelo', async ({ browser }) => {
    const { context, page } = await abrirComo(browser, USUARIOS.admin);
    try {
        await irAlReporte(page);
        // Las alertas del seed son anteriores a los últimos 30 días que trae el filtro por defecto.
        await generarRango(page, '2026-01-01', '2100-01-01');
        const boton = texto(page, 'Exportar PDF');
        await instalarCapturaPdf(page);
        const descarga = await descargaAlExportar(page, boton);

        await test.step('caso 324: se abre el diálogo de impresión con el PDF del reporte de usuarios con fraude y las tarjetas y filtros de la pantalla', async () => {
            // Lo que la app manda a imprimir sí es el reporte de fraude.
            const pdf = await leerPdf(page);
            expect.soft(pdf.texto).toMatch(/fraude/i);
            expect.soft(pdf.texto).toContain('Métricas del período');
            expect.soft(pdf.texto).toMatch(/Período|Desde/i);
            expect(pdf.impresiones, 'se abrió el diálogo de impresión').toBeGreaterThan(0);
            expect(descarga, 'no es una descarga del navegador').toBeNull();
        });
    } finally {
        await context.close();
    }
});

for (const [rol, email] of [['usuario común', USUARIOS_PARALELO.usuarioValeria], ['empleado', USUARIOS_PARALELO.empleadoUnc]]) {
    test(`caso 325: el ${rol} sin permisos no puede exportar reportes a PDF y el servidor rechaza sus pedidos @reportes @reportespdf @paralelo`, async ({ browser }) => {
        const { context, page } = await abrirComo(browser, email);
        try {
            await test.step('caso 325: el sistema impide la exportación PDF: sin reportes en el menú ni botón Exportar PDF, y el servidor rechaza los pedidos', async () => {
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
            });
        } finally {
            await context.close();
        }
    });
}
