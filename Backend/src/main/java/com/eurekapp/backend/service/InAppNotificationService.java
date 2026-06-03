package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.response.InAppNotificationDto;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.InAppNotification;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IInAppNotificationRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@AllArgsConstructor
@Service
public class InAppNotificationService {

    private final IInAppNotificationRepository repository;

    public void createNotification(UserEurekapp user, String title, String description, String type, Long relatedRequestId) {
        InAppNotification notification = InAppNotification.builder()
                .user(user)
                .title(title)
                .description(description)
                .type(type)
                .read(false)
                .createdAt(LocalDateTime.now())
                .relatedRequestId(relatedRequestId)
                .build();
        repository.save(notification);
    }

    public List<InAppNotificationDto> getNotificationsForUser(UserEurekapp user) {
        return repository.findByUserOrderByCreatedAtDesc(user).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public long getUnreadCount(UserEurekapp user) {
        return repository.countByUserAndReadFalse(user);
    }

    public void resolveInvitationNotification(Long requestId, String newTitle, String newDescription) {
        repository.findByRelatedRequestId(requestId).ifPresent(n -> {
            n.setRelatedRequestId(null);
            n.setTitle(newTitle);
            n.setDescription(newDescription);
            repository.save(n);
        });
    }

    public void markAsRead(UserEurekapp user, Long notificationId) {
        InAppNotification notification = repository.findByIdAndUser(notificationId, user)
                .orElseThrow(() -> new NotFoundException("notification_not_found", "Notification not found"));
        notification.setRead(true);
        repository.save(notification);
    }

    private InAppNotificationDto toDto(InAppNotification n) {
        return InAppNotificationDto.builder()
                .id(n.getId())
                .title(n.getTitle())
                .description(n.getDescription())
                .type(n.getType())
                .read(n.isRead())
                .createdAt(n.getCreatedAt())
                .relatedRequestId(n.getRelatedRequestId())
                .build();
    }
}
