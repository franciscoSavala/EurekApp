package com.eurekapp.backend.service.client;

import com.eurekapp.backend.dto.response.ClipClassificationResponse;
import com.eurekapp.backend.exception.ApiException;
import com.eurekapp.backend.model.ObjectCategory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
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

        // El micro (FastAPI, UploadFile) exige que la parte lleve filename y content-type en su
        // Content-Disposition; MultipartBodyBuilder los fija explícitamente (un ByteArrayResource suelto
        // no siempre emite el filename → FastAPI la toma como campo de texto y responde 422 "file required").
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("file", imageBytes).filename("image.jpg").contentType(MediaType.IMAGE_JPEG);

        ClipClassificationResponse response = clipClient.post()
                .uri("/classify")
                // NO fijar contentType a MULTIPART_FORM_DATA a mano: eso setea el header SIN boundary y el
                // micro parsea un form vacío (422 "file required"). Dejamos que el converter emita el
                // Content-Type con boundary a partir del cuerpo multipart.
                .body(builder.build())
                .retrieve()
                .body(ClipClassificationResponse.class);

        if (response == null || response.getCategory() == null) {
            log.error("[api_call:clip] Respuesta vacía o sin categoría del microservicio CLIP");
            throw new ApiException("clip_error", "El microservicio CLIP no devolvió una categoría",
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }

        // fromLabel es defensivo: una etiqueta desconocida cae en OTROS en vez de romper.
        ObjectCategory category = ObjectCategory.fromLabel(response.getCategory());
        // La confianza se loguea para poder medir en producción qué porcentaje de las clasificaciones
        // reales es dudoso (EU-327). Es la probabilidad en la escala del modelo, no el coseno crudo.
        log.info("[method:POST] [api_call:clip] Imagen clasificada como {} (confianza {})",
                category, response.getConfidence());
        return category;
    }
}
