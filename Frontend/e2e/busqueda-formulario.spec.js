// Pantalla Buscar un objeto: formulario, ubicación, filtros avanzados y carga de la foto.
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, caso, foto, fotoPesada } = require('./helpers');
const t = require('./helpers/t02');

const PIN_POR_DEFECTO = { latitude: -31.4124, longitude: -64.1867 };

/** URL de la primera búsqueda al servidor que hace la pantalla (con texto o con foto). */
const pedidoDeBusqueda = (page) => page.waitForRequest((r) => /\/found-objects(\/|\?)/.test(r.url()) && /[?&](query)=/.test(r.url()), { timeout: 30000 });

/** Dirección del fondo de la imagen cargada en el contenedor de la foto (vacío si no hay ninguna). */
const imagenCargada = (page) => page.evaluate(() => {
    const conFondo = [...document.querySelectorAll('div')].find((e) => /url\(/.test(getComputedStyle(e).backgroundImage) && e.getBoundingClientRect().width > 100);
    return conFondo ? getComputedStyle(conFondo).backgroundImage : '';
});

test.describe('Buscar un objeto: formulario', () => {
    let context;
    let page;

    test.beforeEach(async ({ browser }) => {
        ({ context, page } = await t.abrirComo(browser, USUARIOS_PARALELO.usuarioValeria));
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('caso 033: la pantalla muestra todos los campos de la búsqueda @busqueda @paralelo', async () => {
        await caso(33, 'se ven descripción, foto opcional con su aviso, establecimiento, mapa, fecha/hora, filtros avanzados y Buscar objeto', async () => {
            await t.irABuscar(page);
            await expect.soft(page.getByText('Descripción del objeto:')).toBeVisible();
            await expect.soft(page.getByText('Foto del objeto (opcional):')).toBeVisible();
            await expect.soft(page.getByText('Cargar una foto mejora la precisión de la búsqueda')).toBeVisible();
            await expect.soft(page.getByText('Establecimiento donde lo perdiste')).toBeVisible();
            await expect.soft(page.locator('select').first().locator('option:checked')).toHaveText('No lo recuerdo / No lo sé');
            await expect.soft(page.locator('.leaflet-container')).toBeVisible();
            await expect.soft(page.getByText('Fecha y hora en la que crees haberlo perdido:')).toBeVisible();
            await expect.soft(page.getByText(/^\d{1,2}\/\d{1,2}\/\d{4}$/)).toBeVisible();
            await expect.soft(page.getByText(/^\d{1,2}:\d{2}/).first()).toBeVisible();
            await expect.soft(page.getByText('Filtros avanzados', { exact: true })).toBeVisible();
            await expect.soft(t.botonBuscar(page)).toBeVisible();
        });
    });

    test('caso 034: sin descripción, con el establecimiento sin recordar y un lugar en el mapa, no se busca y se avisa @busqueda @paralelo', async () => {
        await t.irABuscar(page);
        let seBusco = false;
        page.on('request', (r) => { if (/\/found-objects(\/|\?)/.test(r.url()) && r.method() !== 'OPTIONS') seBusco = true; });
        await t.arrastrarPin(page, 60, 30);
        await t.botonBuscar(page).click();
        await page.waitForTimeout(2500);

        await caso(34, 'sin descripción no se realiza la búsqueda y aparece el aviso "Falta la descripción"', async () => {
            expect.soft(seBusco, 'el sistema ejecutó la búsqueda sin descripción').toBe(false);
            await expect.soft(page.getByText('Falta la descripción', { exact: true })).toBeVisible({ timeout: 2000 });
            await expect.soft(page.getByText('Contanos qué objeto perdiste, aunque sean dos palabras ("mochila azul").')).toBeVisible({ timeout: 2000 });
        });
    });

    test('caso 036: el pin marcado en el mapa es la ubicación con la que se busca @busqueda @paralelo', async () => {
        await t.irABuscar(page);
        await t.descripcion(page).fill('billetera marron');
        await t.arrastrarPin(page, 120, 80);
        const pedido = pedidoDeBusqueda(page);
        await t.botonBuscar(page).click();

        await caso(36, 'la búsqueda usa la ubicación marcada, no la que había por defecto', async () => {
            const url = new URL((await pedido).url());
            const latitud = Number(url.searchParams.get('latitude'));
            const longitud = Number(url.searchParams.get('longitude'));
            // Mover el pin a la derecha y hacia abajo lleva la longitud hacia el este y la latitud hacia el sur.
            expect.soft(longitud).toBeGreaterThan(PIN_POR_DEFECTO.longitude);
            expect.soft(latitud).toBeLessThan(PIN_POR_DEFECTO.latitude);
        });
    });

    test('caso 039: Limpiar filtros deja el color vacío y la fecha límite en "Sin límite" @busqueda @paralelo', async () => {
        await t.irABuscar(page);
        await t.abrirFiltros(page);

        await caso(39, 'tras escribir un color y elegir una fecha límite, Limpiar filtros los deja como al inicio', async () => {
            const color = page.getByPlaceholder('Ej: rojo, azul oscuro...');
            await color.fill('negro');
            const limite = new Date(Date.now() + 30 * 24 * 3600 * 1000);
            const fecha = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`;
            await t.elegirFechaLimite(page, limite.getFullYear(), limite.getMonth() + 1, limite.getDate());
            await expect.soft(page.getByText(fecha, { exact: true })).toBeVisible();
            await page.getByText('Limpiar filtros', { exact: true }).click();
            await expect.soft(color).toHaveValue('');
            await expect.soft(page.getByText('Sin límite', { exact: true })).toBeVisible();
        });
    });

    test('casos 045, 046, 049 y 050: cargar, reemplazar y validar formato y tamaño de la foto @busqueda @paralelo', async () => {
        await t.irABuscar(page);

        await caso(45, 'una imagen válida queda cargada en el contenedor', async () => {
            await t.cargarFoto(page, foto('billetera_otro_angulo.jpg'));
            await expect.soft(page.getByText('Seleccionar foto')).toHaveCount(0);
            expect.soft(await imagenCargada(page)).toContain('url(');
        });

        let primera;
        await caso(46, 'al elegir otra imagen, la nueva reemplaza a la anterior', async () => {
            primera = await imagenCargada(page);
            // El contenedor ofrece quitar la foto; después se elige la otra.
            // El botón es un ícono de la fuente de íconos: su único texto es un carácter de uso privado.
            await page.locator('div[tabindex="0"]').filter({ hasText: /^[-]$/ }).click();
            await expect(page.getByText('Seleccionar foto')).toBeVisible();
            await t.cargarFoto(page, foto('reemplazo_zapatilla.jpg'));
            await expect(page.getByText('Seleccionar foto')).toHaveCount(0);
            const segunda = await imagenCargada(page);
            expect.soft(segunda).toContain('url(');
            expect.soft(segunda).not.toBe(primera);
        });

        await page.reload();
        await t.irABuscar(page);

        await caso(49, 'un archivo que no es .jpg, .jpeg ni .png no se carga y aparece "Formato no permitido"', async () => {
            await t.cargarFoto(page, foto('formato_invalido.gif'));
            await expect.soft(page.getByText('Formato no permitido')).toBeVisible();
            await expect.soft(page.getByText('Solo se permiten imágenes .jpg, .jpeg o .png')).toBeVisible();
            await expect.soft(page.getByText('Seleccionar foto')).toBeVisible();
            await t.cargarFoto(page, { name: 'otra.webp', mimeType: 'image/webp', buffer: Buffer.from('RIFF0000WEBPVP8 ') });
            await expect.soft(page.getByText('Formato no permitido').first()).toBeVisible();
            await expect.soft(page.getByText('Seleccionar foto')).toBeVisible();
        });

        await caso(50, 'una imagen de más de 5 MB se rechaza con "Imagen muy grande"', async () => {
            await page.reload();
            await t.irABuscar(page);
            await t.cargarFoto(page, { name: 'pesada.jpg', mimeType: 'image/jpeg', buffer: fotoPesada(6) });
            await expect.soft(page.getByText('Imagen muy grande')).toBeVisible();
            await expect.soft(page.getByText('La foto no debe superar los 5 MB')).toBeVisible();
            await expect.soft(page.getByText('Seleccionar foto')).toBeVisible();
        });
    });
});
