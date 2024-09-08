package com.eurekapp.backend.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.LinkedList;
import java.util.List;

@Getter
@Setter
public class ChatCompletionRequest {
    private final String MODEL = "gpt-4o";
    private final List<Message> messages = new LinkedList<>();
    @JsonProperty("max_tokens")
    private final Integer maxTokens = 200;

    /* El propósito de esta clase es que, cuando una instancia de OpenAiImageDescriptionService deba
       enviar una request a ChatGPT, la misma no tenga que  armar manualmente el JSON a enviar, sino que en su
      lugar le pasará una instancia de esta clase a una librería externa que armará el JSON por ella. */

    public ChatCompletionRequest(String base64ImageRepresentation){
        var imageUrl = new ImageUrl(base64ImageRepresentation);
        var imageContent = new ImageContent(imageUrl);
        var textContent = new TextContent();
        var userMessage = new UserMessage(textContent, imageContent);
        messages.add(userMessage);
        var systemMessage = new SystemMessage();
        messages.add(systemMessage);
    }

    @Getter
    static abstract class Message {
        protected String role;
    }

    @Getter
    static class SystemMessage extends Message{
        private final String content = "";
        //private final String content = "Eres una persona describiendo un objeto";
        public SystemMessage(){
            this.role = "system";
        }
    }

    @Getter
    static class UserMessage extends Message{
        private final List<Content> content = new LinkedList<>();
        public UserMessage(TextContent textContent, ImageContent imageContent){
            content.add(textContent);
            content.add(imageContent);
            this.role = "user";
        }
    }

    @Getter
    static abstract class Content {
        protected String type;
    }

    @Getter
    static class TextContent extends Content{
        private final String text = "Describe esta imagen. Sé lo más descriptivo posible. " +
                "MINIMIZA la cantidad de palabras usadas, o sea, evita palabras de relleno." +
                "No empieces con \"La imagen muestra etc.\"," +
                "simplemente dí \"[objeto] [adjetivo]\", por dar un ejemplo.";
        public TextContent(){
            this.type = "text";
        }
    }

    @Getter
    static class ImageContent extends Content{
        @JsonProperty("image_url")
        private final ImageUrl imageUrl;
        public ImageContent(ImageUrl imageUrl){
            this.imageUrl = imageUrl;
            this.type = "image_url";
        }
    }

    @Getter
    static class ImageUrl {
        private final String detail = "low";
        private final String url;
        public ImageUrl(String base64ImageRepresentation){
            this.url = "data:image/jpeg;base64," + base64ImageRepresentation;
        }
    }
}
