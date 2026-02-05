package com.uci.competencia.model.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

/**
 * DTO para exportación de reportes
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExportReportDTO {
    
    private Long studentId;
    
    private String reportType; // PROGRESS, COMPETENCY, ACTIVITY
    
    private String format; // PDF, EXCEL, CSV
    
    private boolean includeGraphs;
    
    private List<String> sections; // Secciones a incluir
    
    private Long userId;
}
