package com.eurekapp.backend.service.client;

import com.eurekapp.backend.exception.ApiException;
import com.eurekapp.backend.model.ObjectCategory;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Tests del cliente del clasificador CLIP (EU-322): que parsee la categoría de /classify, mapee
 * etiquetas desconocidas a OTROS, y falle limpio ante imagen vacía o respuesta sin categoría.
 * No levanta el micro real: intercepta el RestClient con MockRestServiceServer.
 */
class ClipImageClassificationServiceTest {

    private static Fixture fixture() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://clip.test");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        return new Fixture(new ClipImageClassificationService(builder.build()), server);
    }

    private record Fixture(ClipImageClassificationService service, MockRestServiceServer server) {}

    @Test
    void returnsCategory_onSuccess() {
        Fixture f = fixture();
        f.server().expect(requestTo("http://clip.test/classify"))
                .andRespond(withSuccess(
                        "{\"category\":\"BILLETERA\",\"scores\":{\"BILLETERA\":0.34}}",
                        MediaType.APPLICATION_JSON));

        ObjectCategory category = f.service().classify(new byte[]{1, 2, 3});

        assertThat(category).isEqualTo(ObjectCategory.BILLETERA);
        f.server().verify();
    }

    @Test
    void unknownLabel_mapsToOtros() {
        Fixture f = fixture();
        f.server().expect(requestTo("http://clip.test/classify"))
                .andRespond(withSuccess(
                        "{\"category\":\"UNICORNIO\",\"scores\":{}}", MediaType.APPLICATION_JSON));

        assertThat(f.service().classify(new byte[]{1, 2, 3})).isEqualTo(ObjectCategory.OTROS);
        f.server().verify();
    }

    @Test
    void throwsBadRequest_whenImageIsEmpty() {
        Fixture f = fixture();
        assertThatThrownBy(() -> f.service().classify(new byte[0]))
                .isInstanceOf(ApiException.class);
        f.server().verify(); // no debe llamar al micro
    }

    @Test
    void throws_whenResponseHasNoCategory() {
        Fixture f = fixture();
        f.server().expect(requestTo("http://clip.test/classify"))
                .andRespond(withSuccess("{\"scores\":{}}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> f.service().classify(new byte[]{1, 2, 3}))
                .isInstanceOf(ApiException.class);
        f.server().verify();
    }

    @Test
    void throws_whenServiceFails() {
        Fixture f = fixture();
        f.server().expect(requestTo("http://clip.test/classify"))
                .andRespond(withServerError());

        assertThatThrownBy(() -> f.service().classify(new byte[]{1, 2, 3}))
                .isInstanceOf(Exception.class);
        f.server().verify();
    }
}
