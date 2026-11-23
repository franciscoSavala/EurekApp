// Devolución de un objeto cuyo finder está bloqueado por fraude (carril serie: crea y levanta un bloqueo).
// El usuario bloqueado no puede iniciar sesión, así que su XP y su aviso se leen en la base.
// El bloqueo se crea con una alerta propia sobre un usuario nuevo (no los bloqueados del seed) y al final
// el administrador marca como falsa alarma esa alerta y cualquier otra que haya dejado el test.
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const { caso, nombreUnico } = require('./helpers');
const sesion = require('./helpers/sesion');
const t = require('./helpers/t13');

const EMPLEADO = 'emp1.utn@eurekapp.com';
const ADMIN = 'soporte.eurekapp@gmail.com';
const AVISO = 'No recibiste puntos por esta devolución';

/** Corre SQL en la base de pruebas y devuelve las filas (sin encabezado), cada una como arreglo de columnas. */
function sql(consulta) {
    const salida = execFileSync('docker', ['exec', '-i', 'eurekapp-mysql', 'mysql', '-N', '-B', '--default-character-set=utf8mb4', '-ueurekapp', '-peurekapp', 'eurekapp'],
        { input: consulta, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
    return salida ? salida.split(/\r?\n/).map((l) => l.split('\t')) : [];
}

const mayorIdAlerta = () => Number(sql('SELECT COALESCE(MAX(id), 0) FROM fraud_alert;')[0][0]);

/** Bloquea al usuario por fraude como lo haría el sistema: una alerta activa que lo señala y un bloqueo vigente. */
function bloquear(userId) {
    const filas = sql(`
        INSERT INTO fraud_alert (created_at, reason, status, details) VALUES (NOW(), 'CASE_1', 'ACTIVE', 'Alerta del test del caso 242');
        SET @alerta = LAST_INSERT_ID();
        INSERT INTO fraud_alert_suspect_user (fraud_alert_id, user_id) VALUES (@alerta, ${Number(userId)});
        INSERT INTO fraud_block (blocked_at, expires_at, fraud_alert_id, target_user_id) VALUES (NOW(), NOW() + INTERVAL 7 DAY, @alerta, ${Number(userId)});
        SELECT @alerta;`);
    return Number(filas[0][0]);
}

test('caso 242: el finder bloqueado por fraude no suma puntos y recibe el aviso @fraude @serie', async ({ request }) => {
    test.setTimeout(300_000);
    const idAlertaPrevia = mayorIdAlerta();
    const tokenAdmin = await sesion.tokenDe(ADMIN);
    try {
        const finder = await t.registrarPaciente(request, 'bloq');
        const [[userId, xpAntes, devueltosAntes]] = sql(`SELECT id, xp, returned_objects FROM users WHERE username = '${finder.email}';`);
        const tokenEmp = await sesion.tokenDe(EMPLEADO);
        const titulo = nombreUnico('Billetera finder bloqueado');

        await caso(242, 'la devolución se completa, el XP del finder no cambia y recibe "No recibiste puntos por esta devolución"', async () => {
            // Se recepta antes del bloqueo: con el finder ya bloqueado el sistema no deja registrarlo (caso 078).
            const uuid = await t.receptarApi(request, tokenEmp, titulo, finder.email);
            bloquear(userId);
            expect(sql(`SELECT COUNT(*) FROM fraud_block WHERE target_user_id = ${userId} AND expires_at > NOW();`)[0][0]).toBe('1');

            const dev = await t.devolverApi(request, tokenEmp, uuid);
            expect(dev.ok(), `devolución: ${dev.status()}`).toBeTruthy();
            const det = await request.post(`${t.URL_BACK}/found-objects/getReturnedObject`,
                { headers: { Authorization: `Bearer ${tokenEmp}` }, data: { foundObjectUUID: uuid } });
            expect(det.ok()).toBeTruthy();

            const [[xp, devueltos]] = sql(`SELECT xp, returned_objects FROM users WHERE id = ${userId};`);
            expect(xp).toBe(xpAntes);
            expect(devueltos).toBe(devueltosAntes);

            const avisos = sql(`SELECT type, description FROM in_app_notifications WHERE user_id = ${userId} AND title = '${AVISO}';`);
            expect(avisos).toHaveLength(1);
            expect(avisos[0][0]).toBe('REWARD_BLOCKED');
            expect(avisos[0][1]).toContain(titulo);
        });
    } finally {
        // Toda alerta que haya quedado activa desde el inicio del test se marca como falsa alarma (levanta los bloqueos).
        const pendientes = sql(`SELECT id FROM fraud_alert WHERE id > ${idAlertaPrevia} AND status = 'ACTIVE';`).map((f) => f[0]);
        for (const id of pendientes) {
            const r = await request.post(`${t.URL_BACK}/fraud-alerts/${id}/resolve`, { headers: { Authorization: `Bearer ${tokenAdmin}` } });
            expect(r.ok(), `resolver la alerta ${id}: ${r.status()}`).toBeTruthy();
        }
        expect(sql(`SELECT COUNT(*) FROM fraud_alert WHERE id > ${idAlertaPrevia} AND status = 'ACTIVE';`)[0][0]).toBe('0');
    }
});
