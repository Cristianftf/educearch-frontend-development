package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ActivityDTO {
    private String id;
    private String type;  // 'search' | 'verification' | 'export' | 'case_submission' | 'login'
    private String description;
    private String timestamp;
    private Object metadata;  // Flexible para diferentes tipos de actividades
}
