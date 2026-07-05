package com.eurekapp.backend.service.client;

import com.eurekapp.backend.dto.response.ClipEmbeddingResponse;
import com.eurekapp.backend.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * Implementación de {@link ImageEmbeddingService} que delega en el microservicio CLIP
 * self-hosted (clip-service, EU-321): sube la imagen como multipart y recibe el vector visual.
 *
 * <p>Mismo patrón que {@link OpenAiEmbeddingModelService} (texto): un {@link RestClient}
 * dedicado apuntado por configuración, sin lógica de negocio.</p>
 */
@Service
public class ClipImageEmbeddingService implements ImageEmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(ClipImageEmbeddingService.class);

    private final RestClient clipClient;

    public ClipImageEmbeddingService(@Qualifier("clipClient") RestClient clipClient) {
        this.clipClient = clipClient;
    }

    @Override
    public List<Float> getImageVectorRepresentation(byte[] imageBytes) {
        if (imageBytes == null || imageBytes.length == 0) {
            throw new ApiException("clip_error", "La imagen a vectorizar está vacía", HttpStatus.BAD_REQUEST);
        }

        // Armamos el cuerpo multipart/form-data con la imagen bajo el campo "file".
        // El nombre de archivo es irrelevante para el micro (lee los bytes), pero debe existir.
        ByteArrayResource imageResource = new ByteArrayResource(imageBytes) {
            @Override
            public String getFilename() {
                return "image";
            }
        };
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", imageResource);

        ClipEmbeddingResponse response = clipClient.post()
                .uri("/embed/image")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body)
                .retrieve()
                .body(ClipEmbeddingResponse.class);

        if (response == null || response.getVector() == null || response.getVector().isEmpty()) {
            log.error("[api_call:clip] Respuesta vacía o sin vector del microservicio CLIP");
            throw new ApiException("clip_error", "El microservicio CLIP no devolvió un vector",
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }

        log.info("[method:POST] [api_call:clip] Imagen vectorizada: dim={}", response.getVector().size());
        return response.getVector();
    }
}
