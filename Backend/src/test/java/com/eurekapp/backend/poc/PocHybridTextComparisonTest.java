package com.eurekapp.backend.poc;

import com.eurekapp.backend.util.TextNormalizer;
import io.weaviate.client.v1.data.model.WeaviateObject;
import io.weaviate.client.v1.filters.Operator;
import io.weaviate.client.v1.filters.WhereFilter;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Harness de comparación de la PoC EU-142 (#9.5). Corre los 4 casos eje contra:
 *   - BASELINE: coseno denso solo (nearVector), que es exactamente el matching de texto actual.
 *   - HÍBRIDO: denso + BM25 (hybrid), con alpha ∈ {0.25, 0.5, 0.75} × {relativeScoreFusion, rankedFusion}.
 *
 * Para cada caso imprime la POSICIÓN del documento esperado (su par lost/found) en el ranking y su
 * score. La conclusión (alpha elegido, estrategia de fusión, si los trigramas ayudan o degradan) se
 * lee de la tabla impresa y se asienta en el tracker (#9.6). NO corre en CI: se saltea sin Weaviate
 * local (clase PocTextObject cargada) ni OPENAI_SECRET_KEY.
 *
 * Este test NO afirma un umbral: es exploratorio. Su valor es la tabla que imprime; el juicio sobre
 * los números es humano (#9.6).
 */
class PocHybridTextComparisonTest {

    private static final String TARGET_VECTOR = "text";
    private static final List<String> BM25_PROPERTIES = List.of("content");
    private static final List<String> FIELDS = List.of("content", "doc_id", "role", "case_axis");
    private static final int LIMIT = 24;

    // Grilla ancha para ver la FORMA de la curva (dónde el híbrido empieza a rescatar y dónde el ruido
    // de palabras clave lo tira abajo), no para clavar un valor: eso es EU-327 con datos reales.
    private static final double[] ALPHAS = {0.1, 0.3, 0.5, 0.7, 0.9};
    private static final String[] FUSIONS = {"relativeScoreFusion", "rankedFusion"};

    // La búsqueda de un objeto perdido se compara SÓLO contra objetos encontrados (nunca contra otra
    // búsqueda, ni contra sí misma). Sin este filtro, la publicación "perdida" gemela de la query
    // —texto casi idéntico— ocuparía el #1 y taparía la señal que queremos medir. Con el filtro, el
    // ideal por eje es el #1.
    private static final WhereFilter ONLY_FOUND = WhereFilter.builder()
            .path(new String[]{"role"}).operator(Operator.Equal).valueText("found").build();

    // Dirección inversa (flujo `notifyMatchingSavedSearches`): entra un objeto ENCONTRADO y se busca,
    // entre las búsquedas guardadas (role=lost), a quién le pertenece. Es donde vive el caso omisión.
    private static final WhereFilter ONLY_LOST = WhereFilter.builder()
            .path(new String[]{"role"}).operator(Operator.Equal).valueText("lost").build();

    /**
     * Los 4 casos eje. Cada uno usa la publicación "perdida" como texto de búsqueda y espera encontrar
     * a su par "encontrada" (mismo doc_id, role=found) lo más arriba posible del ranking.
     */
    private static final List<EjeCase> CASES = List.of(
            new EjeCase("sinonimos", "eje-sinonimos",
                    "Perdí mi mochila roja. Se me perdió una mochila de color rojo en la facultad, es de tela, tipo escolar, con dos bolsillos adelante."),
            new EjeCase("termino_raro", "eje-termino-raro",
                    "Perdí mi raqueta de tenis. Extravié una raqueta de tenis marca Prince, negra con amarillo. La dejé olvidada en las canchas del club."),
            new EjeCase("identificador", "eje-identificador",
                    "Perdí mi billetera con el DNI adentro. Se me cayó la billetera marrón con mi documento número 45.789.654 y varias tarjetas."),
            new EjeCase("typo", "eje-typo",
                    "Perdí el carnet de la biblioteca de Evelin. Se me perdió el carnet a nombre de Evelin Gómez, una credencial plástica celeste.")
    );

    @Test
    void compararBaselineVsHibridoSobreLos4EjesEImprimirTabla() {
        String apiKey = System.getenv("OPENAI_SECRET_KEY");
        assumeTrue(apiKey != null && !apiKey.isBlank(),
                "Sin OPENAI_SECRET_KEY: se saltea la comparación PoC (correr en local).");

        PocHybridTextHarness harness = new PocHybridTextHarness(apiKey);
        assumeTrue(harness.isReady(),
                "Weaviate no responde o falta la clase PocTextObject (correr create-poc-schema.sh).");

        harness.loadCorpus();

        StringBuilder report = new StringBuilder();
        report.append("\n================ PoC EU-142 · texto híbrido vs coseno denso ================\n");
        report.append("Ranking SÓLO sobre objetos encontrados (escenario real). Por celda: posición del par\n");
        report.append("esperado (#1 = ideal) y su score. Baseline = coseno denso solo (matching actual). LIMIT=")
                .append(LIMIT).append("\n\n");

        for (EjeCase c : CASES) {
            List<Float> queryVector = harness.embedNormalized(c.queryText());
            String normalizedQuery = TextNormalizer.normalize(c.queryText());

            report.append("── Eje: ").append(c.axis())
                    .append("  (busca el par de '").append(c.expectedDocId()).append("')\n");

            // BASELINE: coseno denso solo, tal como corre hoy la búsqueda de texto.
            List<WeaviateObject> baseline = harness.weaviateService.queryObjects(
                    PocHybridTextHarness.CLASS_NAME, queryVector, TARGET_VECTOR, ONLY_FOUND, FIELDS, LIMIT, 0);
            Ranked baseHit = rankOf(baseline, c.expectedDocId(), "found");
            report.append(String.format("   baseline (denso)               -> %s%n", baseHit.describe("certainty")));

            // HÍBRIDO: denso + BM25, barriendo alpha y estrategia de fusión.
            for (String fusion : FUSIONS) {
                for (double alpha : ALPHAS) {
                    List<WeaviateObject> hybrid = harness.weaviateService.hybridQuery(
                            PocHybridTextHarness.CLASS_NAME, normalizedQuery, queryVector, TARGET_VECTOR,
                            BM25_PROPERTIES, alpha, fusion, ONLY_FOUND, FIELDS, LIMIT);
                    Ranked hit = rankOf(hybrid, c.expectedDocId(), "found");
                    report.append(String.format("   hybrid a=%.2f %-20s -> %s%n",
                            alpha, fusion, hit.describe("score")));
                }
            }
            report.append("\n");
        }

        report.append("===========================================================================\n");
        System.out.println(report);
    }

    /**
     * Caso OMISIÓN / información asimétrica, en la DIRECCIÓN INVERSA (§8bis del tracker; flujo
     * {@code notifyMatchingSavedSearches}). Un objeto ENCONTRADO rico (billetera roja + DNI adentro)
     * entra al sistema y se busca a su dueño entre las búsquedas guardadas (role=lost). Compiten:
     *   A = omision-apariencia (describe sólo la apariencia; comparte casi todo el texto con el hallazgo)
     *   B = omision-dni        (aporta sólo el DNI; comparte poco texto pero el número es prueba unívoca)
     * El denso premia a A (más solapamiento) aunque B es casi con certeza el dueño. Se mide si el
     * híbrido por palabra (BM25 con IDF alto sobre el token del DNI) LEVANTA a B por encima de A.
     *
     * Correr con TOKENIZATION=word (create-poc-schema.sh): es la tokenización que la #9.6 recomienda.
     */
    @Test
    void compararOmisionEnDireccionInversaAvsB() {
        String apiKey = System.getenv("OPENAI_SECRET_KEY");
        assumeTrue(apiKey != null && !apiKey.isBlank(),
                "Sin OPENAI_SECRET_KEY: se saltea la comparación PoC (correr en local).");

        PocHybridTextHarness harness = new PocHybridTextHarness(apiKey);
        assumeTrue(harness.isReady(),
                "Weaviate no responde o falta la clase PocTextObject (correr create-poc-schema.sh).");

        harness.loadCorpus();

        // Query = texto del objeto ENCONTRADO rico (el que describe de más: apariencia + DNI adentro).
        String foundText = "Encontré una billetera roja. Encontré una billetera roja de cuerina con un "
                + "DNI 40682351 adentro y unas tarjetas. La tengo guardada para devolverla a su dueño.";
        List<Float> queryVector = harness.embedNormalized(foundText);
        String normalizedQuery = TextNormalizer.normalize(foundText);

        StringBuilder report = new StringBuilder();
        report.append("\n======== PoC EU-142 · OMISIÓN (dirección inversa: found -> ranking de lost) ========\n");
        report.append("Query = objeto ENCONTRADO rico (billetera roja + DNI 40682351). Ranking SÓLO sobre\n");
        report.append("role=lost. Compiten A=omision-apariencia (sólo apariencia) vs B=omision-dni (sólo DNI).\n");
        report.append("Ideal: B por encima de A (el DNI está literalmente dentro de la billetera hallada).\n\n");

        // BASELINE: coseno denso solo, tal como corre hoy la búsqueda de texto.
        List<WeaviateObject> baseline = harness.weaviateService.queryObjects(
                PocHybridTextHarness.CLASS_NAME, queryVector, TARGET_VECTOR, ONLY_LOST, FIELDS, LIMIT, 0);
        report.append(String.format("   baseline (denso)               -> %s%n",
                describeAvsB(baseline, "certainty")));

        // DIAGNÓSTICO: ranking COMPLETO de lost (para ver qué quedó #1 y no especular).
        report.append(dumpRanking("denso (baseline)", baseline, "certainty"));
        List<WeaviateObject> diagBm25 = harness.weaviateService.hybridQuery(
                PocHybridTextHarness.CLASS_NAME, normalizedQuery, queryVector, TARGET_VECTOR,
                BM25_PROPERTIES, 0.1, "relativeScoreFusion", ONLY_LOST, FIELDS, LIMIT);
        report.append(dumpRanking("hibrido word alpha=0.1 (casi BM25)", diagBm25, "score"));

        // HÍBRIDO: denso + BM25, barriendo alpha y estrategia de fusión.
        for (String fusion : FUSIONS) {
            for (double alpha : ALPHAS) {
                List<WeaviateObject> hybrid = harness.weaviateService.hybridQuery(
                        PocHybridTextHarness.CLASS_NAME, normalizedQuery, queryVector, TARGET_VECTOR,
                        BM25_PROPERTIES, alpha, fusion, ONLY_LOST, FIELDS, LIMIT);
                report.append(String.format("   hybrid a=%.2f %-20s -> %s%n",
                        alpha, fusion, describeAvsB(hybrid, "score")));
            }
        }

        report.append("==================================================================================\n");
        System.out.println(report);
    }

    /** Vuelca el ranking completo (posición, doc_id, score) para inspeccionar quién queda dónde. */
    private String dumpRanking(String label, List<WeaviateObject> results, String scoreLabel) {
        StringBuilder sb = new StringBuilder();
        sb.append("        ranking [").append(label).append("]:\n");
        for (int i = 0; i < results.size(); i++) {
            Map<String, Object> props = results.get(i).getProperties();
            Map<String, Object> additional = results.get(i).getAdditional();
            Object raw = additional == null ? null
                    : (additional.containsKey("score") ? additional.get("score") : additional.get("certainty"));
            sb.append(String.format("          #%-2d %-32s %s=%s%n",
                    i + 1, props.get("doc_id"), scoreLabel,
                    toDouble(raw) == null ? "n/a" : String.format("%.4f", toDouble(raw))));
        }
        return sb.toString();
    }

    /** Formatea el duelo A (apariencia) vs B (DNI) del caso omisión: posición y score de cada una. */
    private String describeAvsB(List<WeaviateObject> results, String scoreLabel) {
        Ranked a = rankOf(results, "omision-apariencia", "lost");
        Ranked b = rankOf(results, "omision-dni", "lost");
        String winner = (a.position() < 0 || b.position() < 0) ? "?"
                : (b.position() < a.position() ? "B (DNI) ✓" : "A (apariencia)");
        return String.format("A: %-18s B: %-18s [gana: %s]",
                a.describeShort(scoreLabel), b.describeShort(scoreLabel), winner);
    }

    /** Ubica el documento esperado (por doc_id + role) dentro del ranking y quién quedó en #1. */
    private Ranked rankOf(List<WeaviateObject> results, String expectedDocId, String expectedRole) {
        String topDocId = results.isEmpty() ? null
                : String.valueOf(results.get(0).getProperties().get("doc_id"));
        for (int i = 0; i < results.size(); i++) {
            Map<String, Object> props = results.get(i).getProperties();
            Object docId = props.get("doc_id");
            Object role = props.get("role");
            if (expectedDocId.equals(docId) && expectedRole.equals(role)) {
                Map<String, Object> additional = results.get(i).getAdditional();
                Object rawScore = additional == null ? null
                        : (additional.containsKey("score") ? additional.get("score") : additional.get("certainty"));
                return new Ranked(i + 1, toDouble(rawScore), topDocId);
            }
        }
        return new Ranked(-1, null, topDocId);
    }

    /** El score/certainty de la respuesta cruda de Weaviate puede venir como String o como Number. */
    private static Double toDouble(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof Number number) {
            return number.doubleValue();
        }
        return Double.parseDouble(raw.toString());
    }

    private record EjeCase(String axis, String expectedDocId, String queryText) {}

    private record Ranked(int position, Double score, String topDocId) {
        String describe(String scoreLabel) {
            if (position < 0) {
                return String.format("NO ENCONTRADO en el top   [#1=%s]", topDocId);
            }
            String scoreStr = score == null ? "n/a" : String.format("%.4f", score);
            String winner = position == 1 ? "" : String.format("   [le gana #1=%s]", topDocId);
            return String.format("rank #%-2d  (%s=%s)%s", position, scoreLabel, scoreStr, winner);
        }

        /** Versión compacta (posición + score) para el duelo A-vs-B del caso omisión. */
        String describeShort(String scoreLabel) {
            if (position < 0) {
                return "no-top";
            }
            String scoreStr = score == null ? "n/a" : String.format("%.4f", score);
            return String.format("#%-2d %s=%s", position, scoreLabel, scoreStr);
        }
    }
}
