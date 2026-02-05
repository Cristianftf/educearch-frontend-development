package com.uci.competencia.service.external;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class EmailServiceImpl implements EmailService {

    @Override
    public void sendEmail(String to, String subject, String body) {
        log.info("Sending email to: {}", to);
        // Implementation for email sending
    }

    @Override
    public void sendPasswordResetEmail(String to, String resetLink) {
        log.info("Sending password reset email to: {}", to);
        // Implementation for password reset email
    }

    @Override
    public void sendCaseStudyAssignmentEmail(String to, String caseTitle) {
        log.info("Sending case study assignment email to: {}", to);
        // Implementation for case study assignment email
    }
}
