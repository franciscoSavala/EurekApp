package com.eurekapp.backend.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;

import java.util.LinkedList;
import java.util.List;

@Getter
public class TextChatCompletionRequest {
    private final String model = "gpt-4o-mini";
    private final List<Message> messages = new LinkedList<>();
    @JsonProperty("max_tokens")
    private final Integer maxTokens = 150;

    public TextChatCompletionRequest(String userQuery) {
        messages.add(new SystemMessage());
        messages.add(new UserMessage(userQuery));
    }

    @Getter
    static abstract class Message {
        protected String role;
    }

    @Getter
    static class SystemMessage extends Message {
        private final String content =
                "Eres un asistente para recuperar objetos perdidos. Dado el objeto que el usuario perdió, " +
                "genera una descripción detallada de cómo ese objeto podría estar registrado en una base " +
                "de datos de objetos encontrados. Incluí posibles variantes de nombre, color, marca, " +
                "material y características distintivas. Sé conciso, máximo 3 oraciones.";
        public SystemMessage() { this.role = "system"; }
    }

    @Getter
    static class UserMessage extends Message {
        private final String content;
        public UserMessage(String query) {
            this.role = "user";
            this.content = query;
        }
    }
}
