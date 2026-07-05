package com.eurekapp.backend.service.client;

import com.eurekapp.backend.dto.response.ClipClassificationResponse;
import com.eurekapp.backend.exception.ApiException;
import com.eurekapp.backend.model.ObjectCategory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

/**
 * Implementación de {@link ImageClassificationService} que delega en el microservicio CLIP
 * self-hosted (clip-service, EU-322): sube la imagen como multipart a /classify y recibe la
 * categoría (clasificación zero-shot). Reusa el mismo {@code clipClient} que la vectorización.
 */
@Service
public class ClipImageClassificationService implements ImageClassificationService {

    private static final Logger log = LoggerFactory.getLogger(ClipImageClassificationService.class);

    private final RestClient clipClient;

    public ClipImageClassificationService(@Qualifier("clipClient") RestClient clipClient) {
        this.clipClient = clipClient;
    }

    @Override
    public ObjectCategory classify(byte[] imageBytes) {
        if (imageBytes == null || imageBytes.length == 0) {
            throw new ApiException("clip_error", "La imagen a clasificar está vacía", HttpStatus.BAD_REQUEST);
        }

        ByteArrayResource imageResource = new ByteArrayResource(imageBytes) {
            @Override
            public String getFilename() {
                return "image";
            }
        };
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", imageResource);

        ClipClassificationResponse response = clipClient.post()
                .uri("/classify")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body)
                .retrieve()
                .body(ClipClassificationResponse.class);

        if (response == null || response.getCategory() == null) {
            log.error("[api_call:clip] Respuesta vacía o sin categoría del microservicio CLIP");
            throw new ApiException("clip_error", "El microservicio CLIP no devolvió una categoría",
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }

        // fromLabel es defensivo: una etiqueta desconocida cae en OTROS en vez de romper.
        ObjectCategory category = ObjectCategory.fromLabel(response.getCategory());
        log.info("[method:POST] [api_call:clip] Imagen clasificada como {}", category);
        return category;
    }
}
