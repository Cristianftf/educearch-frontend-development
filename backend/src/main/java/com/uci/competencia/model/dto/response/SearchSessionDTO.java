package com.uci.competencia.model.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * DTO para historial de sesiones de búsqueda
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SearchSessionDTO {

    /**
     * ID único de la sesión de búsqueda
     */
    private String id;

    /**
     * ID del usuario que realizó la búsqueda
     */
    private String userId;

    /**
     * Términos de búsqueda utilizados
     */
    private List<Map<String, Object>> terms;

    /**
     * Query raw utilizada
     */
    private String rawQuery;

    /**
     * Cantidad de resultados obtenidos
     */
    private Integer resultCount;

    /**
     * Indica si la búsqueda está marcada como favorita
     */
    private Boolean isFavorite;

    /**
     * Fecha y hora de creación de la búsqueda
     */
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'")
    private LocalDateTime createdAt;

    /**
     * Fecha y hora de última actualización
     */
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'")
    private LocalDateTime updatedAt;

    /**
     * Nombre descriptivo de la búsqueda (opcional)
     */
    private String name;

    /**
     * Descripción de los objetivos de la búsqueda
     */
    private String description;

    /**
     * Duración de la búsqueda en milisegundos
     */
    private Long durationMs;

    /**
     * Estado de la búsqueda (COMPLETED, IN_PROGRESS, FAILED)
     */
    private String status;
}
