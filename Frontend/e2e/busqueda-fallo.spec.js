// EU-338: si la búsqueda o la carga de establecimientos fallan, se avisa y se puede reintentar (casos 376 y 377).
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO } = require('./helpers');
const { casoContinuo: caso } = require('./helpers/t17');
const T02 = require('./helpers/t02');

test.describe('Búsqueda: fallos del servidor', () => {
    test.setTimeout(180_000);

    test('caso 376: si la búsqueda falla, se avisa y se puede reintentar @busqueda @paralelo', async ({ browser }) => {
        const { context, page } = await T02.abrirComo(browser, USUARIOS_PARALELO.usuarioValeria);
        try {
            await caso(376, 'con el buscador caído aparece el aviso con "Reintentar"; al reintentar con el buscador sano avanza a resultados', async () => {
                const buscador = (url) => url.port === '8080' && /^\/found-objects\/organizations\/\d+$/.test(url.pathname) && url.searchParams.has('query');
                await page.route(buscador, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"search_unavailable","message":"No pudimos completar la búsqueda. Intentá de nuevo."}' }));
                await T02.prepararBusqueda(page, 'UTN FRC', 2);
                await T02.descripcion(page).fill('Billetera marron de cuero');
                await T02.botonBuscar(page).click();
                await expect(page.getByText('No pudimos completar la búsqueda. Intentá de nuevo.')).toBeVisible({ timeout: 30000 });
                await expect(page.getByText('Reintentar', { exact: true })).toBeVisible();
                await expect(page.getByText('No se encontraron coincidencias para tu búsqueda.')).toHaveCount(0);
                await page.unroute(buscador);
                await page.getByText('Reintentar', { exact: true }).click();
                await T02.esperarResultado(page);
            });
        } finally {
            await context.close();
        }
    });

    test('caso 377: si los establecimientos no cargan, se avisa y se puede reintentar @busqueda @paralelo', async ({ browser }) => {
        const { context, page } = await T02.abrirComo(browser, USUARIOS_PARALELO.usuarioValeria);
        try {
            await caso(377, 'aparece "No pudimos cargar los establecimientos." con "Reintentar"; al reintentar el desplegable lista los establecimientos', async () => {
                const establecimientos = (url) => url.port === '8080' && url.pathname === '/organizations';
                await page.route(establecimientos, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"error"}' }));
                await T02.irABuscar(page);
                await expect(page.getByText('No pudimos cargar los establecimientos.')).toBeVisible({ timeout: 30000 });
                await expect(page.getByText('Reintentar', { exact: true })).toBeVisible();
                await page.unroute(establecimientos);
                await page.getByText('Reintentar', { exact: true }).click();
                await expect(page.getByText('No pudimos cargar los establecimientos.')).toHaveCount(0);
                await expect(page.locator('select').first().locator('option', { hasText: 'UTN FRC' })).toHaveCount(1);
            });
        } finally {
            await context.close();
        }
    });
});
