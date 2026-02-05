package com.uci.competencia.repository;

import com.uci.competencia.model.entity.Bibliography;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repositorio para la entidad Bibliography
 */
@Repository
public interface BibliographyRepository extends JpaRepository<Bibliography, String> {
    
    /**
     * Obtiene todas las bibliografías de un usuario
     */
    List<Bibliography> findByUserIdOrderByCreatedAtDesc(String userId);
    
    /**
     * Obtiene las bibliografías de un usuario con paginación
     */
    Page<Bibliography> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);
    
    /**
     * Obtiene una bibliografía por su ID y usuario (validación de propiedad)
     */
    Optional<Bibliography> findByIdAndUserId(String id, String userId);
    
    /**
     * Obtiene bibliografías por formato
     */
    List<Bibliography> findByUserIdAndFormat(String userId, String format);
}
