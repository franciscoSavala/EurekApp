package com.eurekapp.backend.service.notification;


import com.eurekapp.backend.model.Notification;
import jakarta.mail.Authenticator;
import jakarta.mail.PasswordAuthentication;
import jakarta.mail.Session;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.util.Properties;

@Service
public class EmailService implements NotificationService {

    private final Properties properties;

    public EmailService(
            @Value("${application.mailtrap.host}") String host,
            @Value("${application.mailtrap.password}") String password,
            @Value("${application.mailtrap.port}") String port,
            @Value("${application.mailtrap.user}") String user
    ){
        this.properties = new Properties();
        this.properties.put("mail.smtp.host", host);
        this.properties.put("mail.smtp.port", port);
        this.properties.put("mail.smtp.auth", "true");
        this.properties.put("mail.smtp.starttls.enable", "true");
        this.properties.put("mail.smtp.ssl.trust", host);
    }

    @Override
    public void sendNotification(String notification) {
        Session session = Session.getInstance(this.properties, new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(properties, password);
            }
        });
    }
}
