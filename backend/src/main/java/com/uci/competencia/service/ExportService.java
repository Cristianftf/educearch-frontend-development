package com.uci.competencia.service;

import com.uci.competencia.model.dto.request.ExportBibliographyDTO;
import com.uci.competencia.model.dto.request.ExportReportDTO;
import java.io.InputStream;
import java.util.List;

/**
 * Interfaz ExportService - Exportación de datos en múltiples formatos
 * 
 * Responsable de:
 * - Generación de bibliografías (APA, VANCOUVER, BIBTEX, XML)
 * - Generación de reportes PDF/EXCEL
 * - Gestión de descargas de archivos
 */
public interface ExportService {
    
    /**
     * Exporta una bibliografía en el formato especificado
     * 
     * @param request Solicitud de exportación
     * @return Resultado con preview y URL de descarga
     */
    BibliographyExportResult exportBibliography(ExportBibliographyDTO request);
    
    /**
     * Genera un reporte de progreso de estudiante(s)
     * 
     * @param request Solicitud de reporte
     * @return Resultado con URL de descarga
     */
    ReportExportResult exportProgressReport(ExportReportDTO request);
    
    /**
     * Genera reporte de uso del sistema para administradores
     * 
     * @param format Formato (PDF, EXCEL, JSON)
     * @param fromDate Fecha inicial
     * @param toDate Fecha final
     * @return Archivo generado
     */
    InputStream generateSystemUsageReport(String format, String fromDate, String toDate);
    
    /**
     * Obtiene archivo preparado para descargar
     * 
     * @param fileId ID del archivo
     * @return Stream del archivo
     */
    InputStream getDownloadFile(String fileId);
    
    /**
     * Obtiene información de archivo para descarga
     * 
     * @param fileId ID del archivo
     * @return Metadatos del archivo
     */
    FileMetadata getFileMetadata(String fileId);
    
    /**
     * Elimina archivo después de período de expiración
     * 
     * @param fileId ID del archivo
     */
    void deleteExpiredFile(String fileId);
    
    /**
     * Formatos de exportación soportados
     */
    enum ExportFormat {
        APA("APA (American Psychological Association)"),
        VANCOUVER("Vancouver (International Committee of Medical Journal Editors)"),
        BIBTEX("BibTeX (LaTeX)"),
        XML("XML"),
        PDF("PDF"),
        EXCEL("Excel");
        
        private final String description;
        
        ExportFormat(String description) {
            this.description = description;
        }
        
        public String getDescription() {
            return description;
        }
    }
    
    /**
     * Resultado de exportación de bibliografía
     */
    class BibliographyExportResult {
        public String exportId;
        public String downloadUrl;
        public String preview;
        public ExportFormat format;
        public int articleCount;
        public int estimatedPages;
        public List<String> warnings;
    }
    
    /**
     * Resultado de exportación de reporte
     */
    class ReportExportResult {
        public String reportId;
        public String downloadUrl;
        public String format;
        public long generatedAt;
    }
    
    /**
     * Metadatos de archivo
     */
    class FileMetadata {
        public String id;
        public String filename;
        public String contentType;
        public long size;
        public long createdAt;
        public long expiresAt;
        public boolean expired;
    }
}
