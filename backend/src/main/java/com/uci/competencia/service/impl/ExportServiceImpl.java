package com.uci.competencia.service.impl;

import com.uci.competencia.model.dto.request.ExportBibliographyDTO;
import com.uci.competencia.model.dto.request.ExportReportDTO;
import com.uci.competencia.model.entity.CaseStudy;
import com.uci.competencia.model.entity.SearchResult;
import com.uci.competencia.repository.CaseStudyRepository;
import com.uci.competencia.repository.SearchResultRepository;
import com.uci.competencia.service.ExportService;
import com.uci.competencia.service.ProgressService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class ExportServiceImpl implements ExportService {

    private final CaseStudyRepository caseStudyRepository;
    private final SearchResultRepository searchResultRepository;
    private final ProgressService progressService;
    
    // Almacenamiento temporal de archivos exportados (en producción usar S3 o similar)
    private final Map<String, ExportedFile> exportedFiles = new HashMap<>();

    @Override
    @Transactional(readOnly = true)
    public BibliographyExportResult exportBibliography(ExportBibliographyDTO request) {
        log.info("Exporting bibliography: format={}, caseId={}", request.getFormat(), request.getCaseStudyId());

        BibliographyExportResult result = new BibliographyExportResult();
        result.exportId = "bib-" + System.currentTimeMillis();
        result.warnings = new ArrayList<>();

        try {
            // Obtener caso de estudio
            Optional<CaseStudy> caseStudy = caseStudyRepository.findById(request.getCaseStudyId());
            if (caseStudy.isEmpty()) {
                result.warnings.add("Caso no encontrado");
                result.articleCount = 0;
                result.estimatedPages = 0;
                return result;
            }

            CaseStudy cs = caseStudy.get();

            // Obtener artículos requeridos
            List<SearchResult> articles = new ArrayList<>();
            if (cs.getRequiredArticles() != null) {
                for (String articleId : cs.getRequiredArticles()) {
                    searchResultRepository.findById(articleId).ifPresent(articles::add);
                }
            }

            // Generar contenido de bibliografía
            String bibliographyContent = generateBibliographyContent(articles, request.getFormat());

            // Guardar archivo para descarga
            ExportedFile exportedFile = new ExportedFile();
            exportedFile.content = bibliographyContent;
            exportedFile.contentType = "text/plain";
            exportedFile.createdAt = System.currentTimeMillis();
            exportedFile.expiresAt = System.currentTimeMillis() + (24 * 60 * 60 * 1000); // 24 horas
            exportedFiles.put(result.exportId, exportedFile);

            // Preparar respuesta
            result.format = ExportService.ExportFormat.valueOf(request.getFormat().toUpperCase());
            result.articleCount = articles.size();
            result.estimatedPages = Math.max(1, articles.size() / 5); // Estimación simple
            result.preview = bibliographyContent.substring(0, Math.min(500, bibliographyContent.length())) + "...";
            result.downloadUrl = "/api/export/download/" + result.exportId;

            log.info("Bibliography exported successfully: {} articles, {} pages", 
                     result.articleCount, result.estimatedPages);

        } catch (Exception e) {
            log.error("Error exporting bibliography", e);
            result.warnings.add("Error durante exportación: " + e.getMessage());
            result.articleCount = 0;
            result.estimatedPages = 0;
        }

        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public ReportExportResult exportProgressReport(ExportReportDTO request) {
        log.info("Exporting progress report for student: {}", request.getStudentId());

        ReportExportResult result = new ReportExportResult();
        result.reportId = "report-" + System.currentTimeMillis();

        try {
            // Obtener datos de progreso del estudiante
            var progressData = progressService.getStudentProgress(request.getStudentId().toString());

            // Generar contenido del reporte
            String reportContent = generateProgressReportContent(request.getStudentId().toString(), progressData);

            // Guardar archivo para descarga
            ExportedFile exportedFile = new ExportedFile();
            exportedFile.content = reportContent;
            exportedFile.contentType = "application/pdf";
            exportedFile.createdAt = System.currentTimeMillis();
            exportedFile.expiresAt = System.currentTimeMillis() + (24 * 60 * 60 * 1000); // 24 horas
            exportedFiles.put(result.reportId, exportedFile);

            result.downloadUrl = "/api/export/download/" + result.reportId;
            result.format = "PDF";
            result.generatedAt = System.currentTimeMillis();

            log.info("Progress report exported successfully");

        } catch (Exception e) {
            log.error("Error exporting progress report", e);
            result.format = "ERROR";
            result.downloadUrl = "";
        }

        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public InputStream generateSystemUsageReport(String format, String fromDate, String toDate) {
        log.info("Generating system usage report: format={}, from={}, to={}", format, fromDate, toDate);

        try {
            String reportContent = buildSystemUsageReport(format, fromDate, toDate);
            return new ByteArrayInputStream(reportContent.getBytes());

        } catch (Exception e) {
            log.error("Error generating system usage report", e);
            String errorContent = "Error generating report: " + e.getMessage();
            return new ByteArrayInputStream(errorContent.getBytes());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public InputStream getDownloadFile(String fileId) {
        log.info("Getting download file: {}", fileId);

        try {
            ExportedFile exportedFile = exportedFiles.get(fileId);
            if (exportedFile == null) {
                String errorMsg = "File not found: " + fileId;
                log.warn(errorMsg);
                return new ByteArrayInputStream(errorMsg.getBytes());
            }

            // Verificar si expiró
            if (exportedFile.isExpired()) {
                log.warn("File expired: {}", fileId);
                exportedFiles.remove(fileId);
                return new ByteArrayInputStream("File expired".getBytes());
            }

            return new ByteArrayInputStream(exportedFile.content.getBytes());

        } catch (Exception e) {
            log.error("Error getting download file: {}", fileId, e);
            return new ByteArrayInputStream(("Error: " + e.getMessage()).getBytes());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public FileMetadata getFileMetadata(String fileId) {
        log.info("Getting file metadata: {}", fileId);

        FileMetadata metadata = new FileMetadata();
        metadata.id = fileId;

        try {
            ExportedFile exportedFile = exportedFiles.get(fileId);
            if (exportedFile == null) {
                metadata.expired = true;
                return metadata;
            }

            metadata.filename = "export-" + fileId + ".pdf";
            metadata.contentType = exportedFile.contentType;
            metadata.size = exportedFile.content.length();
            metadata.createdAt = exportedFile.createdAt;
            metadata.expiresAt = exportedFile.expiresAt;
            metadata.expired = exportedFile.isExpired();

        } catch (Exception e) {
            log.error("Error getting file metadata: {}", fileId, e);
            metadata.expired = true;
        }

        return metadata;
    }

    @Override
    @Transactional
    public void deleteExpiredFile(String fileId) {
        log.info("Deleting file: {}", fileId);

        try {
            ExportedFile exportedFile = exportedFiles.get(fileId);
            if (exportedFile != null && exportedFile.isExpired()) {
                exportedFiles.remove(fileId);
                log.info("File deleted: {}", fileId);
            }
        } catch (Exception e) {
            log.error("Error deleting file: {}", fileId, e);
        }
    }

    /**
     * Genera contenido de bibliografía en el formato especificado
     */
    private String generateBibliographyContent(List<SearchResult> articles, String format) {
        StringBuilder sb = new StringBuilder();
        
        switch (format.toUpperCase()) {
            case "APA":
                sb.append(generateAPABibliography(articles));
                break;
            case "VANCOUVER":
                sb.append(generateVancouverBibliography(articles));
                break;
            case "BIBTEX":
                sb.append(generateBibTexBibliography(articles));
                break;
            case "XML":
                sb.append(generateXMLBibliography(articles));
                break;
            default:
                sb.append(generateAPABibliography(articles));
        }
        
        return sb.toString();
    }

    private String generateAPABibliography(List<SearchResult> articles) {
        StringBuilder sb = new StringBuilder();
        sb.append("BIBLIOGRAFÍA - Formato APA\n");
        sb.append("============================\n\n");
        
        int i = 1;
        for (SearchResult article : articles) {
            sb.append(i++).append(". ");
            
            // Autores
            if (article.getAuthors() != null) {
                sb.append(article.getAuthors()).append(" ");
            }
            
            // Año
            if (article.getPublicationYear() != null) {
                sb.append("(").append(article.getPublicationYear()).append("). ");
            }
            
            // Título
            if (article.getTitle() != null) {
                sb.append(article.getTitle()).append(". ");
            }
            
            // Revista
            if (article.getJournal() != null) {
                sb.append(article.getJournal()).append(". ");
            }
            
            // DOI
            if (article.getDoi() != null) {
                sb.append("https://doi.org/").append(article.getDoi());
            }
            
            sb.append("\n\n");
        }
        
        return sb.toString();
    }

    private String generateVancouverBibliography(List<SearchResult> articles) {
        StringBuilder sb = new StringBuilder();
        sb.append("BIBLIOGRAFÍA - Formato Vancouver\n");
        sb.append("==================================\n\n");
        
        int i = 1;
        for (SearchResult article : articles) {
            sb.append(i++).append(". ");
            
            if (article.getAuthors() != null) {
                sb.append(article.getAuthors()).append(". ");
            }
            
            if (article.getTitle() != null) {
                sb.append(article.getTitle()).append(". ");
            }
            
            if (article.getJournal() != null) {
                sb.append(article.getJournal()).append(". ");
            }
            
            if (article.getPublicationYear() != null) {
                sb.append(article.getPublicationYear());
            }
            
            sb.append("\n\n");
        }
        
        return sb.toString();
    }

    private String generateBibTexBibliography(List<SearchResult> articles) {
        StringBuilder sb = new StringBuilder();
        sb.append("% BIBLIOGRAFÍA - Formato BibTeX\n\n");
        
        for (SearchResult article : articles) {
            sb.append("@article{").append(article.getPmid()).append(",\n");
            
            if (article.getTitle() != null) {
                sb.append("  title={").append(article.getTitle()).append("},\n");
            }
            
            if (article.getAuthors() != null) {
                sb.append("  author={").append(article.getAuthors()).append("},\n");
            }
            
            if (article.getJournal() != null) {
                sb.append("  journal={").append(article.getJournal()).append("},\n");
            }
            
            if (article.getPublicationYear() != null) {
                sb.append("  year={").append(article.getPublicationYear()).append("},\n");
            }
            
            if (article.getDoi() != null) {
                sb.append("  doi={").append(article.getDoi()).append("},\n");
            }
            
            sb.append("}\n\n");
        }
        
        return sb.toString();
    }

    private String generateXMLBibliography(List<SearchResult> articles) {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<bibliography>\n");
        
        for (SearchResult article : articles) {
            sb.append("  <article>\n");
            
            if (article.getTitle() != null) {
                sb.append("    <title>").append(escapeXML(article.getTitle())).append("</title>\n");
            }
            
            if (article.getAuthors() != null) {
                sb.append("    <authors>").append(escapeXML(article.getAuthors())).append("</authors>\n");
            }
            
            if (article.getJournal() != null) {
                sb.append("    <journal>").append(escapeXML(article.getJournal())).append("</journal>\n");
            }
            
            if (article.getPublicationYear() != null) {
                sb.append("    <year>").append(article.getPublicationYear()).append("</year>\n");
            }
            
            if (article.getPmid() != null) {
                sb.append("    <pmid>").append(article.getPmid()).append("</pmid>\n");
            }
            
            if (article.getDoi() != null) {
                sb.append("    <doi>").append(article.getDoi()).append("</doi>\n");
            }
            
            sb.append("  </article>\n");
        }
        
        sb.append("</bibliography>");
        return sb.toString();
    }

    /**
     * Genera contenido de reporte de progreso
     */
    private String generateProgressReportContent(String studentId, Object progressData) {
        StringBuilder sb = new StringBuilder();
        sb.append("REPORTE DE PROGRESO DE ESTUDIANTE\n");
        sb.append("==================================\n");
        sb.append("Estudiante ID: ").append(studentId).append("\n");
        sb.append("Generado: ").append(LocalDateTime.now().format(DateTimeFormatter.ISO_DATE_TIME)).append("\n\n");
        
        sb.append("Resumen General\n");
        sb.append("---------------\n");
        sb.append("Esta es una versión simplificada del reporte de progreso.\n");
        sb.append("En una implementación completa, incluiría:\n");
        sb.append("- Gráficas de progreso por competencia\n");
        sb.append("- Análisis detallado de actividades\n");
        sb.append("- Badges y logros obtenidos\n");
        sb.append("- Recomendaciones personalizadas\n\n");
        
        return sb.toString();
    }

    /**
     * Genera contenido de reporte de uso del sistema
     */
    private String buildSystemUsageReport(String format, String fromDate, String toDate) {
        StringBuilder sb = new StringBuilder();
        
        if ("JSON".equalsIgnoreCase(format)) {
            sb.append("{\n");
            sb.append("  \"report\": \"System Usage Report\",\n");
            sb.append("  \"period\": {\n");
            sb.append("    \"from\": \"").append(fromDate).append("\",\n");
            sb.append("    \"to\": \"").append(toDate).append("\"\n");
            sb.append("  },\n");
            sb.append("  \"summary\": {\n");
            sb.append("    \"totalUsers\": 0,\n");
            sb.append("    \"totalSearches\": 0,\n");
            sb.append("    \"totalVerifications\": 0\n");
            sb.append("  }\n");
            sb.append("}\n");
        } else {
            sb.append("REPORTE DE USO DEL SISTEMA\n");
            sb.append("==========================\n");
            sb.append("Período: ").append(fromDate).append(" a ").append(toDate).append("\n");
            sb.append("Formato: ").append(format).append("\n\n");
            sb.append("Resumen\n");
            sb.append("-------\n");
            sb.append("Total de usuarios: 0\n");
            sb.append("Total de búsquedas: 0\n");
            sb.append("Total de verificaciones: 0\n");
        }
        
        return sb.toString();
    }

    /**
     * Escapa caracteres especiales para XML
     */
    private String escapeXML(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                   .replace("<", "&lt;")
                   .replace(">", "&gt;")
                   .replace("\"", "&quot;")
                   .replace("'", "&apos;");
    }

    /**
     * Clase interna para almacenamiento temporal de archivos
     */
    private static class ExportedFile {
        String content;
        String contentType;
        long createdAt;
        long expiresAt;

        boolean isExpired() {
            return System.currentTimeMillis() > expiresAt;
        }
    }
}