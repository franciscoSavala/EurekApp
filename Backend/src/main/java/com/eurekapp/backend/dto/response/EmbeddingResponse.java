package com.eurekapp.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
public class EmbeddingResponse {
    private List<Float> embedding;

    /* Posición del texto dentro del pedido. Sólo importa en los pedidos por lote (batch): permite
       reordenar la respuesta y no depender de que la API respete el orden de entrada. */
    private Integer index;
}
