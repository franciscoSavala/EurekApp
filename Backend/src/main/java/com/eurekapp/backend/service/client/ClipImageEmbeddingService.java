package com.eurekapp.backend.service.client;

import com.eurekapp.backend.dto.response.ClipEmbeddingResponse;
import com.eurekapp.backend.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
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
        // El micro (FastAPI, UploadFile) exige que la parte lleve filename y content-type en su
        // Content-Disposition; MultipartBodyBuilder los fija explícitamente. Un ByteArrayResource suelto
        // no siempre emite el filename → FastAPI la toma como campo de texto y responde 422 "file required".
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("file", imageBytes).filename("image.jpg").contentType(MediaType.IMAGE_JPEG);

        ClipEmbeddingResponse response = clipClient.post()
                .uri("/embed/image")
                // NO fijar contentType a MULTIPART_FORM_DATA a mano: eso setea el header SIN boundary y el
                // micro parsea un form vacío (422 "file required"). Dejamos que el converter emita el
                // Content-Type con boundary a partir del cuerpo multipart.
                .body(builder.build())
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
