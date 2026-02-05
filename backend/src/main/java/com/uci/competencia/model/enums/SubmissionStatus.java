package com.uci.competencia.model.enums;

public enum SubmissionStatus {
    PENDING("PENDING"),
    REVIEWED("REVIEWED"),
    RETURNED("RETURNED"),
    EVALUATED("EVALUATED");

    private final String value;

    SubmissionStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
