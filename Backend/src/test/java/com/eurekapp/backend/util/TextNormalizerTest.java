package com.eurekapp.backend.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests de la normalización de texto (EU-142, PoC #9.1). Lo que se verifica es la propiedad que
 * importa para el buscador: dos personas que describen el MISMO objeto escribiendo distinto deben
 * terminar con el mismo texto normalizado, sin que la limpieza pegue palabras que no van juntas.
 */
class TextNormalizerTest {

    @Test
    void deberiaColapsarUnIdentificadorEscritoConYSinSeparadores() {
        // El caso eje del identificador: el mismo DNI escrito de tres formas distintas.
        assertThat(TextNormalizer.normalize("45.789.654")).isEqualTo("45789654");
        assertThat(TextNormalizer.normalize("45-789-654")).isEqualTo("45789654");
        assertThat(TextNormalizer.normalize("45 789 654")).isEqualTo("45789654");
        assertThat(TextNormalizer.normalize("45789654")).isEqualTo("45789654");
    }

    @Test
    void deberiaColapsarElIdentificadorSinTocarElRestoDeLaFrase() {
        assertThat(TextNormalizer.normalize("Billetera con DNI 45.789.654 adentro"))
                .isEqualTo("billetera con dni 45789654 adentro");
    }

    @Test
    void noDeberiaPegarPalabrasQueNoSonNumeros() {
        // La limpieza es ciega pero acotada a dígitos: un guion entre palabras no debe desaparecer.
        assertThat(TextNormalizer.normalize("mochila-roja")).isEqualTo("mochila-roja");
        assertThat(TextNormalizer.normalize("perdi mi mochila. Roja, marca Prince"))
                .isEqualTo("perdi mi mochila. roja, marca prince");
    }

    @Test
    void deberiaQuitarTildesParaQueLaMismaPalabraSeaElMismoTermino() {
        assertThat(TextNormalizer.normalize("bermejá")).isEqualTo("bermeja");
        assertThat(TextNormalizer.normalize("MOCHILA MARRÓN")).isEqualTo("mochila marron");
    }

    @Test
    void deberiaPreservarLaEñePorqueEsUnaLetraDistinta() {
        // "año" no debe convertirse en "ano": son palabras distintas y el buscador las trataría igual.
        assertThat(TextNormalizer.normalize("Compañera de año")).isEqualTo("compañera de año");
    }

    @Test
    void deberiaLlevarTodoAMinusculasYColapsarEspaciosSobrantes() {
        assertThat(TextNormalizer.normalize("  Mochila   ROJA  ")).isEqualTo("mochila roja");
    }

    @Test
    void deberiaDejarPasarElTextoNuloYElVacio() {
        assertThat(TextNormalizer.normalize(null)).isNull();
        assertThat(TextNormalizer.normalize("   ")).isEmpty();
    }

    @Test
    void deberiaSerIdempotente() {
        // Se aplica en la carga Y en la búsqueda; pasar dos veces no puede cambiar el resultado.
        String unaVez = TextNormalizer.normalize("Billetera con DNI 45.789.654, marca Prince");
        assertThat(TextNormalizer.normalize(unaVez)).isEqualTo(unaVez);
    }
}
