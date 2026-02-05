package com.uci.competencia.service.parser;

import com.uci.competencia.model.dto.request.UserBatchImportDTO;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Interfaz para parsear diferentes formatos de archivo de usuarios
 * Soporta CSV, Excel, etc.
 */
public interface UserFileParser {
    
    /**
     * Parsea un archivo y retorna DTO con usuarios
     * 
     * @param file Archivo a parsear (MultipartFile de Spring)
     * @return DTO con lista de usuarios y metadatos
     * @throws IOException Si hay error de lectura
     * @throws IllegalArgumentException Si el archivo es inválido
     */
    UserBatchImportDTO parse(MultipartFile file) throws IOException;
    
    /**
     * Verifica si este parser puede manejar el tipo de archivo
     * 
     * @param filename Nombre del archivo
     * @return true si este parser puede procesarlo
     */
    boolean supports(String filename);
}
