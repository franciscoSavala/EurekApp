package com.eurekapp.backend.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests del mapeo de etiquetas a categorías duras (EU-322): el mapeo es case-insensitive y
 * defensivo (null o etiqueta desconocida caen en OTROS, para que el backend nunca rompa si el
 * clasificador cambia sus etiquetas).
 */
class ObjectCategoryTest {

    @Test
    void fromLabel_mapsKnownLabels_caseInsensitive() {
        assertThat(ObjectCategory.fromLabel("BILLETERA")).isEqualTo(ObjectCategory.BILLETERA);
        assertThat(ObjectCategory.fromLabel("ropa")).isEqualTo(ObjectCategory.ROPA);
        assertThat(ObjectCategory.fromLabel(" Celular ")).isEqualTo(ObjectCategory.CELULAR);
    }

    @Test
    void fromLabel_nullOrUnknown_fallsBackToOtros() {
        assertThat(ObjectCategory.fromLabel(null)).isEqualTo(ObjectCategory.OTROS);
        assertThat(ObjectCategory.fromLabel("")).isEqualTo(ObjectCategory.OTROS);
        assertThat(ObjectCategory.fromLabel("cualquier-cosa")).isEqualTo(ObjectCategory.OTROS);
    }
}
