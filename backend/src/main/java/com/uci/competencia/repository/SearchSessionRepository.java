package com.uci.competencia.repository;

import com.uci.competencia.model.entity.SearchSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SearchSessionRepository extends JpaRepository<SearchSession, String> {
    Page<SearchSession> findByUserId(String userId, Pageable pageable);
}
