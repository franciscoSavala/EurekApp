package com.eurekapp.backend.service.client;

import com.eurekapp.backend.configuration.TextClassificationProperties;
import com.eurekapp.backend.model.ObjectCategory;
import com.eurekapp.backend.util.TextNormalizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Clasificador de categoría por TEXTO (EU-337 punto 3): compara el embedding de la descripción del
 * usuario contra una NUBE de frases por categoría, en castellano, y se queda con la categoría cuya
 * frase más cercana gane —siempre que ese parecido supere un piso absoluto—.
 *
 * <p><b>Por qué el embedding de OpenAI y no el encoder de texto de CLIP.</b> {@code clip-vit-base-patch32}
 * es un modelo INGLÉS (por eso los prompts de {@code clip-service} están en inglés a propósito) y el
 * usuario escribe en castellano. El vector de texto de OpenAI ya se calcula en cada búsqueda y rinde
 * en castellano: alcanza con embeber las frases de categoría con ese mismo modelo. Sin modelo nuevo.</p>
 *
 * <p><b>El corte va sobre el COSENO CRUDO, no sobre la confianza.</b> Es la diferencia grande con el
 * clasificador de imagen, donde el corte SÍ es una confianza (softmax sobre los logits de CLIP).
 * Medido el 2026-08-07 sobre 23 textos que nombran el objeto y 8 que no: la confianza no separa nada
 * —es RELATIVA entre categorías, así que <i>"negra con detalles rojos, la perdí en el colectivo"</i>
 * gana BILLETERA con 79% de confianza aunque no nombre ningún objeto—. Lo que separa es cuánto se
 * parece el texto a la mejor frase de cualquier categoría: los que nombran el objeto viven en
 * 0.4856–0.7497 y los que no, en 0.2932–0.4709.</p>
 *
 * <p><b>Abstenerse es barato; equivocarse no.</b> El filtro por categoría es DURO: una categoría
 * errada esconde el objeto para siempre y en silencio. Abstenerse sólo devuelve la decisión a la
 * foto, que es el comportamiento que ya había. Por eso el piso se pone entre las dos poblaciones y
 * no se lo estira para ganar cobertura.</p>
 */
@Service
public class EmbeddingTextClassificationService implements TextClassificationService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingTextClassificationService.class);

    /**
     * Nubes de frases por categoría, en CASTELLANO. Espejan las de {@code clip-service/app.py}: las
     * mismas cinco categorías anchas y el mismo criterio de vocabulario (OTROS tiene nube PROPIA, no
     * es sólo el descarte).
     *
     * <p><b>Probado y descartado:</b> agregarle a cada nube la variante con forma de oración
     * (<i>"perdí una billetera"</i>) EMPEORA la separación —los textos que no nombran el objeto son
     * justamente relatos de pérdida, así que suben ellos también: el techo de los vagos pasó de
     * 0.4709 a 0.6102 y se comió el margen entero—. Las frases van como sintagma nominal pelado.</p>
     */
    private static final Map<ObjectCategory, List<String>> CATEGORY_PHRASES = Map.of(
            ObjectCategory.ROPA, List.of("una campera", "un buzo", "una remera", "un pantalon",
                    "un vestido", "una bufanda", "una gorra", "zapatillas", "un par de zapatos", "una camisa"),
            ObjectCategory.BILLETERA, List.of("una billetera", "un monedero", "un documento de identidad",
                    "un dni", "una tarjeta de credito", "una tarjeta de debito", "un carnet de conducir",
                    "una tarjeta de colectivo", "una cedula"),
            ObjectCategory.LLAVES, List.of("unas llaves", "un juego de llaves", "un llavero", "una llave de casa"),
            ObjectCategory.ELECTRONICA, List.of("un celular", "un telefono", "una notebook",
                    "una computadora portatil", "una tablet", "auriculares", "un cargador",
                    "una bateria portatil", "una camara de fotos", "un smartwatch", "un parlante"),
            ObjectCategory.OTROS, List.of("un paraguas", "una mochila", "un bolso", "una cartera",
                    "una botella", "un termo", "un libro", "un cuaderno", "anteojos", "lentes de sol",
                    "un juguete", "una taza", "una lapicera", "una pelota", "un par de guantes",
                    "una herramienta", "un mate")
    );

    private final EmbeddingService embeddingService;
    private final TextClassificationProperties properties;

    /** Frases vectorizadas y normalizadas, cacheadas: se embeben UNA vez por proceso. */
    private volatile List<Phrase> phraseBank;

    public EmbeddingTextClassificationService(EmbeddingService embeddingService,
                                              TextClassificationProperties properties) {
        this.embeddingService = embeddingService;
        this.properties = properties;
    }

    @Override
    public ObjectCategory classify(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }

        List<Phrase> bank;
        try {
            bank = getPhraseBank();
        } catch (RuntimeException e) {
            // Si el proveedor de embeddings falla, la clasificación por texto se saltea: el flujo
            // sigue con la foto, que es exactamente el comportamiento previo a EU-337.
            log.warn("[text-classification] No se pudieron vectorizar las frases de categoría: {}", e.getMessage());
            return null;
        }

        float[] queryVector;
        try {
            queryVector = normalizedVector(embeddingService.getTextVectorRepresentation(
                    TextNormalizer.normalize(text)));
        } catch (RuntimeException e) {
            log.warn("[text-classification] No se pudo vectorizar el texto a clasificar: {}", e.getMessage());
            return null;
        }
        if (queryVector == null) {
            return null;
        }

        // Mejor frase por categoría (máximo), igual que la nube de prompts de CLIP.
        Map<ObjectCategory, Double> best = new EnumMap<>(ObjectCategory.class);
        for (Phrase phrase : bank) {
            double similarity = dot(queryVector, phrase.vector());
            best.merge(phrase.category(), similarity, Math::max);
        }

        ObjectCategory winner = null;
        double winnerSimilarity = Double.NEGATIVE_INFINITY;
        for (Map.Entry<ObjectCategory, Double> entry : best.entrySet()) {
            if (entry.getValue() > winnerSimilarity) {
                winner = entry.getKey();
                winnerSimilarity = entry.getValue();
            }
        }

        if (winner == null || winnerSimilarity < properties.getMinSimilarity()) {
            log.debug("[text-classification] Abstención: mejor categoría {} con coseno {} (piso {})",
                    winner, winnerSimilarity, properties.getMinSimilarity());
            return null;
        }
        log.info("[text-classification] Texto clasificado como {} (coseno {})", winner, winnerSimilarity);
        return winner;
    }

    /** Vectoriza las nubes de frases una sola vez (doble chequeo: la primera búsqueda no la paga dos veces). */
    private List<Phrase> getPhraseBank() {
        List<Phrase> bank = phraseBank;
        if (bank != null) {
            return bank;
        }
        synchronized (this) {
            if (phraseBank != null) {
                return phraseBank;
            }
            List<ObjectCategory> categories = new ArrayList<>();
            List<String> texts = new ArrayList<>();
            CATEGORY_PHRASES.forEach((category, phrases) -> phrases.forEach(phrase -> {
                categories.add(category);
                // Las frases se normalizan con el MISMO normalizador que el texto del usuario: si se
                // normalizara un solo lado, la comparación mediría la normalización y no el parecido.
                texts.add(TextNormalizer.normalize(phrase));
            }));

            List<List<Float>> vectors = embeddingService.getTextVectorRepresentations(texts);
            if (vectors == null || vectors.size() != texts.size()) {
                throw new IllegalStateException("El proveedor devolvió "
                        + (vectors == null ? "null" : vectors.size()) + " vectores para " + texts.size() + " frases");
            }

            List<Phrase> built = new ArrayList<>(texts.size());
            for (int i = 0; i < texts.size(); i++) {
                float[] vector = normalizedVector(vectors.get(i));
                if (vector != null) {
                    built.add(new Phrase(categories.get(i), vector));
                }
            }
            phraseBank = List.copyOf(built);
            return phraseBank;
        }
    }

    /** Pasa el vector a norma 1, para que el producto punto SEA el coseno. */
    private static float[] normalizedVector(List<Float> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        float[] vector = new float[values.size()];
        double norm = 0.0;
        for (int i = 0; i < values.size(); i++) {
            vector[i] = values.get(i);
            norm += (double) vector[i] * vector[i];
        }
        norm = Math.sqrt(norm);
        if (norm == 0.0) {
            return null;
        }
        for (int i = 0; i < vector.length; i++) {
            vector[i] /= (float) norm;
        }
        return vector;
    }

    private static double dot(float[] a, float[] b) {
        int length = Math.min(a.length, b.length);
        double sum = 0.0;
        for (int i = 0; i < length; i++) {
            sum += (double) a[i] * b[i];
        }
        return sum;
    }

    /** Una frase de la nube, ya vectorizada y normalizada. */
    private record Phrase(ObjectCategory category, float[] vector) {
    }
}
