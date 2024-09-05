package com.eurekapp.backend.model;

import org.springframework.stereotype.Component;
import java.util.Base64;

@Component
public class SimpleEmailContentBuilder {

    public String buildEmailContent(
            String organizationName, String organizationContactData, String description) {
        String message = """
        <html>
          <body>
            <div style="text-align: center;">
              <h1>%s</h1>
              <p style="font-size: 16px;">Encontrado en %s</p>
              <p style="font-size: 16px;"> %s</p>
              <img src="cid:image" alt="Lost object" style="display: block; margin: 0 auto; max-width: 100%%; height: auto;" />
            </div>
          </body>
        </html>
        """.formatted(description, organizationName, organizationContactData);


        return message;
    }
}
