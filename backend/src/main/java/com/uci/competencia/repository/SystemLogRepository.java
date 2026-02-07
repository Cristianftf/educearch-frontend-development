package com.uci.competencia.repository;

import com.uci.competencia.model.entity.SystemLog;
import com.uci.competencia.model.enums.ActionType;
import com.uci.competencia.model.enums.LogLevel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SystemLogRepository extends JpaRepository<SystemLog, String>, JpaSpecificationExecutor<SystemLog> {
    Page<SystemLog> findByUserId(String userId, Pageable pageable);
    Page<SystemLog> findByLevel(LogLevel level, Pageable pageable);
    Page<SystemLog> findByAction(ActionType action, Pageable pageable);
    Page<SystemLog> findByTimestampBetween(LocalDateTime from, LocalDateTime to, Pageable pageable);
    long deleteByTimestampBefore(LocalDateTime timestamp);
    long countByTimestampBetween(LocalDateTime start, LocalDateTime end);
    long countByTimestampBetweenAndLevel(LocalDateTime start, LocalDateTime end, LogLevel level);
    Page<SystemLog> findByTimestampAfter(LocalDateTime start, Pageable pageable);

    @Query("select s.responseTime from SystemLog s where s.timestamp >= :start and s.responseTime is not null")
    List<Long> findResponseTimesSince(@Param("start") LocalDateTime start, Pageable pageable);
}
