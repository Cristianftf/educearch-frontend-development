package com.uci.competencia.repository;

import com.uci.competencia.model.entity.SearchResult;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SearchResultRepository extends JpaRepository<SearchResult, String> {
    Optional<SearchResult> findByPmid(String pmid);
    Page<SearchResult> findByTitle(String title, Pageable pageable);
    Page<SearchResult> findByTitleContainingIgnoreCase(String title, Pageable pageable);

    @Query(value = "SELECT * FROM search_results WHERE session_id = :sessionId", nativeQuery = true)
    List<SearchResult> findBySessionId(@Param("sessionId") String sessionId);
}
