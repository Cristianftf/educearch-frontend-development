package com.uci.competencia.service.external;

public interface EmailService {
    void sendEmail(String to, String subject, String body);
    void sendPasswordResetEmail(String to, String resetLink);
    void sendCaseStudyAssignmentEmail(String to, String caseTitle);
}
