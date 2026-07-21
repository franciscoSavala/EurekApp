package com.eurekapp.backend.poc;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Verificación de carga del corpus PoC (EU-142 #9.3). NO corre en CI: requiere Weaviate local con la
 * clase PocTextObject creada (create-poc-schema.sh) y la clave de OpenAI en el entorno. Si falta
 * alguna, el test se SALTEA (assumeTrue), no falla. Se ejecuta a mano, en local, con los containers
 * arriba, para confirmar que las 33 publicaciones quedan cargadas con su vector denso.
 */
class PocCorpusLoadTest {

    @Test
    void deberiaCargarLas33PublicacionesDelCorpus() {
        String apiKey = System.getenv("OPENAI_SECRET_KEY");
        assumeTrue(apiKey != null && !apiKey.isBlank(),
                "Sin OPENAI_SECRET_KEY: se saltea la carga del corpus PoC (correr en local).");

        PocHybridTextHarness harness = new PocHybridTextHarness(apiKey);
        assumeTrue(harness.isReady(),
                "Weaviate no responde o falta la clase PocTextObject (correr create-poc-schema.sh).");

        List<PocHybridTextHarness.CorpusDoc> docs = harness.loadCorpus();

        assertThat(docs).hasSize(48);
        assertThat(harness.countObjects()).isEqualTo(48L);

        // Los 4 ejes deben tener su par completo (lost + found con el mismo doc_id) para que el
        // harness de comparación (#9.5) pueda medir si la query encuentra a su pareja.
        for (String eje : List.of("eje-sinonimos", "eje-termino-raro", "eje-identificador", "eje-typo")) {
            assertThat(docs.stream().filter(d -> d.docId().equals(eje)))
                    .as("el eje %s debe tener par lost+found", eje)
                    .hasSize(2);
        }
    }
}
