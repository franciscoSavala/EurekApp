// EU-452 / EU-453: plazo máximo de guarda de la organización. Contra el servidor real, sin respuestas simuladas.
//
// Organización elegida: UTN FRC (dueño owner.utn, empleado emp1.utn). Es la que usa el carril serie para sus
// búsquedas y conteos, y este spec también es @serie: corre de a uno con ellos y nunca a la vez. El carril
// paralelo trabaja en las organizaciones 3 a 6 (Aero, Patio, UNC, Dino) y no toca esta. Con plazo de 365 días el
// seed (como mucho ~230 días de antigüedad) queda en plazo; al terminar se restaura la política original.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { USUARIOS, foto, nombreUnico, abrirComoUsuario, irAlMenu, bajarHastaVer } = require('./helpers');
const { casoContinuo: caso, noSePudoProbar } = require('./helpers/t17');
const { sesionDe } = require('./helpers/sesion');
const { URL_BACK, auth, leerPoliticas, restaurarPoliticas } = require('./helpers/t09');
const { abrirFormularioDevolucion, cargarFotoDeQuienRetira, completarDatos, dniUnico } = require('./helpers/t04');
const { tarjetas, tarjetaDe } = require('./helpers/r03');

const DIA = 24 * 3600 * 1000;
const PLAZO = 365;
const MENSAJE_OK = 'La devolución del objeto se registró correctamente.';

const dos = (n) => String(n).padStart(2, '0');
// Fecha y hora local sin zona, como las espera el servidor.
const fechaLocal = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
const haceDias = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const masDias = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
// Igual que la pantalla de detalle: día/mes/año sin ceros a la izquierda.
const fechaPantalla = (d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

test.describe('Plazo de guarda de la organización', () => {
    test.setTimeout(420_000);

    let request;
    let tokenDueno;
    let tokenEmp;
    let orgId;
    let original;
    let tituloVencido;
    let tituloPorVencer;
    let uuidVencido;
    let uuidPorVencer;
    let hallazgoVencido;
    let hallazgoPorVencer;
    let sufijoPlazo;
    let devueltoVencido = false;
    let devueltoPorVencer = false;

    const ponerPlazo = async (dias) => {
        const { history, ...valores } = original;
        const r = await request.put(`${URL_BACK}/organizations/policy`, { headers: auth(tokenDueno), data: { ...valores, maxStorageDays: dias } });
        expect(r.ok(), `no se pudo guardar el plazo ${dias}`).toBeTruthy();
    };

    const cargar = async (titulo, fecha) => {
        const r = await request.post(`${URL_BACK}/found-objects/organizations/${orgId}`, {
            headers: auth(tokenEmp),
            multipart: {
                title: titulo,
                detailed_description: 'Billetera marron de cuero con documentos',
                found_date: fechaLocal(fecha),
                latitude: '-31.4124',
                longitude: '-64.1867',
                file: { name: 'billetera.png', mimeType: 'image/png', buffer: fs.readFileSync(foto('billetera.png')) },
            },
        });
        if (!r.ok()) throw new Error(`cargar "${titulo}": ${r.status()} ${await r.text()}`);
        return (await r.json()).id;
    };

    const devolverApi = async (uuid) => {
        const r = await request.post(`${URL_BACK}/found-objects/return/${orgId}`, {
            headers: auth(tokenEmp),
            multipart: {
                firstName: 'Ana', lastName: 'Prueba', dni: dniUnico(), phoneNumber: '3514000000', found_object_uuid: uuid,
                identityVerified: 'true', evidenceVerified: 'true',
                file: { name: 'persona_retiro.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(foto('persona_retiro.jpg')) },
            },
        });
        if (!r.ok()) throw new Error(`devolver: ${r.status()} ${await r.text()}`);
    };

    /** Inventario completo (todas las páginas) por la API, con filtro opcional de vencidos. */
    const inventarioApi = async (soloVencidos = false) => {
        const todos = [];
        for (let p = 0; p < 100; p++) {
            const r = await request.get(`${URL_BACK}/found-objects/organizations/all/${orgId}?page=${p}&pageSize=50${soloVencidos ? '&expired=true' : ''}`, { headers: auth(tokenEmp) });
            expect(r.ok()).toBeTruthy();
            const j = await r.json();
            todos.push(...j.found_objects);
            if (!j.has_more) break;
        }
        return todos;
    };

    /** Busca por texto en la organización con el mismo pedido que usa la pantalla Buscar un objeto. */
    const buscarApi = async (texto, token) => {
        const q = new URLSearchParams({ query: texto, lost_date: fechaLocal(haceDias(500)), lost_date_to: fechaLocal(new Date()) });
        const r = await request.get(`${URL_BACK}/found-objects/organizations/${orgId}?${q}`, { headers: auth(token) });
        expect(r.ok(), `búsqueda: ${r.status()}`).toBeTruthy();
        return (await r.json()).found_objects.map((o) => o.title);
    };

    test.beforeAll(async ({ playwright }) => {
        request = await playwright.request.newContext();
        const dueno = await sesionDe(USUARIOS.dueno);
        const emp = await sesionDe(USUARIOS.empleado);
        tokenDueno = dueno.token;
        tokenEmp = emp.token;
        orgId = emp.orgId;
        original = await leerPoliticas(request, tokenDueno);
        await ponerPlazo(PLAZO);

        // Títulos casi iguales para que ninguno gane la búsqueda por parecerse más.
        sufijoPlazo = nombreUnico('zorrito').replace(/\s/g, '');
        tituloVencido = `Billetera ${sufijoPlazo} vencida`;
        tituloPorVencer = `Billetera ${sufijoPlazo} vigente`;
        hallazgoVencido = haceDias(400);
        hallazgoPorVencer = haceDias(300);
        uuidVencido = await cargar(tituloVencido, hallazgoVencido);
        uuidPorVencer = await cargar(tituloPorVencer, hallazgoPorVencer);
        test.info().annotations.push({ type: 'objetos', description: `${tituloVencido} / ${tituloPorVencer}` });
    });

    test.afterAll(async () => {
        try {
            if (tokenDueno && original) await restaurarPoliticas(request, tokenDueno, original);
        } finally {
            // Los dos objetos de prueba no pueden quedar en el inventario ni en las búsquedas de otras specs.
            try { if (uuidPorVencer && !devueltoPorVencer) await devolverApi(uuidPorVencer); } catch (e) { /* ya devuelto */ }
            try { if (uuidVencido && !devueltoVencido) await devolverApi(uuidVencido); } catch (e) { /* ya devuelto */ }
            if (request) await request.dispose();
        }
    });

    test('caso 362: un objeto vencido no aparece en la búsqueda del usuario y uno por vencer sí @organizacion @plazo @serie', async () => {
        await caso(362, 'al buscar por texto aparece el objeto de 300 días y NO el de 400 días (vencido), aunque se llamen casi igual', async () => {
            const usuario = await sesionDe(USUARIOS.usuario);
            // Mismo pedido que hace la pantalla (la búsqueda de la pantalla usa como fecha de pérdida "hace 2 días",
            // que deja afuera a todo objeto hallado hace meses: por eso la fecha de pérdida va en el pedido directo).
            const titulos = await buscarApi(`Billetera ${sufijoPlazo}`, usuario.token);
            expect(titulos, 'el objeto por vencer debería aparecer').toContain(tituloPorVencer);
            expect(titulos, 'el objeto vencido no debería aparecer').not.toContain(tituloVencido);
        });
    });

    test('caso 363: el empleado ve las etiquetas en el inventario y filtra los vencidos @organizacion @plazo @serie', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.empleado);
        try {
            await irAlMenu(page, 'Ver inventario');
            await expect(tarjetas(page).first()).toBeVisible();

            await caso(363, 'el empleado ve "Vencido" en el de 400 días y "Por vencer" en el de 300; los del seed no tienen etiqueta', async () => {
                await bajarHastaVer(page, tituloVencido);
                await expect(tarjetaDe(page, tituloVencido).getByText('Vencido', { exact: true })).toBeVisible();
                await bajarHastaVer(page, tituloPorVencer);
                await expect(tarjetaDe(page, tituloPorVencer).getByText('Por vencer', { exact: true })).toBeVisible();
                // Todo el inventario, por la API: solo estos dos están vencidos o por vencer (el resto está en plazo).
                const conEstado = (await inventarioApi()).filter((o) => o.storage_status === 'EXPIRED' || o.storage_status === 'EXPIRING').map((o) => o.title).sort();
                expect(conEstado).toEqual([tituloPorVencer, tituloVencido].sort());
            });

            await caso(363, 'al tocar "Vencidos" aparece solo el de 400 días; al tocar "Todos" vuelve el listado completo', async () => {
                await page.getByText('Vencidos', { exact: true }).locator('visible=true').click();
                await expect(tarjetaDe(page, tituloVencido)).toHaveCount(1);
                await expect(tarjetas(page)).toHaveCount(1);
                await expect(page.getByText(tituloPorVencer, { exact: true }).locator('visible=true')).toHaveCount(0);
                await page.getByText('Todos', { exact: true }).locator('visible=true').click();
                await expect.poll(async () => tarjetas(page).count()).toBeGreaterThan(1);
                await bajarHastaVer(page, tituloPorVencer);
            });
        } finally {
            await context.close();
        }
    });

    test('caso 364: el detalle muestra cuándo vence o venció el objeto @organizacion @plazo @serie', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.empleado);
        try {
            const abrirDetalle = async (titulo) => {
                await page.goto('/');
                await expect(page.getByText('Logout')).toBeVisible();
                await irAlMenu(page, 'Ver inventario');
                await bajarHastaVer(page, titulo);
                await tarjetaDe(page, titulo).getByText('Detalles', { exact: true }).click();
                await expect(page.getByText('Datos del objeto')).toBeVisible();
            };

            await caso(364, 'el detalle del de 400 días dice "Venció el <hallazgo + 365 días>" con la etiqueta Vencido', async () => {
                await abrirDetalle(tituloVencido);
                const esperado = fechaPantalla(masDias(hallazgoVencido, PLAZO));
                await expect(page.getByText(`Venció el ${esperado}`, { exact: true }).locator('visible=true')).toBeVisible();
                await expect(page.getByText('Vencido', { exact: true }).locator('visible=true')).toBeVisible();
            });

            await caso(364, 'el detalle del de 300 días dice "Vence el <hallazgo + 365 días>" con la etiqueta Por vencer', async () => {
                await abrirDetalle(tituloPorVencer);
                const esperado = fechaPantalla(masDias(hallazgoPorVencer, PLAZO));
                await expect(page.getByText(`Vence el ${esperado}`, { exact: true }).locator('visible=true')).toBeVisible();
                await expect(page.getByText('Por vencer', { exact: true }).locator('visible=true')).toBeVisible();
            });
        } finally {
            await context.close();
        }
    });

    test('caso 365: un objeto vencido se puede devolver @organizacion @plazo @serie', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.empleado);
        try {
            await caso(365, 'el empleado registra la devolución del objeto vencido y queda registrada sin error', async () => {
                await abrirFormularioDevolucion(page, tituloVencido);
                await cargarFotoDeQuienRetira(page, 'persona_retiro.jpg');
                await completarDatos(page, { dni: dniUnico() });
                // Si la política exige validar identidad o pedir evidencia, se marcan.
                const identidad = page.getByText(/Verifiqué la identidad de quien retira/);
                if (await identidad.count()) await identidad.click();
                const evidencia = page.getByText(/Ya pedí la evidencia adicional/);
                if (await evidencia.count()) await evidencia.click();
                await page.getByText('Registrar devolución', { exact: true }).click();
                await expect(page.getByText(MENSAJE_OK)).toBeVisible();
                devueltoVencido = true;
            });
        } finally {
            await context.close();
        }
    });

    test('caso 366: sin plazo configurado ningún objeto vence @organizacion @plazo @serie', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.empleado);
        try {
            await caso(366, 'con el plazo vacío el objeto de 300 días ya no tiene etiqueta y vuelve a aparecer en la búsqueda', async () => {
                await ponerPlazo(null);
                const vigente = await leerPoliticas(request, tokenDueno);
                if (vigente.maxStorageDays !== null) throw new Error(`el plazo no quedó vacío: ${vigente.maxStorageDays}`);
                // Se recarga la app: la pantalla de inicio ya había cargado el inventario con el plazo anterior.
                await page.goto('/');
                await expect(page.getByText('Logout')).toBeVisible();
                await irAlMenu(page, 'Ver inventario');
                await expect(tarjetas(page).first()).toBeVisible();
                await bajarHastaVer(page, tituloPorVencer);
                await expect(tarjetaDe(page, tituloPorVencer)).toHaveCount(1);
                await expect(tarjetaDe(page, tituloPorVencer).getByText(/^(Vencido|Por vencer)$/)).toHaveCount(0);
                const conEstado = (await inventarioApi()).filter((o) => o.storage_status);
                expect(conEstado, 'sin plazo ningún objeto debería tener estado').toEqual([]);
                expect(await inventarioApi(true), 'sin plazo no hay vencidos').toEqual([]);
                const usuario = await sesionDe(USUARIOS.usuario);
                expect(await buscarApi(`Billetera ${sufijoPlazo}`, usuario.token)).toContain(tituloPorVencer);
            });
        } finally {
            await context.close();
        }
    });
});
