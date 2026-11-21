// Convierte un resultados.json de Playwright en el estado de cada caso de la planilla.
// Uso: node e2e/resultados-por-caso.js <resultados.json> > casos.json
const fs = require('fs');

const ruta = process.argv[2];
if (!ruta) {
    console.error('Uso: node e2e/resultados-por-caso.js <resultados.json>');
    process.exit(2);
}
const reporte = JSON.parse(fs.readFileSync(ruta, 'utf8'));
const casos = {};

const primeraLinea = (e) => {
    const texto = (e && (e.message || e.value || e.stack)) || '';
    // Se quitan los códigos de color de la consola.
    return String(texto).replace(/\u001b\[[0-9;]*m/g, '').split('\n').map((l) => l.trim()).find(Boolean) || 'falló';
};

function anotar(numero, estado, test, error) {
    const actual = casos[numero];
    if (actual && actual.estado === 'FALLA') return; // si un caso falla en algún test, falla
    casos[numero] = estado === 'FALLA' ? { estado, test, error } : { estado, test };
}

// Los números de caso de un título: "caso 001", "caso 001/018", "casos 077, 094, 095 y 134".
function numerosDelTitulo(titulo) {
    const m = titulo.match(/\bcasos?\s+(\d{3}(?:\s*(?:,|\/|y)\s*\d{3})*)/i);
    return m ? m[1].match(/\d{3}/g) : [];
}

function pasos(lista, salida = []) {
    for (const p of lista || []) {
        salida.push(p);
        pasos(p.steps, salida);
    }
    return salida;
}

const ultimo = (t) => (t.results || [])[(t.results || []).length - 1];

function recorrer(suite, archivo) {
    archivo = suite.file || archivo;
    for (const spec of suite.specs || []) {
        for (const t of spec.tests || []) {
            const r = ultimo(t);
            if (!r || r.status === 'skipped') continue;
            const nombre = `${archivo} › ${spec.title}`;
            const fallaTest = r.status !== 'passed';
            const errorTest = primeraLinea(r.error || (r.errors || [])[0]);
            const delPaso = pasos(r.steps).filter((s) => /^caso \d{3}:/.test(s.title));
            if (delPaso.length) {
                for (const s of delPaso) {
                    const n = s.title.match(/^caso (\d{3}):/)[1];
                    if (s.error) anotar(n, 'FALLA', nombre, primeraLinea(s.error));
                    else anotar(n, 'PASA', nombre);
                }
                // Casos del título cuyo paso no llegó a correr porque el test se cortó antes.
                if (fallaTest) {
                    for (const n of numerosDelTitulo(spec.title)) {
                        if (!delPaso.some((s) => s.title.startsWith(`caso ${n}:`))) anotar(n, 'FALLA', nombre, `no se llegó a verificar: ${errorTest}`);
                    }
                }
                continue;
            }
            for (const n of numerosDelTitulo(spec.title)) {
                if (fallaTest) anotar(n, 'FALLA', nombre, errorTest);
                else anotar(n, 'PASA', nombre);
            }
        }
    }
    for (const s of suite.suites || []) recorrer(s, archivo);
}
for (const s of reporte.suites || []) recorrer(s, s.file);

const ordenado = Object.fromEntries(Object.entries(casos).sort(([a], [b]) => a.localeCompare(b)));
process.stdout.write(JSON.stringify(ordenado, null, 2) + '\n');
