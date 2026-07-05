package com.eurekapp.backend.service.client;

import com.eurekapp.backend.exception.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Tests del cliente del microservicio CLIP (EU-321): que arme el POST multipart a /embed/image,
 * parsee el vector de la respuesta, y falle limpio ante imagen vacía o respuesta sin vector.
 * No levanta el micro real: intercepta el RestClient con MockRestServiceServer.
 */
class ClipImageEmbeddingServiceTest {

    /** Construye el servicio con un RestClient interceptado por un MockRestServiceServer. */
    private static Fixture fixture() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://clip.test");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        return new Fixture(new ClipImageEmbeddingService(builder.build()), server);
    }

    private record Fixture(ClipImageEmbeddingService service, MockRestServiceServer server) {}

    @Test
    void returnsVector_onSuccess() {
        Fixture f = fixture();
        f.server().expect(requestTo("http://clip.test/embed/image"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"model\":\"clip\",\"dim\":3,\"vector\":[0.5,-0.5,0.25]}",
                        MediaType.APPLICATION_JSON));

        List<Float> vector = f.service().getImageVectorRepresentation(new byte[]{1, 2, 3});

        assertThat(vector).containsExactly(0.5f, -0.5f, 0.25f);
        f.server().verify();
    }

    @Test
    void throwsBadRequest_whenImageIsEmpty() {
        Fixture f = fixture();
        // No se debe llamar al micro si la imagen viene vacía.
        assertThatThrownBy(() -> f.service().getImageVectorRepresentation(new byte[0]))
                .isInstanceOf(ApiException.class);
        f.server().verify();
    }

    @Test
    void throwsBadRequest_whenImageIsNull() {
        Fixture f = fixture();
        assertThatThrownBy(() -> f.service().getImageVectorRepresentation(null))
                .isInstanceOf(ApiException.class);
        f.server().verify();
    }

    @Test
    void throws_whenResponseHasNoVector() {
        Fixture f = fixture();
        f.server().expect(requestTo("http://clip.test/embed/image"))
                .andRespond(withSuccess(
                        "{\"model\":\"clip\",\"dim\":0,\"vector\":[]}",
                        MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> f.service().getImageVectorRepresentation(new byte[]{1, 2, 3}))
                .isInstanceOf(ApiException.class);
        f.server().verify();
    }

    @Test
    void throws_whenServiceFails() {
        Fixture f = fixture();
        f.server().expect(requestTo("http://clip.test/embed/image"))
                .andRespond(withServerError());

        assertThatThrownBy(() -> f.service().getImageVectorRepresentation(new byte[]{1, 2, 3}))
                .isInstanceOf(Exception.class);
        f.server().verify();
    }
}
