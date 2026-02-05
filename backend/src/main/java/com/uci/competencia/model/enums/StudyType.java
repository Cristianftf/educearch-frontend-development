package com.uci.competencia.model.enums;

public enum StudyType {
    SYSTEMATIC_REVIEW("Systematic Review"),
    META_ANALYSIS("Meta-Analysis"),
    RANDOMIZED_CONTROLLED_TRIAL("Randomized Controlled Trial"),
    COHORT_STUDY("Cohort Study"),
    CASE_CONTROL("Case-Control Study"),
    CASE_REPORT("Case Report"),
    EDITORIAL("Editorial"),
    REVIEW("Review"),
    LETTER("Letter"),
    OTHER("Other");

    private final String displayName;

    StudyType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
