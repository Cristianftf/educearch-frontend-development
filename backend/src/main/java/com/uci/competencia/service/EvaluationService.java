package com.uci.competencia.service;

import com.uci.competencia.model.dto.response.EvaluationDTO;
import com.uci.competencia.model.entity.Evaluation;

import java.util.List;
import java.util.Map;

/**
 * Interfaz EvaluationService - Servicios de evaluación de casos
 */
public interface EvaluationService {

    /**
     * Obtener evaluaciones pendientes para un profesor
     *
     * @param professorId ID del profesor
     * @return Lista de evaluaciones pendientes
     */
    List<Map<String, Object>> getPendingEvaluations(String professorId);

    /**
     * Obtener evaluaciones revisadas para un profesor
     *
     * @param professorId ID del profesor
     * @return Lista de evaluaciones revisadas
     */
    List<Map<String, Object>> getReviewedEvaluations(String professorId);

    /**
     * Crear o actualizar una evaluación
     *
     * @param submissionId ID de la submission
     * @param professorId ID del profesor
     * @param evaluationData Datos de la evaluación
     * @return Evaluación creada
     */
    Evaluation createEvaluation(String submissionId, String professorId, Map<String, Object> evaluationData);

    /**
     * Obtener evaluación de una submission
     *
     * @param submissionId ID de la submission
     * @return Evaluación encontrada
     */
    EvaluationDTO getEvaluationBySubmission(String submissionId);

    /**
     * Obtener submission por ID
     *
     * @param submissionId ID de la submission
     * @return Datos de la submission
     */
    Map<String, Object> getSubmissionById(String submissionId);

    /**
     * Obtener todas las evaluaciones de un profesor
     *
     * @param professorId ID del profesor
     * @return Lista de evaluaciones
     */
    List<EvaluationDTO> getProfessorEvaluations(String professorId);

    /**
     * Actualizar evaluación existente
     *
     * @param evaluationId ID de la evaluación
     * @param evaluationData Nuevos datos
     * @return Evaluación actualizada
     */
    Evaluation updateEvaluation(String evaluationId, Map<String, Object> evaluationData);

    /**
     * Eliminar evaluación
     *
     * @param evaluationId ID de la evaluación
     */
    void deleteEvaluation(String evaluationId);
}
