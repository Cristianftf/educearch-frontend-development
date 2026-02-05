package com.uci.competencia.service;

import com.uci.competencia.model.dto.request.GenTextRequest;
import com.uci.competencia.model.dto.request.VerificationRequest;
import com.uci.competencia.model.dto.response.GenTextResult;
import com.uci.competencia.model.dto.response.VerificationResponseDTO;
import java.util.List;

/**
 * Interfaz RAGService - Motor de Recuperación Aumentada por Generación (RAG)
 * 
 * Responsable de:
 * - Generación de texto basado en evidencia científica
 * - Verificación de claims contra evidencia
 * - Búsqueda semántica de artículos
 * - Re-ranking de resultados por calidad de evidencia
 */
public interface RAGService {
    
    /**
     * Genera GenText (texto generado) basado en evidencia científica
     * 
     * @param request Solicitud con query y filtros
     * @return Resultado con texto generado y atribuciones
     */
    GenTextResult generateEvidenceBasedText(GenTextRequest request);
    
    /**
     * Verifica un claim (afirmación) contra la evidencia recuperada
     * Pipeline completo: búsqueda → ranking → verificación → explicación
     * 
     * @param request Solicitud con claim y contexto
     * @return Resultado de verificación con veredicto y explicaciones
     */
    VerificationResponseDTO verifyClaimAgainstEvidence(VerificationRequest request);
    
    /**
     * Búsqueda semántica de artículos usando embeddings
     * 
     * @param query Consulta en lenguaje natural
     * @param maxResults Número máximo de resultados
     * @return Lista de artículos relevantes
     */
    List<RelevantArticle> semanticSearch(String query, int maxResults);
    
    /**
     * Re-ranking de artículos por nivel de evidencia
     * 
     * @param articles Artículos a re-clasificar
     * @return Artículos reordenados por calidad
     */
    List<RelevantArticle> rerankByEvidenceLevel(List<RelevantArticle> articles);
    
    /**
     * Valida y atribuye citas en el texto generado
     * 
     * @param text Texto con potenciales hallucinations
     * @param sourceArticles Artículos fuente
     * @return Texto validado con atribuciones
     */
    String validateAndAttributeCitations(String text, List<RelevantArticle> sourceArticles);
    
    /**
     * Calcula métricas de calidad del GenText
     * 
     * @param genText Texto generado
     * @return Score de calidad
     */
    Double calculateQualityScore(String genText);
    
    /**
     * Modelo de artículo relevante
     */
    class RelevantArticle {
        public String pmid;
        public String title;
        public String snippet;
        public Double relevanceScore;
        public Integer evidenceLevel;
        public String stance; // SUPPORTS, CONFLICTING, NEUTRAL
        public Double similarityScore;
    }
}
