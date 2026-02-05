package com.uci.competencia.model.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

/**
 * DTO para importación batch de usuarios
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserBatchImportDTO {
    
    private List<UserImportRecord> users;
    
    private String sourceType; // CSV, EXCEL, API
    
    private boolean updateExisting;
    
    private String batchName;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserImportRecord {
        private String email;
        private String firstName;
        private String lastName;
        private String role; // STUDENT, PROFESSOR, ADMIN
        private String faculty;
        private String passwordHash;
        private String institutionalId;
    }
}
