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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.util.Properties;

@Service
public class EmailService implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final Properties properties;
    private final String user;
    private final String password;

    public EmailService(
            @Value("${application.mail.host}") String host,
            @Value("${application.mail.password}") String password,
            @Value("${application.mail.port}") String port,
            @Value("${application.mail.user}") String user
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
    public void sendNotification(String recipient, String subject, String content) {
        Session session = Session.getInstance(this.properties, new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(user, password);
            }
        });
        Message message = new MimeMessage(session);
        try {
            // EU-357: el remitente sale de la misma cuenta con la que nos autenticamos ante el SMTP,
            // para que las dos no puedan quedar desincronizadas.
            message.setFrom(new InternetAddress(user));
            message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(recipient));
            message.setSubject(subject);
            MimeBodyPart mimeBodyPart = new MimeBodyPart();
            mimeBodyPart.setContent(content, "text/html; charset=utf-8");
            Multipart multipart = new MimeMultipart();
            multipart.addBodyPart(mimeBodyPart);
            message.setContent(multipart);
            Transport.send(message);
        } catch (MessagingException e) {
            // Sin este log el motivo del rechazo se pierde: quienes invocan el envio lo envuelven en
            // un catch que solo escribe un warn con el mensaje de esta excepcion.
            log.error("Fallo el envio de correo a {}", recipient, e);
            throw new ApiException("invalid_email", "No se pudo enviar el correo: " + e.getMessage(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
