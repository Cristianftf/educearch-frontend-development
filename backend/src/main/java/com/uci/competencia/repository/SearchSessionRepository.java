package com.uci.competencia.repository;

import com.uci.competencia.model.entity.SearchSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface SearchSessionRepository extends JpaRepository<SearchSession, String> {
    @Transactional(readOnly = true)
    Page<SearchSession> findByUser_Id(String userId, Pageable pageable);

    @Transactional(readOnly = true)
    List<SearchSession> findByUser_IdInOrderByStartedAtDesc(Collection<String> userIds);

    @Transactional(readOnly = true)
    java.util.Optional<SearchSession> findByIdAndUser_Id(String id, String userId);

    @Transactional(readOnly = true)
    long countByUser_Id(String userId);

    @Transactional(readOnly = true)
    long countByStartedAtBetween(LocalDateTime start, LocalDateTime end);
}
