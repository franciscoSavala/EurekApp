package com.eurekapp.backend.model.request;

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
        private final String content = "Eres una persona que perdió un objeto y necesitas ayuda para encontrarlo";
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
        private final String text = "Describe el objeto como si lo hayas perdido";
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
