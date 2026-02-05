package com.uci.competencia.model.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO para exportación de bibliografía
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExportBibliographyDTO {
    
    private Long caseStudyId;
    
    private String format; // PDF, DOCX, BibTeX, RIS
    
    private String citationStyle; // APA, MLA, Chicago, Harvard
    
    private Long userId;
}
