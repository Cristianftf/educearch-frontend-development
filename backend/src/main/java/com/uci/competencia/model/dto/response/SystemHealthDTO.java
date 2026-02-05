package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SystemHealthDTO {
    private String status;
    private DatabaseHealthDTO database;
    private CacheHealthDTO cache;
    private PubMedHealthDTO pubmed;
    private String timestamp;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DatabaseHealthDTO {
        private String status;
        private String latency;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CacheHealthDTO {
        private String status;
        private String memoryUsage;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PubMedHealthDTO {
        private String status;
        private Integer callsRemaining;
    }
}
