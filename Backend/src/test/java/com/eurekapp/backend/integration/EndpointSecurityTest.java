package com.eurekapp.backend.integration;

import com.eurekapp.backend.BackendApplication;
import com.eurekapp.backend.dto.response.FoundObjectUploadedResponseDto;
import com.eurekapp.backend.model.UploadFoundObjectCommand;
import com.eurekapp.backend.service.IFoundObjectService;
import com.eurekapp.backend.service.client.EmbeddingService;
import com.eurekapp.backend.service.client.ImageDescriptionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithUserDetails;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;

@ExtendWith(SpringExtension.class)
@SpringBootTest(classes = BackendApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/schema.sql")
@Sql(scripts = "/data.sql")
public class EndpointSecurityTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    IFoundObjectService service;

    @MockBean
    EmbeddingService embeddingService;

    @MockBean
    ImageDescriptionService imageDescriptionService;

    /*@MockBean
    VectorStorage<FoundObjectStructVector> vectorStorage;

    @MockBean
    Index index;*/

    @Test
    void whenUserNotAuthenticated_NotAllowToAccessAnyEndpoint() throws Exception {
        when(service.uploadFoundObject(any(UploadFoundObjectCommand.class)))
                .thenReturn(FoundObjectUploadedResponseDto.builder()
                        .id("123")
                        .textEncoding("encoding")
                        .description("description")
                        .build());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "testfile.txt",
                "text/plain",
                new byte[]{}
        );

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("description", "");
        params.add("organizationId", "");

        mvc.perform(MockMvcRequestBuilders.multipart("/found-objects/organizations/{organizationId}", 1L)
                        .file(file)
                        .params(params))
                .andDo(print())
                .andExpect(MockMvcResultMatchers.status().isForbidden());
    }

    @Test
    @WithUserDetails(value = "utn-admin", userDetailsServiceBeanName = "userDetailsService")
    void whenUploadFoundObjectWithUserAllowed_canUpload() throws Exception {
        when(service.uploadFoundObject(any(UploadFoundObjectCommand.class)))
                .thenReturn(FoundObjectUploadedResponseDto.builder()
                        .id("123")
                        .textEncoding("encoding")
                        .description("description")
                        .build());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "testfile.txt",
                "text/plain",
                new byte[]{}
        );

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("description", "");
        params.add("organizationId", "");

        mvc.perform(MockMvcRequestBuilders.multipart("/found-objects/organizations/{organizationId}", 1L)
                        .file(file)
                        .params(params))
                .andDo(print())
                .andExpect(MockMvcResultMatchers.status().isOk());
    }

    @Test
    @WithUserDetails(value = "patio-olmos-admin", userDetailsServiceBeanName = "userDetailsService")
    void whenUploadFoundObjectWithUserOfDifferentOrg_error() throws Exception {
        when(service.uploadFoundObject(any(UploadFoundObjectCommand.class)))
                .thenReturn(FoundObjectUploadedResponseDto.builder()
                        .id("123")
                        .textEncoding("encoding")
                        .description("description")
                        .build());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "testfile.txt",
                "text/plain",
                new byte[]{}
        );

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("description", "");
        params.add("organizationId", "");

        mvc.perform(MockMvcRequestBuilders.multipart("/found-objects/organizations/{organizationId}", 1L)
                        .file(file)
                        .params(params))
                .andDo(print())
                .andExpect(MockMvcResultMatchers.status().is4xxClientError());
    }
}
