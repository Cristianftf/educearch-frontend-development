package com.uci.competencia.model.enums;

public enum Verdict {
    SUPPORTED("SUPPORTED"),
    CONFLICTING("CONFLICTING"),
    REFUTED("REFUTED"),
    INSUFFICIENT_EVIDENCE("INSUFFICIENT_EVIDENCE");

    private final String value;

    Verdict(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
