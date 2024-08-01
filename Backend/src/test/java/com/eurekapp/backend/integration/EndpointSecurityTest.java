package com.eurekapp.backend.integration;

import com.eurekapp.backend.BackendApplication;
import com.eurekapp.backend.service.FoundObjectService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.context.junit4.SpringRunner;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.util.MultiValueMap;
import java.util.Map;

@ExtendWith(SpringExtension.class)
@SpringBootTest(classes = BackendApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
public class EndpointSecurityTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    FoundObjectService service;

    @Test
    @WithMockUser(authorities = "ORGANIZATION_OWNER")
    void whenUploadFoundObjectWithUserAllowed_canUpload(){
        //TODO: Testing security
    }
}
