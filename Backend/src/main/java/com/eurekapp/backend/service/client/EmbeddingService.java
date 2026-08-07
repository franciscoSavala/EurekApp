package com.eurekapp.backend.service.client;

import java.util.List;

public interface EmbeddingService {
    List<Float> getTextVectorRepresentation(String text);

    /**
     * Vectoriza varios textos en un solo pedido. Existe para el clasificador por texto (EU-337),
     * que necesita embeber de una las ~50 frases de las nubes de categoría: uno por uno serían 50
     * llamadas de red en el arranque.
     *
     * <p>La implementación por defecto itera, para que cualquier proveedor sin lote siga andando;
     * el de OpenAI la sobrescribe con un pedido único.</p>
     *
     * @return un vector por texto, <b>en el mismo orden</b> que la lista de entrada.
     */
    default List<List<Float>> getTextVectorRepresentations(List<String> texts) {
        return texts.stream().map(this::getTextVectorRepresentation).toList();
    }
}
