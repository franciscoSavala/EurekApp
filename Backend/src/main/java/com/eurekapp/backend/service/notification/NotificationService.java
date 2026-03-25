package com.eurekapp.backend.service.notification;


public interface NotificationService {
    void sendNotification(String notification);
    void sendNotification(String recipient, String subject, String content);
}
