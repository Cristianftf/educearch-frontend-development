package com.uci.competencia.repository;

import com.uci.competencia.model.entity.SystemErrorInsight;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface SystemErrorInsightRepository extends JpaRepository<SystemErrorInsight, String> {

    Optional<SystemErrorInsight> findByFingerprint(String fingerprint);

    Page<SystemErrorInsight> findByLastSeenAfterOrderByLastSeenDesc(LocalDateTime since, Pageable pageable);

    long countByLastSeenAfter(LocalDateTime since);

    long countByLastSeenAfterAndSeverity(LocalDateTime since, String severity);
}
