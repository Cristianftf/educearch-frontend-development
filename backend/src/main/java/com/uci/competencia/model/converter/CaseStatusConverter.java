package com.uci.competencia.model.converter;

import com.uci.competencia.model.enums.CaseStatus;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = false)
public class CaseStatusConverter implements AttributeConverter<CaseStatus, String> {

    @Override
    public String convertToDatabaseColumn(CaseStatus attribute) {
        if (attribute == null) {
            return CaseStatus.DRAFT.name();
        }
        return attribute.name();
    }

    @Override
    public CaseStatus convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.trim().isEmpty()) {
            return CaseStatus.DRAFT;
        }
        try {
            return CaseStatus.valueOf(dbData.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return CaseStatus.DRAFT;
        }
    }
}
