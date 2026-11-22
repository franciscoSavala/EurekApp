const { test, expect } = require('@playwright/test');
const { USUARIOS, nombreUnico, abrirComoUsuario, irAlMenu, bajarHastaVer, cargarListadoCompleto } = require('./helpers');
const { casoContinuo, noSePudoProbar } = require('./helpers/t17');
const { dniUnico, cargarFotoDeQuienRetira, completarDatos, abrirFormularioDevolucion } = require('./helpers/t04');
const { receptarApi, devolverApi, alertaDelDni, resolverAlertaApi } = require('./helpers/t07');
const { leerPoliticas, restaurarPoliticas, URL_BACK, auth } = require('./helpers/t09');
const { politicaApi, devueltosApi, receptarCompleto } = require('./helpers/r04');
const { sesionDe } = require('./helpers/sesion');

// Sesión guardada del usuario del seed, con el formato { token, orgId } que usan los helpers.
const conSesion = async (email) => {
    const s = await sesionDe(email);
    return { token: s.token, orgId: s.orgId };
};

const MENSAJE_OK = 'La devolución del objeto se registró correctamente.';

test.describe('Devolución de un objeto', () => {
    let context;
    let page;

    test.beforeEach(async ({ browser }) => {
        ({ context, page } = await abrirComoUsuario(browser, USUARIOS.empleado));
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('casos 090, 092 y 093: el formulario de devolución, los campos obligatorios y el formato del DNI @devolucion @serie', async ({ request }) => {
        await irAlMenu(page, 'Ver inventario');
        await page.getByText('Devolver', { exact: true }).first().click();

        await casoContinuo(90, 'Devolver abre el formulario con foto (Seleccionar foto y Sacar Foto), datos de la persona, email opcional y el botón Registrar devolución', async () => {
            await expect(page.getByText('Foto de la persona que se llevará el objeto:')).toBeVisible();
            await expect.soft(page.getByText('Seleccionar foto').last()).toBeVisible();
            await expect.soft(page.getByText('Sacar Foto').last()).toBeVisible();
            await expect.soft(page.getByText('Nombre', { exact: true })).toBeVisible();
            await expect.soft(page.getByText('Apellido', { exact: true })).toBeVisible();
            await expect.soft(page.getByText('DNI', { exact: true })).toBeVisible();
            await expect.soft(page.getByText('Teléfono', { exact: true })).toBeVisible();
            await expect.soft(page.getByPlaceholder('Ingresa el nombre')).toBeVisible();
            await expect.soft(page.getByPlaceholder('Ingresa el apellido')).toBeVisible();
            await expect.soft(page.getByPlaceholder('Ingresa el número de documento')).toBeVisible();
            await expect.soft(page.getByPlaceholder('Ingresa un teléfono de contacto')).toBeVisible();
            await expect.soft(page.getByText(/Usuario de Eurekapp \(email, opcional\)/)).toBeVisible();
            await expect.soft(page.getByPlaceholder('Ingresa el email del usuario')).toBeVisible();
            await expect.soft(page.getByText('Registrar devolución', { exact: true })).toBeVisible();
            // Si la organización configuró política de entrega, aparece el bloque de requisitos.
            // Las políticas solo las lee el dueño de la organización.
            const p = await politicaApi(request, (await conSesion(USUARIOS.dueno)).token);
            const configurada = !!p && (p.requiresIdentityValidation || p.requiresAdditionalEvidence || p.deliveryProcess === 'WITH_SIGNATURE' || p.deliveryProcess === 'WITH_RECEIPT');
            if (configurada) await expect.soft(page.getByText('Requisitos de entrega', { exact: true })).toBeVisible();
        });

        await casoContinuo(92, 'sin completar nada cada campo vacío muestra "Dato obligatorio."; con los campos completos y sin foto se pide la foto', async () => {
            await page.getByText('Registrar devolución', { exact: true }).click();
            // Nombre, apellido, DNI y teléfono vacíos: un aviso por cada uno.
            await expect.soft(page.getByText('Dato obligatorio.').locator('visible=true')).toHaveCount(4);
            await page.getByPlaceholder('Ingresa el nombre').fill('Ana');
            await page.getByPlaceholder('Ingresa el apellido').fill('Prueba');
            await page.getByPlaceholder('Ingresa el número de documento').fill('12345678');
            await page.getByPlaceholder('Ingresa un teléfono de contacto').fill('3514000000');
            await page.getByText('Registrar devolución', { exact: true }).click();
            await expect.soft(page.getByText('La foto es obligatoria.')).toBeVisible();
            await expect(page.getByText(MENSAJE_OK)).toHaveCount(0);
            await cargarFotoDeQuienRetira(page);
        });

        await casoContinuo(93, 'las letras no se escriben en el DNI y con 5 dígitos aparece "Número de documento inválido." sin registrar', async () => {
            const dni = page.getByPlaceholder('Ingresa el número de documento');
            await dni.fill('abcd');
            await expect.soft(dni).toHaveValue('');
            await dni.fill('12345');
            await page.getByPlaceholder('Ingresa el nombre').fill('Ana');
            await page.getByPlaceholder('Ingresa el apellido').fill('Prueba');
            await page.getByPlaceholder('Ingresa un teléfono de contacto').fill('3514000000');
            await page.getByText('Registrar devolución', { exact: true }).click();
            await expect(page.getByText('Número de documento inválido.')).toBeVisible();
            await expect(page.getByText(MENSAJE_OK)).toHaveCount(0);
        });
    });

    test('casos 091, 098, 099 y 110: devuelve un objeto, se confirma, sale del inventario y aparece en los devueltos @devolucion @serie', async ({ request }) => {
        const emp = await conSesion(USUARIOS.empleado);
        const titulo = nombreUnico('Billetera devolver e2e');
        await receptarCompleto(request, emp.token, emp.orgId, titulo);
        let registrada = false;

        await abrirFormularioDevolucion(page, titulo);
        await cargarFotoDeQuienRetira(page, 'persona_retiro.jpg');
        await completarDatos(page, { dni: dniUnico() });
        // Con el email vacío.
        await expect(page.getByPlaceholder('Ingresa el email del usuario')).toHaveValue('');
        await page.getByText('Registrar devolución', { exact: true }).click();

        await casoContinuo(98, 'Confirmación visual: ícono de check verde y el texto "La devolución del objeto se registró correctamente."', async () => {
            const mensaje = page.getByText(MENSAJE_OK);
            await expect(mensaje).toBeVisible();
            registrada = true;
            await expect.soft(mensaje).toHaveCSS('color', 'rgb(0, 128, 0)');
            // El ícono es el elemento que acompaña al texto, en el mismo verde.
            const icono = mensaje.locator('xpath=preceding-sibling::*[1]');
            await expect.soft(icono).toBeVisible();
            await expect.soft(icono).toHaveCSS('color', 'rgb(0, 128, 0)');
        });

        await casoContinuo(91, 'Registro exitoso: aparece el mensaje de éxito y el objeto deja de figurar en el inventario', async () => {
            if (!registrada) return noSePudoProbar('la devolución no se registró');
            await expect(page.getByText(MENSAJE_OK)).toBeVisible();
            // Tras registrar, la pantalla queda en el formulario: se vuelve al listado con el botón de volver.
            await page.goBack();
            await expect(page.getByText('Devolver', { exact: true }).locator('visible=true').first()).toBeVisible();
            await cargarListadoCompleto(page);
            await expect(page.getByText(titulo, { exact: true }).locator('visible=true')).toHaveCount(0);
        });

        await casoContinuo(99, 'Persistencia de devolución: al volver al inventario el objeto ya no está disponible', async () => {
            if (!registrada) return noSePudoProbar('la devolución no se registró');
            await page.goto('/');
            await expect(page.getByText('Logout')).toBeVisible();
            await irAlMenu(page, 'Ver inventario');
            await expect(page.getByText('Devolver', { exact: true }).locator('visible=true').first()).toBeVisible();
            await cargarListadoCompleto(page);
            await expect(page.getByText(titulo, { exact: true }).locator('visible=true')).toHaveCount(0);
        });

        await casoContinuo(110, 'Persistencia de objeto devuelto: aparece en Ver objetos devueltos', async () => {
            if (!registrada) return noSePudoProbar('la devolución no se registró');
            await page.goto('/');
            await expect(page.getByText('Logout')).toBeVisible();
            await irAlMenu(page, 'Ver objetos devueltos');
            await bajarHastaVer(page, titulo);
            await expect(page.getByText(titulo, { exact: true }).locator('visible=true')).toBeVisible();
        });
    });

    test('caso 097: el bloque Requisitos de entrega lista lo que configuró la organización @devolucion @serie', async ({ request }) => {
        const tokenDueno = (await conSesion(USUARIOS.dueno)).token;
        const original = await leerPoliticas(request, tokenDueno);
        try {
            const { history, ...valores } = original;
            const r = await request.put(`${URL_BACK}/organizations/policy`, {
                headers: auth(tokenDueno),
                data: { ...valores, requiresIdentityValidation: true, requiresAdditionalEvidence: true, additionalEvidenceDetails: 'foto con el dueño' },
            });
            expect(r.ok()).toBeTruthy();

            await casoContinuo(97, 'con validación de identidad y evidencia adicional activadas, Devolver muestra "Requisitos de entrega" con lo configurado', async () => {
                await irAlMenu(page, 'Ver inventario');
                await page.getByText('Devolver', { exact: true }).locator('visible=true').first().click();
                await expect(page.getByText('Requisitos de entrega', { exact: true })).toBeVisible();
                await expect.soft(page.getByText(/Verificar identidad del reclamante/)).toBeVisible();
                await expect.soft(page.getByText(/Solicitar evidencia adicional de propiedad: foto con el dueño/)).toBeVisible();
            });
        } finally {
            await restaurarPoliticas(request, tokenDueno, original);
        }
    });

    test('caso 096: un documento bloqueado por fraude no puede retirar un objeto @devolucion @serie', async ({ request }) => {
        test.setTimeout(240000);
        const dni = dniUnico();
        const otro = await conSesion('emp2.utn@eurekapp.com');
        const admin = await conSesion(USUARIOS.admin);
        try {
            // Cuatro objetos: tres se devuelven con el mismo DNI (genera la alerta y el bloqueo del DNI), el cuarto es el que se intenta retirar.
            const titulos = [];
            const uuids = [];
            for (let i = 0; i < 4; i++) {
                const t = nombreUnico('Objeto doc bloqueado');
                titulos.push(t);
                uuids.push(await receptarApi(request, otro.token, otro.orgId, t));
            }
            for (let i = 0; i < 3; i++) await devolverApi(request, otro.token, otro.orgId, uuids[i], dni);
            expect(await alertaDelDni(request, admin.token, dni)).toBeTruthy();

            await casoContinuo(96, 'al registrar la devolución con el DNI bloqueado no se registra y el aviso indica el motivo del bloqueo', async () => {
                await abrirFormularioDevolucion(page, titulos[3]);
                await cargarFotoDeQuienRetira(page);
                await completarDatos(page, { dni });
                await page.getByText('Registrar devolución', { exact: true }).click();
                await expect(page.getByText(/bloqueado por sospecha de fraude/).locator('visible=true').first()).toBeVisible();
                await expect.soft(page.getByText(/sospecha de fraude: \S+/).locator('visible=true').first()).toBeVisible();
                await expect(page.getByText(MENSAJE_OK)).toHaveCount(0);
            });
        } finally {
            // Limpieza: la alerta pasa a falsa alarma y se levanta el bloqueo del DNI y del empleado.
            const alerta = await alertaDelDni(request, admin.token, dni);
            if (alerta && alerta.status === 'ACTIVE') await resolverAlertaApi(request, admin.token, alerta.id);
        }
    });

    test('caso 111: con más de 25 devoluciones el objeto recién devuelto aparece primero en Ver objetos devueltos @devolucion @serie', async ({ request }) => {
        test.setTimeout(300000);
        const emp = await conSesion(USUARIOS.empleado);
        // Precondición del caso: el test completa por su cuenta las devoluciones que falten hasta pasar de 25.
        const faltan = 26 - (await devueltosApi(request, emp.token)).length;
        for (let i = 0; i < faltan; i++) {
            const relleno = await receptarApi(request, emp.token, emp.orgId, nombreUnico('Objeto relleno e2e'));
            await devolverApi(request, emp.token, emp.orgId, relleno, dniUnico());
        }
        const titulo = nombreUnico('Billetera orden e2e');
        const uuid = await receptarApi(request, emp.token, emp.orgId, titulo);
        await devolverApi(request, emp.token, emp.orgId, uuid, dniUnico());

        await casoContinuo(111, 'la organización tiene más de 25 devoluciones y el objeto nuevo es el primero de la lista', async () => {
            expect((await devueltosApi(request, emp.token)).length, 'la organización tiene que tener más de 25 devoluciones').toBeGreaterThan(25);
            await irAlMenu(page, 'Ver objetos devueltos');
            const primero = page.getByText('Ver devolución', { exact: true }).locator('visible=true').first();
            await expect(primero).toBeVisible();
            // La tarjeta es el ancestro más grande que tiene un solo botón Ver devolución.
            const tarjeta = primero.locator("xpath=ancestor::div[count(.//div[text()='Ver devolución'])=1][last()]");
            await expect(tarjeta).toContainText(titulo);
        });
    });
});
