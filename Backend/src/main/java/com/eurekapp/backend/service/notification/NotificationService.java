package com.eurekapp.backend.service.notification;


public interface NotificationService {
    void sendNotification(String notification, byte[] image);
}
