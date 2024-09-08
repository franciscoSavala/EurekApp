package com.eurekapp.backend.repository;

import com.eurekapp.backend.dto.BucketItem;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import software.amazon.awssdk.auth.credentials.EnvironmentVariableCredentialsProvider;
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
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.S3Object;
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
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicReference;

@Component
public class S3Service implements ObjectStorage {

    @Value("${application.s3.bucket.name}")
    String bucketName;

    S3AsyncClient s3AsyncClient;

    Region region = Region.SA_EAST_1;

    @PostConstruct
    private void constructClient(){
        s3AsyncClient = S3AsyncClient.builder()
                .credentialsProvider(EnvironmentVariableCredentialsProvider.create())
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
            future.whenComplete((resp, err) -> {
                if (resp != null) {
                    System.out.println("Object uploaded. Details: " + resp);
                } else {
                    // Handle error
                    err.printStackTrace();
                }
            });
            future.join();

        } catch (S3Exception e) {
            System.err.println(e.getMessage());
            System.exit(1);
        }
    }

    @Override
    public String getObjectUrl(String objectKey) {
        return String.format("https://%s.s3.%s.amazonaws.com/%s", bucketName, region.toString(), objectKey);
    }
}
