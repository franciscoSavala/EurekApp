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
        assertThat(ObjectCategory.fromLabel(" Electronica ")).isEqualTo(ObjectCategory.ELECTRONICA);
    }

    @Test
    void fromLabel_nullOrUnknown_fallsBackToOtros() {
        assertThat(ObjectCategory.fromLabel(null)).isEqualTo(ObjectCategory.OTROS);
        assertThat(ObjectCategory.fromLabel("")).isEqualTo(ObjectCategory.OTROS);
        assertThat(ObjectCategory.fromLabel("cualquier-cosa")).isEqualTo(ObjectCategory.OTROS);
    }

    /**
     * La categoría CELULAR se reemplazó por ELECTRONICA (2026-08-01). Si un objeto viejo quedó
     * persistido con la etiqueta anterior, debe caer en OTROS por el camino defensivo y NO romper
     * el backend. (Los objetos con la etiqueta vieja hay que reclasificarlos: quedan fuera del
     * filtro de ELECTRONICA hasta que se recarguen.)
     */
    @Test
    void fromLabel_categoriaVieja_noRompe_yCaeEnOtros() {
        assertThat(ObjectCategory.fromLabel("CELULAR")).isEqualTo(ObjectCategory.OTROS);
    }
}
