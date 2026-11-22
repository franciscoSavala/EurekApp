// Exportación a PDF del reporte de uso (casos 322, 323 y 326 a 330).
// En la web el PDF se arma en un iframe y sale por el diálogo de impresión del navegador: los tests leen
// el contenido que la app manda a imprimir y verifican por separado si el navegador descarga un archivo.
const { test, expect } = require('@playwright/test');
const { USUARIOS } = require('./helpers');
const { texto, instalarCapturaPdf, leerPdf, descargaAlExportar, abrirReporteUso, sembrarFeedback } = require('./helpers/t11');
const { pasoContinuo } = require('./helpers/t17');
const { abrirComo } = require('./helpers/t02');
const { abrirMenuDesdeInicio, enlaceMenu } = require('./helpers/t01');

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

test('casos 322, 326, 327 y 328: el dueño ve el botón Exportar PDF y el PDF trae métricas, gráficos, tablas, filtros y fecha y hora de generación @reportes @reportespdf @paralelo', async ({ browser }) => {
    const { context, page } = await abrirReporteUso(browser);
    try {
        await pasoContinuo('caso 322: el reporte habilitado muestra el botón Exportar PDF', async () => {
            await expect(texto(page, 'Exportar PDF')).toBeVisible();
        });

        // Se aplica un filtro (la agrupación por semana) y se exporta una vez; los pasos siguientes leen ese PDF.
        await texto(page, 'Semana').click();
        await expect(texto(page, 'Exportar PDF')).toBeVisible();
        await expect(texto(page, 'Atenciones calificadas')).toBeVisible();
        const enPantalla = {};
        for (const e of ['Atenciones calificadas', 'Objetos encontrados', 'Objetos devueltos']) {
            enPantalla[e] = await valorEnPantalla(page, e);
        }
        await instalarCapturaPdf(page);
        await texto(page, 'Exportar PDF').click();
        const pdf = await leerPdf(page);

        await pasoContinuo('caso 326: el PDF incluye las métricas, los gráficos y las tablas del reporte, con las mismas cifras de la pantalla', async () => {
            expect(pdf.texto).toContain('Métricas generales');
            expect(pdf.texto).toContain('Calificación de la atención');
            expect(pdf.html).toContain('<svg');
            expect(pdf.html).toContain('<table');
            expect(pdf.texto).not.toContain('Registros individuales de búsquedas');
            for (const [etiqueta, valor] of Object.entries(enPantalla)) {
                expect(valor, `valor de ${etiqueta} en pantalla`).not.toBeNull();
                const m = pdf.texto.match(new RegExp(`${etiqueta}\\s*(\\d+)`));
                expect.soft(m && m[1], `${etiqueta} en el PDF`).toBe(valor);
            }
        });

        await pasoContinuo('caso 327: el PDF incluye los filtros aplicados al exportar', async () => {
            expect(pdf.texto).toMatch(/Período: \d{4}-\d{2}-\d{2}\s+—\s+\d{4}-\d{2}-\d{2}/);
            expect(pdf.texto).toContain('Agrupado por');
            expect(pdf.texto).toMatch(/Agrupado por:\s*Semana/);
        });

        await pasoContinuo('caso 328: el PDF incluye la fecha y la hora de generación', async () => {
            expect(pdf.texto).toMatch(/Generado:\s*\d{1,2}\/\d{1,2}\/\d{4}[ ,]+\d{1,2}:\d{2}/);
        });
    } finally {
        await context.close();
    }
});

test('caso 323: al exportar el PDF del reporte de uso el dueño ve el diálogo de impresión con las secciones de uso y de calificación de la atención @reportes @reportespdf @paralelo', async ({ browser }) => {
    const { context, page } = await abrirReporteUso(browser);
    try {
        await instalarCapturaPdf(page);
        const descarga = await descargaAlExportar(page, texto(page, 'Exportar PDF'));

        await pasoContinuo('caso 323: se abre el diálogo de impresión del PDF (no una descarga) con las secciones de uso y de calificación de la atención', async () => {
            const pdf = await leerPdf(page);
            expect(pdf.impresiones, 'se abrió el diálogo de impresión').toBeGreaterThan(0);
            expect(descarga, 'no es una descarga del navegador').toBeNull();
            expect.soft(pdf.texto).toContain('Reporte de uso del sistema');
            expect.soft(pdf.texto).toContain('Calificación de la atención');
        });
    } finally {
        await context.close();
    }
});

test('caso 329: el administrador exporta el PDF del reporte de precisión de coincidencias y los registros traen solo ID, Organización, Objeto, Encontrado y Fecha @reportes @reportespdf @paralelo', async ({ browser }) => {
    const { context, page } = await abrirComo(browser, USUARIOS.admin);
    try {
        await pasoContinuo('caso 329: el administrador abre el reporte, exporta el PDF y cada registro trae ID, Organización, Objeto, Encontrado y Fecha, sin puntaje ni comentario', async () => {
            await abrirMenuDesdeInicio(page);
            await expect(enlaceMenu(page, 'Precisión de búsquedas'), 'el menú del administrador debería tener el reporte de precisión').toHaveCount(1);
            await enlaceMenu(page, 'Precisión de búsquedas').click();
            await expect(texto(page, 'Exportar PDF')).toBeVisible();
            await instalarCapturaPdf(page);
            await texto(page, 'Exportar PDF').click();
            const pdf = await leerPdf(page);
            const tabla = pdf.texto.slice(pdf.texto.indexOf('Registros individuales de búsquedas'));
            for (const columna of ['ID', 'Organización', 'Objeto', 'Encontrado', 'Fecha']) expect.soft(tabla, `columna ${columna}`).toContain(columna);
            expect.soft(tabla, 'sin puntaje').not.toMatch(/Puntaje|Calificaci[óo]n/);
            expect.soft(tabla, 'sin comentario').not.toContain('Comentario');
        });
    } finally {
        await context.close();
    }
});

test('caso 330: si falla la generación del PDF aparece un mensaje de error @reportes @reportespdf @paralelo', async ({ browser }) => {
    const { context, page } = await abrirReporteUso(browser);
    try {
        await pasoContinuo('caso 330: ante una falla al exportar el sistema muestra el mensaje de error', async () => {
            // El PDF de la web se arma en el navegador, sin pedido al servidor: se simula la falla de la
            // generación haciendo que escribir el documento del iframe lance un error.
            await instalarCapturaPdf(page, { fallar: true });
            await texto(page, 'Exportar PDF').click();
            await expect(texto(page, 'No se pudo exportar el PDF. Intentá nuevamente.')).toBeVisible();
        });
    } finally {
        await context.close();
    }
});
