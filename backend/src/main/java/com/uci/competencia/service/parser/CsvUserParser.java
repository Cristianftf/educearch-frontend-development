package com.uci.competencia.service.parser;

import com.uci.competencia.model.dto.request.UserBatchImportDTO;
import com.uci.competencia.model.enums.Role;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Parser para archivos CSV de importación de usuarios
 * 
 * Formato esperado (con encabezados):
 * email,firstName,lastName,role,institutionalId
 * user@uci.cu,John,Doe,STUDENT,A123456
 */
@Service
@Slf4j
public class CsvUserParser implements UserFileParser {

    private static final int MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    private static final int MAX_RECORDS = 5000;
    
    @Override
    public UserBatchImportDTO parse(MultipartFile file) throws IOException {
        log.info("Parsing CSV file: {}, size: {} bytes", file.getOriginalFilename(), file.getSize());
        
        // Validaciones básicas
        validateFile(file);
        
        UserBatchImportDTO importDTO = new UserBatchImportDTO();
        List<UserBatchImportDTO.UserImportRecord> users = new ArrayList<>();
        Set<String> emailsSeen = new HashSet<>();
        List<String> warnings = new ArrayList<>();
        int lineNumber = 0;
        
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            
            String line;
            String[] headers = null;
            
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                
                // Primera línea: encabezados
                if (lineNumber == 1) {
                    headers = parseLine(line);
                    validateHeaders(headers);
                    continue;
                }
                
                // Validar límite de registros
                if (users.size() >= MAX_RECORDS) {
                    warnings.add("Límite de " + MAX_RECORDS + " usuarios alcanzado. Se ignorarán registros posteriores.");
                    break;
                }
                
                // Línea vacía o comentario
                if (line.trim().isEmpty() || line.trim().startsWith("#")) {
                    continue;
                }
                
                try {
                    String[] values = parseLine(line);
                    UserBatchImportDTO.UserImportRecord record = mapToUserRecord(values, headers, lineNumber);
                    
                    // Validar duplicados dentro del archivo
                    if (emailsSeen.contains(record.getEmail())) {
                        warnings.add("Línea " + lineNumber + ": Email duplicado en el archivo: " + record.getEmail());
                        continue;
                    }
                    
                    emailsSeen.add(record.getEmail());
                    users.add(record);
                    
                } catch (IllegalArgumentException e) {
                    warnings.add("Línea " + lineNumber + ": " + e.getMessage());
                }
            }
        }
        
        // Configurar DTO
        importDTO.setUsers(users);
        importDTO.setSourceType("CSV");
        importDTO.setBatchName(extractFileName(file.getOriginalFilename()));
        importDTO.setUpdateExisting(false); // Por defecto no actualizar
        
        log.info("CSV parsing completed: {} valid users, {} warnings", users.size(), warnings.size());
        
        return importDTO;
    }
    
    @Override
    public boolean supports(String filename) {
        return filename != null && filename.toLowerCase().endsWith(".csv");
    }
    
    /**
     * Parsea una línea CSV respetando comillas
     */
    private String[] parseLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            
            if (ch == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    // Comilla escapada
                    current.append('"');
                    i++;
                } else {
                    // Toggle estado de comillas
                    inQuotes = !inQuotes;
                }
            } else if (ch == ',' && !inQuotes) {
                // Separador de campos
                fields.add(current.toString().trim());
                current = new StringBuilder();
            } else {
                current.append(ch);
            }
        }
        
        fields.add(current.toString().trim());
        return fields.toArray(new String[0]);
    }
    
    /**
     * Valida que el archivo sea CSV válido
     */
    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("El archivo no puede estar vacío");
        }
        
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("El archivo es demasiado grande (máx: 5MB)");
        }
        
        String filename = file.getOriginalFilename();
        if (!supports(filename)) {
            throw new IllegalArgumentException("El archivo debe ser CSV (.csv)");
        }
    }
    
    /**
     * Valida encabezados requeridos
     */
    private void validateHeaders(String[] headers) {
        if (headers == null || headers.length == 0) {
            throw new IllegalArgumentException("El archivo CSV debe contener encabezados");
        }
        
        // Campos requeridos
        Set<String> required = Set.of("email", "firstname", "lastname", "role");
        Set<String> found = new HashSet<>();
        
        for (String header : headers) {
            found.add(header.toLowerCase().trim());
        }
        
        for (String req : required) {
            if (!found.contains(req)) {
                throw new IllegalArgumentException("Encabezado requerido faltante: " + req);
            }
        }
    }
    
    /**
     * Mapea valores CSV a UserImportRecord con validación
     */
    private UserBatchImportDTO.UserImportRecord mapToUserRecord(
            String[] values, String[] headers, int lineNumber) {
        
        // Crear mapa de índices
        java.util.Map<String, Integer> headerMap = new java.util.HashMap<>();
        for (int i = 0; i < headers.length; i++) {
            headerMap.put(headers[i].toLowerCase().trim(), i);
        }
        
        // Extraer valores
        String email = getValue(values, headerMap, "email").trim();
        String firstName = getValue(values, headerMap, "firstname").trim();
        String lastName = getValue(values, headerMap, "lastname").trim();
        String roleStr = getValue(values, headerMap, "role").trim().toUpperCase();
        String institutionalId = getValue(values, headerMap, "institutionalid", "");
        
        // Validaciones
        if (email.isEmpty()) {
            throw new IllegalArgumentException("Email es requerido");
        }
        
        if (!email.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$")) {
            throw new IllegalArgumentException("Email inválido: " + email);
        }
        
        if (firstName.isEmpty()) {
            throw new IllegalArgumentException("firstName es requerido");
        }
        
        if (lastName.isEmpty()) {
            throw new IllegalArgumentException("lastName es requerido");
        }
        
        // Validar rol
        Role role;
        try {
            role = Role.valueOf(roleStr);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Rol inválido: " + roleStr + 
                " (valores válidos: STUDENT, PROFESSOR, ADMIN)");
        }
        
        return UserBatchImportDTO.UserImportRecord.builder()
            .email(email)
            .firstName(firstName)
            .lastName(lastName)
            .role(role.name())
            .institutionalId(institutionalId)
            .build();
    }
    
    /**
     * Obtiene valor de array por nombre de columna
     */
    private String getValue(String[] values, java.util.Map<String, Integer> headerMap, String columnName) {
        return getValue(values, headerMap, columnName, "");
    }
    
    /**
     * Obtiene valor de array por nombre de columna con default
     */
    private String getValue(String[] values, java.util.Map<String, Integer> headerMap, 
                           String columnName, String defaultValue) {
        Integer index = headerMap.get(columnName.toLowerCase());
        
        if (index == null || index >= values.length) {
            return defaultValue;
        }
        
        String value = values[index];
        return value == null ? defaultValue : value;
    }
    
    /**
     * Extrae nombre del archivo sin extensión
     */
    private String extractFileName(String originalFilename) {
        if (originalFilename == null) return "batch_" + System.currentTimeMillis();
        
        int lastDot = originalFilename.lastIndexOf('.');
        if (lastDot > 0) {
            return originalFilename.substring(0, lastDot);
        }
        return originalFilename;
    }
}
