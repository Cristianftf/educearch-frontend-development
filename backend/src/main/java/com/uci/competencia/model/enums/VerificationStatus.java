package com.uci.competencia.model.enums;

public enum VerificationStatus {
    PENDING("PENDING"),
    PROCESSING("PROCESSING"),
    COMPLETED("COMPLETED"),
    FAILED("FAILED");

    private final String value;

    VerificationStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
