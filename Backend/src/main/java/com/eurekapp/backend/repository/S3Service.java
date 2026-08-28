package com.eurekapp.backend.repository;

import com.eurekapp.backend.dto.BucketItem;
import com.eurekapp.backend.exception.ApiException;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.async.AsyncRequestBody;
import software.amazon.awssdk.core.async.AsyncResponseTransformer;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.S3Object;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerConfigurationException;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.StringWriter;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Component
public class S3Service implements ObjectStorage {

    @Value("${application.s3.bucket.name}")
    String bucketName;

    S3AsyncClient s3AsyncClient;

    Region region = Region.SA_EAST_1;

    @PostConstruct
    private void constructClient(){
        s3AsyncClient = S3AsyncClient.builder()
                .credentialsProvider(DefaultCredentialsProvider.create())
                .region(region)
                .build();
    }

    @PreDestroy
    private void closeConnection() {
        s3AsyncClient.close();
    }

    public byte[] getObjectBytes(String keyName) {
        final AtomicReference<byte[]> reference = new AtomicReference<>();
        try {
            GetObjectRequest objectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(keyName)
                    .build();

            // Get the Object from the Amazon S3 bucket using the Amazon S3 Async Client.
            final CompletableFuture<ResponseBytes<GetObjectResponse>>[] futureGet = new CompletableFuture[] {
                    s3AsyncClient.getObject(objectRequest,
                            AsyncResponseTransformer.toBytes()) };

            futureGet[0].whenComplete((resp, err) -> {
                if (resp != null) {
                    // Set the AtomicReference object.
                    reference.set(resp.asByteArray());

                } else {
                    err.printStackTrace();
                }
            });
            futureGet[0].join();

            // Read the AtomicReference object and return the byte[] value.
            return reference.get();

        } catch (java.util.concurrent.CompletionException e) {
            if (e.getCause() instanceof NoSuchKeyException) {
                return null;
            }
            throw e;
        } catch (S3Exception e) {
            System.err.println(e.awsErrorDetails().errorMessage());
            System.exit(1);
        }
        return null;
    }

    // Places an image into a S3 bucket.
    public void putObject(byte[] data, String objectKey) {
        try {
            PutObjectRequest objectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .build();

            // Put the object into the bucket.
            CompletableFuture<PutObjectResponse> future = s3AsyncClient.putObject(objectRequest,
                    AsyncRequestBody.fromBytes(data));
            future.join();
            log.info("[service:S3] Objeto '{}' subido al bucket '{}' ({} bytes).",
                    objectKey, bucketName, data != null ? data.length : 0);

        // EU-343: future.join() envuelve el error real en CompletionException, que antes no se
        // capturaba y se escapaba sin tratar. Es el mismo patrón que ya usa getObjectBytes.
        } catch (java.util.concurrent.CompletionException e) {
            throw uploadFailed(objectKey, e.getCause() != null ? e.getCause() : e);
        } catch (S3Exception e) {
            // Antes esto hacía System.exit(1): una foto que no sube tumbaba la aplicación entera.
            throw uploadFailed(objectKey, e);
        }
    }

    private ApiException uploadFailed(String objectKey, Throwable cause) {
        log.error("[service:S3] No se pudo subir el objeto '{}' al bucket '{}': {}",
                objectKey, bucketName, cause.getMessage(), cause);
        return new ApiException("s3_upload_failed",
                "No se pudo guardar la imagen en el almacenamiento.", cause);
    }

    @Override
    public String getObjectUrl(String objectKey) {
        return String.format("https://%s.s3.%s.amazonaws.com/%s", bucketName, region.toString(), objectKey);
    }

    @Override
    public String generatePresignedUrl(String objectKey, Duration expiry) {
        try (S3Presigner presigner = S3Presigner.builder()
                .credentialsProvider(DefaultCredentialsProvider.create())
                .region(region)
                .build()) {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .build();
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(expiry)
                    .getObjectRequest(getObjectRequest)
                    .build();
            PresignedGetObjectRequest presignedRequest = presigner.presignGetObject(presignRequest);
            return presignedRequest.url().toString();
        }
    }
}
