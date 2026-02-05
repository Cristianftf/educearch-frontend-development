package com.uci.competencia.model.enums;

public enum LogLevel {
    INFO("INFO"),
    WARN("WARN"),
    ERROR("ERROR"),
    DEBUG("DEBUG");

    private final String value;

    LogLevel(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
