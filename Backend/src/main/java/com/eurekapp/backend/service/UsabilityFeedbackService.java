package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.request.SubmitUsabilityFeedbackRequestDto;
import com.eurekapp.backend.model.UsabilityFeedback;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.IUsabilityFeedbackRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@AllArgsConstructor
@Service
public class UsabilityFeedbackService {

    private final IUsabilityFeedbackRepository repository;

    public void submit(UserEurekapp user, SubmitUsabilityFeedbackRequestDto dto) {
        String aspectsStr = (dto.getAspects() != null && !dto.getAspects().isEmpty())
                ? String.join(",", dto.getAspects())
                : null;
        UsabilityFeedback fb = UsabilityFeedback.builder()
                .starRating(dto.getStarRating())
                .aspects(aspectsStr)
                .comment(dto.getComment())
                .context(dto.getContext())
                .createdAt(LocalDateTime.now())
                .user(user)
                .build();
        repository.save(fb);
    }
}
