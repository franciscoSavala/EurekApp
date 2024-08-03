package com.eurekapp.backend.integration;

import com.eurekapp.backend.BackendApplication;
import com.eurekapp.backend.dto.ImageUploadedResponseDto;
import com.eurekapp.backend.model.FoundObjectStructVector;
import com.eurekapp.backend.repository.VectorStorage;
import com.eurekapp.backend.service.FoundObjectService;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.client.ImageDescriptionService;
import io.pinecone.clients.Index;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultMatcher;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;

@ExtendWith(SpringExtension.class)
@SpringBootTest(classes = BackendApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class EndpointSecurityTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    FoundObjectService service;

    @MockBean
    EmbeddingService embeddingService;

    @MockBean
    ImageDescriptionService imageDescriptionService;

    @MockBean
    VectorStorage<FoundObjectStructVector> vectorStorage;

    @MockBean
    Index index;

    @Test
    @WithMockUser(authorities = "ORGANIZATION_OWNER")
    void whenUploadFoundObjectWithUserAllowed_canUpload() throws Exception {
        when(service.uploadFoundObject(any(), anyString(), anyLong()))
                .thenReturn(ImageUploadedResponseDto.builder()
                        .id("123")
                        .textEncoding("encoding")
                        .description("description")
                        .build());
        MockMultipartFile file = new MockMultipartFile(
                "file",                     // Nombre del parámetro
                "testfile.txt",             // Nombre del archivo original
                "text/plain",               // Tipo de contenido MIME
                "Hello, World!".getBytes()  // Contenido del archivo
        );

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("description", "");
        params.add("organizationId", "");

        mvc.perform(MockMvcRequestBuilders.multipart("/found-objects/organizations/{organizationId}", 10L)
                        .file(file)
                        .params(params))
                .andDo(print())
                .andExpect(MockMvcResultMatchers.status().isOk());
    }

    @Test
    @WithMockUser(authorities = "USER")
    void whenUploadFoundObjectWithUserAllowed_forbidden() throws Exception {
        when(service.uploadFoundObject(any(), anyString(), anyLong()))
                .thenReturn(ImageUploadedResponseDto.builder()
                        .id("123")
                        .textEncoding("encoding")
                        .description("description")
                        .build());
        MockMultipartFile file = new MockMultipartFile(
                "file",                     // Nombre del parámetro
                "testfile.txt",             // Nombre del archivo original
                "text/plain",               // Tipo de contenido MIME
                "Hello, World!".getBytes()  // Contenido del archivo
        );

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("description", "");
        params.add("organizationId", "");

        mvc.perform(MockMvcRequestBuilders.multipart("/found-objects/organizations/{organizationId}", 10L)
                        .file(file)
                        .params(params))
                .andDo(print())
                .andExpect(MockMvcResultMatchers.status().isForbidden());
    }
}
