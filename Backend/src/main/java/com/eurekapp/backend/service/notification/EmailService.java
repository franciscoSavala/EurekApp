package com.eurekapp.backend.service.notification;


import com.eurekapp.backend.exception.ApiException;
import com.eurekapp.backend.model.Notification;
import jakarta.activation.DataHandler;
import jakarta.activation.DataSource;
import jakarta.mail.Authenticator;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Multipart;
import jakarta.mail.PasswordAuthentication;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import jakarta.mail.util.ByteArrayDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.util.Properties;

@Service
public class EmailService implements NotificationService {

    private final Properties properties;
    private final String user;
    private final String password;

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
        this.password = password;
        this.user = user;
    }

    @Override
    public void sendNotification(String notification) {
        Session session = Session.getInstance(this.properties, new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(user, password);
            }
        });

        Message message = new MimeMessage(session);
        try {
            message.setFrom(new InternetAddress("mailtrap@demomailtrap.com"));
            message.setRecipients(Message.RecipientType.TO,
                    InternetAddress.parse("franciscosavala01@gmail.com"));
            message.setSubject("Hemos encontrado tu objeto!");
            MimeBodyPart mimeBodyPart = new MimeBodyPart();
            mimeBodyPart.setContent(notification, "text/html; charset=utf-8");

            Multipart multipart = new MimeMultipart();
            multipart.addBodyPart(mimeBodyPart);

            message.setContent(multipart);

            Transport.send(message);
        } catch (MessagingException e) {
            throw new ApiException("invalid_email", "Not valid email", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
