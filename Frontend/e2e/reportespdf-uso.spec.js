// Exportación a PDF del reporte de uso del responsable de organización (casos 283, 448 a 450 y 453 a 460).
// En la web el PDF se arma en un iframe y sale por el diálogo de impresión del navegador: los tests leen
// el contenido que la app manda a imprimir y verifican por separado si el navegador descarga un archivo.
const { test, expect } = require('@playwright/test');
const { texto, instalarCapturaPdf, leerPdf, descargaAlExportar, abrirReporteUso, sembrarFeedback } = require('./helpers/t11');

let sembrado;

test.beforeAll(async ({ browser }) => {
    sembrado = await sembrarFeedback(browser);
});

/** Valor que la pantalla muestra encima de una etiqueta (por ejemplo "Búsquedas exitosas"). */
async function valorEnPantalla(page, etiqueta) {
    const lineas = (await page.locator('body').innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
    const i = lineas.indexOf(etiqueta);
    return i > 0 ? lineas[i - 1] : null;
}

test('casos 448, 453, 454, 455, 456 y 457: el PDF del reporte de uso trae el botón, métricas, gráficos, filtros, fecha, registros y lo mismo que la pantalla @reportes @reportespdf @paralelo', async ({ browser }) => {
    const { context, page } = await abrirReporteUso(browser);
    try {
        await test.step('caso 448: el reporte muestra el botón Exportar PDF', async () => {
            await expect(texto(page, 'Exportar PDF')).toBeVisible();
        });

        // Se aplica un filtro y se exporta una vez; los pasos siguientes leen ese PDF.
        await texto(page, 'Encontró objeto').click();
        await expect(texto(page, 'Exportar PDF')).toBeVisible();
        await expect(texto(page, 'Búsquedas registradas')).toBeVisible();
        const enPantalla = {};
        for (const e of ['Búsquedas registradas', 'Búsquedas exitosas', 'Búsquedas fallidas', 'Atenciones calificadas']) {
            enPantalla[e] = await valorEnPantalla(page, e);
        }
        const objetos = { 'Objetos encontrados': await valorEnPantalla(page, 'Objetos encontrados'), 'Objetos devueltos': await valorEnPantalla(page, 'Objetos devueltos') };
        await instalarCapturaPdf(page);
        await texto(page, 'Exportar PDF').click();
        const pdf = await leerPdf(page);

        await test.step('caso 453: el PDF incluye las métricas, los gráficos y las tablas del reporte', async () => {
            expect(pdf.texto).toContain('Métricas generales');
            expect(pdf.texto).toContain('Métricas de feedback');
            expect(pdf.html).toContain('<svg');
            expect(pdf.html).toContain('<table');
            expect(pdf.texto).toContain('Gráfico: Resultado de búsquedas');
            expect(pdf.texto).toContain('Registros individuales de búsquedas');
        });

        await test.step('caso 454: el PDF incluye los filtros aplicados al exportar', async () => {
            expect(pdf.texto).toMatch(/Período: \d{4}-\d{2}-\d{2}\s+—\s+\d{4}-\d{2}-\d{2}/);
            expect(pdf.texto).toContain('Agrupado por');
            expect(pdf.texto).toContain('Solo encontrados');
        });

        await test.step('caso 455: el PDF incluye la fecha y la hora de generación', async () => {
            expect(pdf.texto).toMatch(/Generado:\s*\d{1,2}\/\d{1,2}\/\d{4}[ ,]+\d{1,2}:\d{2}/);
        });

        await test.step('caso 456: cada registro del PDF trae ID, organización, objeto, puntaje, si lo encontró, fecha y comentario', async () => {
            const tabla = pdf.texto.slice(pdf.texto.indexOf('Registros individuales de búsquedas'));
            expect(tabla).toContain(sembrado.titulo);
            for (const columna of ['ID', 'Organización', 'Objeto', 'Encontrado', 'Fecha']) expect.soft(tabla, `columna ${columna}`).toContain(columna);
            expect.soft(tabla, 'columna de puntaje o calificación').toMatch(/Puntaje|Calificaci[óo]n/);
            expect.soft(tabla, 'columna de comentario del usuario').toContain('Comentario');
        });

        await test.step('caso 457: el PDF muestra los mismos valores que la pantalla', async () => {
            for (const [etiqueta, valor] of [...Object.entries(enPantalla), ...Object.entries(objetos)]) {
                expect(valor, `valor de ${etiqueta} en pantalla`).not.toBeNull();
            }
            const pdfLinea = (etiqueta) => new RegExp(`${etiqueta}\\s*(\\d+)`);
            for (const [etiqueta, valor] of Object.entries(enPantalla)) {
                const m = pdf.texto.match(pdfLinea(etiqueta));
                expect.soft(m && m[1], `${etiqueta} en el PDF`).toBe(valor);
            }
            const encontrados = pdf.texto.match(/Objetos encontrados\s*(\d+)/);
            expect.soft(encontrados && encontrados[1], 'Objetos encontrados en el PDF').toBe(objetos['Objetos encontrados']);
            const devueltos = pdf.texto.match(/Objetos devueltos\s*(\d+)/);
            expect.soft(devueltos && devueltos[1], 'Objetos devueltos en el PDF').toBe(objetos['Objetos devueltos']);
        });
    } finally {
        await context.close();
    }
});

test('casos 283, 449, 450, 458 y 459: al exportar el PDF del reporte de uso el navegador descarga un archivo con el nombre del reporte y la fecha @reportes @reportespdf @paralelo', async ({ browser }) => {
    const { context, page } = await abrirReporteUso(browser);
    try {
        await instalarCapturaPdf(page);
        const descarga = await descargaAlExportar(page, texto(page, 'Exportar PDF'));
        const nombre = descarga ? descarga.suggestedFilename() : '';

        await test.step('caso 283: el sistema descarga el reporte de opiniones en formato PDF', async () => {
            expect(descarga, 'descarga del navegador').not.toBeNull();
            expect(nombre).toMatch(/\.pdf$/i);
        });
        await test.step('caso 449: el sistema descarga el reporte de uso del sistema en PDF', async () => {
            expect(descarga, 'descarga del navegador').not.toBeNull();
            expect(nombre).toMatch(/uso.*\.pdf$/i);
        });
        await test.step('caso 450: el sistema descarga el reporte de precisión de coincidencias en PDF', async () => {
            expect(descarga, 'descarga del navegador').not.toBeNull();
            const pdf = await leerPdf(page);
            expect(pdf.texto).toContain('Resultado de búsquedas');
        });
        await test.step('caso 458: el archivo PDF se descarga automáticamente al presionar Exportar PDF', async () => {
            expect(descarga, 'descarga automática del navegador').not.toBeNull();
        });
        await test.step('caso 459: el nombre del archivo incluye el nombre del reporte y la fecha de generación', async () => {
            expect(descarga, 'descarga del navegador').not.toBeNull();
            expect(nombre).toMatch(/Reporte.*Uso.*\d{4}-\d{2}-\d{2}\.pdf$/i);
        });
    } finally {
        await context.close();
    }
});

test('caso 460: si falla la generación del PDF aparece un mensaje de error @reportes @reportespdf @paralelo', async ({ browser }) => {
    const { context, page } = await abrirReporteUso(browser);
    try {
        // El PDF de la web se arma en el navegador, sin pedido al servidor: se simula la falla de la
        // generación haciendo que escribir el documento del iframe lance un error.
        await instalarCapturaPdf(page, { fallar: true });
        await texto(page, 'Exportar PDF').click();
        await expect(texto(page, 'No se pudo exportar el PDF. Intentá nuevamente.')).toBeVisible();
    } finally {
        await context.close();
    }
});
