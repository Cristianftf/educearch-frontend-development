package com.uci.competencia.util;

import com.uci.competencia.model.enums.StudyType;

import java.util.List;

/**
 * Mapeo de tipos de publicación a tipo de estudio y nivel de evidencia.
 */
public final class EvidenceLevelMapper {

    private EvidenceLevelMapper() {}

    public static StudyType mapStudyType(List<String> publicationTypes) {
        if (publicationTypes == null || publicationTypes.isEmpty()) {
            return StudyType.OTHER;
        }
        for (String type : publicationTypes) {
            if (type == null) continue;
            String normalized = type.trim().toLowerCase();
            if (normalized.contains("systematic review")) {
                return StudyType.SYSTEMATIC_REVIEW;
            }
            if (normalized.contains("meta-analysis") || normalized.contains("meta analysis")) {
                return StudyType.META_ANALYSIS;
            }
            if (normalized.contains("randomized controlled trial") || normalized.contains("clinical trial")) {
                return StudyType.RANDOMIZED_CONTROLLED_TRIAL;
            }
            if (normalized.contains("cohort")) {
                return StudyType.COHORT_STUDY;
            }
            if (normalized.contains("case-control")) {
                return StudyType.CASE_CONTROL;
            }
            if (normalized.contains("case report")) {
                return StudyType.CASE_REPORT;
            }
            if (normalized.contains("editorial")) {
                return StudyType.EDITORIAL;
            }
            if (normalized.contains("review")) {
                return StudyType.REVIEW;
            }
            if (normalized.contains("letter")) {
                return StudyType.LETTER;
            }
        }
        return StudyType.OTHER;
    }

    public static int evidenceLevelForStudyType(StudyType type) {
        if (type == null) return 6;
        return switch (type) {
            case SYSTEMATIC_REVIEW, META_ANALYSIS -> 1;
            case RANDOMIZED_CONTROLLED_TRIAL -> 2;
            case COHORT_STUDY -> 3;
            case CASE_CONTROL -> 4;
            case CASE_REPORT -> 5;
            default -> 6;
        };
    }
}
