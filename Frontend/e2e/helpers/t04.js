// Utilidades de la tanda de devolución y objetos devueltos.
const { expect } = require('@playwright/test');
const { foto, elegirArchivo, irAlMenu, bajarHastaVer } = require('../helpers');

// Un DNI distinto en cada corrida: el mismo DNI en 3 devoluciones bloquea al empleado (fraude).
const dniUnico = () => String(20000000 + Math.floor(Math.random() * 20000000));

/** En el inventario, la tarjeta del objeto con ese título. */
const tarjetaInventario = (page, titulo) =>
    page.getByText(titulo, { exact: true }).locator("xpath=ancestor::div[.//div[text()='Devolver']][1]");

/** En "Ver objetos devueltos", la tarjeta del objeto con ese título. */
const tarjetaDevuelto = (page, titulo) =>
    page.locator('div')
        .filter({ has: page.getByText(titulo, { exact: true }) })
        .filter({ has: page.getByText('Ver devolución', { exact: true }) })
        .filter({ has: page.locator('[style*="background-image"]') })
        .last();

/** La imagen de una tarjeta o pantalla: en la web la app la dibuja como fondo de un bloque. */
const imagenDe = (zona) => zona.locator('[style*="background-image"]').first();

/** Recepta un objeto con foto, título y descripción. Devuelve el título. */
async function receptarConDescripcion(page, titulo, descripcion) {
    await irAlMenu(page, 'Receptar un objeto');
    await page.getByPlaceholder('Escribe un título').fill(titulo);
    await page.locator('input[type="file"]').first().setInputFiles(foto('billetera.png'));
    await expect(page.getByText('Seleccionar foto')).toBeVisible();
    await page.getByPlaceholder('Agrega una descripción').fill(descripcion);
    await page.getByText('Receptar objeto encontrado', { exact: true }).click();
    await expect(page.getByText('El objeto fue cargado al inventario con éxito.')).toBeVisible();
    await page.getByText('Cerrar', { exact: true }).click();
    return titulo;
}

/** Abre el formulario de devolución del objeto desde el inventario. */
async function abrirFormularioDevolucion(page, titulo) {
    // La pantalla de inicio ya cargó el inventario antes de que el test creara el objeto: se vuelve a cargar la app.
    await page.goto('/');
    await expect(page.getByText('Logout')).toBeVisible();
    await irAlMenu(page, 'Ver inventario');
    await bajarHastaVer(page, titulo);
    await tarjetaInventario(page, titulo).getByText('Devolver', { exact: true }).click();
    await expect(page.getByText('Registrar devolución', { exact: true })).toBeVisible();
}

const cargarFotoDeQuienRetira = (page, archivo = 'persona_retiro.jpg') =>
    elegirArchivo(page, () => page.getByText('Seleccionar foto').last().click(), foto(archivo));

async function completarDatos(page, { nombre = 'Ana', apellido = 'Prueba', dni, telefono = '3514000000' }) {
    await page.getByPlaceholder('Ingresa el nombre').fill(nombre);
    await page.getByPlaceholder('Ingresa el apellido').fill(apellido);
    await page.getByPlaceholder('Ingresa el número de documento').fill(dni);
    await page.getByPlaceholder('Ingresa un teléfono de contacto').fill(telefono);
}

module.exports = { imagenDe, receptarConDescripcion, dniUnico, tarjetaInventario, tarjetaDevuelto, abrirFormularioDevolucion, cargarFotoDeQuienRetira, completarDatos };
