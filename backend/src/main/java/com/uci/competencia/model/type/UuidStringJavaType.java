package com.uci.competencia.model.type;

import org.hibernate.type.descriptor.WrapperOptions;
import org.hibernate.type.descriptor.java.AbstractClassJavaType;

import java.util.UUID;

public class UuidStringJavaType extends AbstractClassJavaType<String> {

    public static final UuidStringJavaType INSTANCE = new UuidStringJavaType();

    public UuidStringJavaType() {
        super(String.class);
    }

    @Override
    public <X> X unwrap(String value, Class<X> type, WrapperOptions options) {
        if (value == null) {
            return null;
        }
        if (String.class.isAssignableFrom(type)) {
            return type.cast(value);
        }
        if (UUID.class.isAssignableFrom(type)) {
            return type.cast(UUID.fromString(value));
        }
        throw unknownUnwrap(type);
    }

    @Override
    public <X> String wrap(X value, WrapperOptions options) {
        if (value == null) {
            return null;
        }
        if (value instanceof String stringValue) {
            return stringValue;
        }
        if (value instanceof UUID uuidValue) {
            return uuidValue.toString();
        }
        throw unknownWrap(value.getClass());
    }
}
