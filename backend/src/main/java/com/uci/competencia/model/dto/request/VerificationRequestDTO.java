package com.uci.competencia.model.dto.request;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VerificationRequestDTO {
    @Size(max = 1000, message = "Claim text cannot exceed 1000 characters")
    private String claimText;

    private String sourceUrl;
    private VerificationContextDTO context;
    private String priority = "NORMAL";

    @Data
    public static class VerificationContextDTO {
        private String caseId;
        private String studentId;
        private String sessionId;
    }
}
