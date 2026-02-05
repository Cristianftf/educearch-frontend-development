package com.uci.competencia.service;

import com.uci.competencia.model.dto.response.StudentProgressDTO;

/**
 * Servicio para obtener y transformar el progreso del estudiante
 * en el formato esperado por el frontend
 */
public interface ProgressService {
    
    /**
     * Obtiene el progreso completo del estudiante en formato DTO
     * @param studentId ID del estudiante
     * @return StudentProgressDTO con estructura anidada de competencias
     */
    StudentProgressDTO getStudentProgress(String studentId);
    
    /**
     * Calcula el nivel de competencia basado en el score
     * @param score Puntuación de 0-100
     * @return Nivel: 'novice', 'intermediate' o 'advanced'
     */
    String calculateLevel(Double score);
}
