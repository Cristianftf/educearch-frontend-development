package com.uci.competencia.repository;

import com.uci.competencia.model.entity.SearchSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface SearchSessionRepository extends JpaRepository<SearchSession, String> {
    Page<SearchSession> findByUser_Id(String userId, Pageable pageable);
    List<SearchSession> findByUser_IdInOrderByStartedAtDesc(Collection<String> userIds);
    java.util.Optional<SearchSession> findByIdAndUser_Id(String id, String userId);
    long countByUser_Id(String userId);
    long countByStartedAtBetween(LocalDateTime start, LocalDateTime end);
}
