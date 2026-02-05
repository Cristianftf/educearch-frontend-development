package com.uci.competencia.controller.api;

import com.uci.competencia.model.entity.Bibliography;
import com.uci.competencia.repository.BibliographyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bibliography")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@Slf4j
@RequiredArgsConstructor
public class BibliographyController {
    
    private final BibliographyRepository bibliographyRepository;

    /**
     * Obtener historial de bibliografías del usuario
     * GET /api/bibliography/history
     */
    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<List<Map<String, Object>>> getBibliographyHistory() {
        String userId = getCurrentUserId();
        log.info("Getting bibliography history for user: {}", userId);
        
        try {
            // Obtener bibliografías del usuario desde base de datos
            List<Bibliography> bibliographies = bibliographyRepository.findByUserIdOrderByCreatedAtDesc(userId);
            
            // Convertir a formato de respuesta
            List<Map<String, Object>> result = new ArrayList<>();
            for (Bibliography bib : bibliographies) {
                Map<String, Object> bibMap = new HashMap<>();
                bibMap.put("id", bib.getId());
                bibMap.put("name", bib.getName());
                bibMap.put("format", bib.getFormat());
                bibMap.put("createdAt", bib.getCreatedAt().toString());
                bibMap.put("articleCount", bib.getArticleCount());
                result.add(bibMap);
            }
            
            log.info("Retrieved {} bibliographies for user {}", result.size(), userId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error retrieving bibliography history for user {}", userId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Descargar bibliografía
     * GET /api/bibliography/{id}/download?format={format}
     */
    @GetMapping("/{id}/download")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<byte[]> downloadBibliography(
            @PathVariable String id,
            @RequestParam(required = false, defaultValue = "txt") String format) {
        String userId = getCurrentUserId();
        log.info("Downloading bibliography {} in format {} for user {}", id, format, userId);
        
        try {
            // Validar que el usuario es propietario de la bibliografía
            Bibliography bibliography = bibliographyRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new RuntimeException("Bibliography not found or access denied: " + id));
            
            // Obtener contenido de la bibliografía
            byte[] content;
            String fileName;
            MediaType mediaType;
            
            if ("docx".equalsIgnoreCase(format)) {
                // Generar archivo DOCX (usando formato de texto enriquecido)
                content = generateDocxContent(bibliography);
                fileName = bibliography.getName() + ".docx";
                mediaType = MediaType.APPLICATION_OCTET_STREAM;
            } else {
                // Generar archivo TXT (formato por defecto)
                content = bibliography.getContent().getBytes(StandardCharsets.UTF_8);
                fileName = bibliography.getName() + ".txt";
                mediaType = MediaType.TEXT_PLAIN;
            }
            
            log.info("Bibliography {} downloaded successfully for user {}", id, userId);
            
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION, 
                            "attachment; filename=\"" + fileName + "\"")
                    .body(content);
                    
        } catch (RuntimeException e) {
            log.warn("Error downloading bibliography {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        } catch (Exception e) {
            log.error("Error generating bibliography download for id {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Obtener ID del usuario autenticado
     */
    private String getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails) {
            return ((UserDetails) principal).getUsername();
        }
        return principal.toString();
    }
    
    /**
     * Genera contenido DOCX simulado (usando formato RTF enriquecido)
     * En producción, usar Apache POI u otra librería DOCX
     */
    private byte[] generateDocxContent(Bibliography bibliography) {
        // Convertir contenido de texto a formato DOCX (simulado con RTF)
        String docxHeader = "{\\rtf1\\ansi\\ansicpg1252\\deff0\\deflang1033\n";
        String docxTitle = "{\\fonttbl{\\f0\\fnil\\fcharset0 Calibri;}}\n";
        String docxContent = "{\\colortbl;\\red0\\green0\\blue0;}\n";
        
        // Construir contenido
        StringBuilder docContent = new StringBuilder();
        docContent.append(docxHeader);
        docContent.append(docxTitle);
        docContent.append(docxContent);
        
        // Agregar título
        docContent.append("{\\*\\generator Msftedit 5.41.21.2510;}\\viewkind4\\uc1\\pard\\f0\\fs20 ");
        docContent.append("\\b ").append(bibliography.getName()).append("\\b0\\par\\par");
        
        // Agregar formato
        docContent.append("Formato: \\b ").append(bibliography.getFormat().toUpperCase()).append("\\b0\\par");
        docContent.append("Cantidad de artículos: \\b ").append(bibliography.getArticleCount()).append("\\b0\\par\\par");
        
        // Agregar contenido
        docContent.append(bibliography.getContent().replace("\n", "\\par "));
        
        // Cerrar RTF
        docContent.append("\\par}");
        
        return docContent.toString().getBytes(StandardCharsets.UTF_8);
    }
}