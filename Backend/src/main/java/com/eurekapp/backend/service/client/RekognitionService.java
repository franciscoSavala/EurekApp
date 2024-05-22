package com.eurekapp.backend.service;

import com.eurekapp.backend.model.WorkItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.EnvironmentVariableCredentialsProvider;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.rekognition.RekognitionAsyncClient;
import software.amazon.awssdk.services.rekognition.model.*;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicReference;


@Component
public class RekognitionService {
    private static final Logger log = LoggerFactory.getLogger(RekognitionService.class);

    public List<WorkItem> detectLabel(byte[] bytes){
        try (RekognitionAsyncClient client = RekognitionAsyncClient.builder()
                .credentialsProvider(EnvironmentVariableCredentialsProvider.create())
                .region(Region.US_EAST_1)
                .build()) {
            final AtomicReference<List<WorkItem>> reference = new AtomicReference<>();
            SdkBytes sdkBytes = SdkBytes.fromByteArray(bytes);
            Image image = Image.builder()
                    .bytes(sdkBytes)
                    .build();

            DetectLabelsRequest detectLabelsRequest = DetectLabelsRequest.builder()
                    .image(image)
                    .maxLabels(10)
                    .build();

            CompletableFuture<DetectLabelsResponse> futureGet = client.detectLabels(detectLabelsRequest);

            futureGet.whenComplete((resp, err) -> {
                if (resp != null) {
                    List<Label> labels = resp.labels();
                    log.info("Detected labels for the given photo");
                    List<WorkItem> list = labels.stream()
                            .map(l -> WorkItem.builder()
                                    .confidence(l.confidence().toString())
                                    .name(l.name())
                                    .build())
                            .toList();
                    reference.set(list);
                } else {
                    log.error(err.getMessage());
                }
            });
            futureGet.join();
            return reference.get();
        } catch (RekognitionException e) {
            log.error(e.getMessage());
        }
        return null;
    }
}
