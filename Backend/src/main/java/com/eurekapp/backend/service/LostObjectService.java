package com.eurekapp.backend.service;

import com.eurekapp.backend.model.FoundObjectStructVector;
import com.eurekapp.backend.service.notification.NotificationService;
import org.springframework.stereotype.Service;

@Service
public class LostObjectService {
    private final NotificationService notificationService;

    public LostObjectService(NotificationService notificationService) {
        this.notificationService = notificationService;
    }


    public void findCoincidences(FoundObjectStructVector foundObjectVector) {

    }
}
