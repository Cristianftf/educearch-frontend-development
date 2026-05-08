package com.uci.competencia.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private record ErrorDescriptor(String code, HttpStatus status, String message) {}

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(
        MethodArgumentNotValidException ex,
        WebRequest request,
        HttpServletRequest httpServletRequest
    ) {
        markRequestError(httpServletRequest, ex);

        Map<String, Object> details = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
            details.put(error.getField(), error.getDefaultMessage())
        );

        ErrorResponse errorResponse = new ErrorResponse(
            "VALIDATION_FAILED",
            "Request validation failed",
            HttpStatus.BAD_REQUEST.value()
        );
        errorResponse.setPath(resolvePath(request));
        errorResponse.setDetails(details);
        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler({
        ResourceNotFoundException.class,
        InvalidCredentialsException.class,
        AuthenticationException.class,
        AccessDeniedException.class,
        IllegalArgumentException.class,
        HttpMessageNotReadableException.class,
        Exception.class
    })
    public ResponseEntity<ErrorResponse> handleException(
        Exception ex,
        WebRequest request,
        HttpServletRequest httpServletRequest
    ) {
        markRequestError(httpServletRequest, ex);
        ErrorDescriptor descriptor = resolveErrorDescriptor(ex);
        ErrorResponse errorResponse = new ErrorResponse(
            descriptor.code(),
            descriptor.message(),
            descriptor.status().value()
        );
        errorResponse.setPath(resolvePath(request));
        return new ResponseEntity<>(errorResponse, descriptor.status());
    }

    private ErrorDescriptor resolveErrorDescriptor(Exception ex) {
        if (ex instanceof ResourceNotFoundException) {
            return new ErrorDescriptor(
                "RESOURCE_NOT_FOUND",
                HttpStatus.NOT_FOUND,
                firstNonBlank(ex.getMessage(), "Requested resource was not found")
            );
        }

        if (ex instanceof InvalidCredentialsException) {
            return new ErrorDescriptor(
                "INVALID_CREDENTIALS",
                HttpStatus.UNAUTHORIZED,
                firstNonBlank(ex.getMessage(), "Invalid credentials")
            );
        }

        if (ex instanceof AuthenticationException) {
            return new ErrorDescriptor(
                "AUTHENTICATION_FAILED",
                HttpStatus.UNAUTHORIZED,
                firstNonBlank(ex.getMessage(), "Authentication failed")
            );
        }

        if (ex instanceof AccessDeniedException) {
            return new ErrorDescriptor(
                "ACCESS_DENIED",
                HttpStatus.FORBIDDEN,
                "You don't have permission to access this resource"
            );
        }

        if (ex instanceof HttpMessageNotReadableException notReadableException) {
            Throwable root = notReadableException.getMostSpecificCause();
            return new ErrorDescriptor(
                "INVALID_REQUEST_BODY",
                HttpStatus.BAD_REQUEST,
                firstNonBlank(
                    root != null ? root.getMessage() : null,
                    ex.getMessage(),
                    "Malformed request payload"
                )
            );
        }

        if (ex instanceof IllegalArgumentException) {
            return new ErrorDescriptor(
                "INVALID_ARGUMENT",
                HttpStatus.BAD_REQUEST,
                firstNonBlank(ex.getMessage(), "Invalid request")
            );
        }

        String message = firstNonBlank(ex.getMessage(), "An unexpected error occurred");
        String normalized = message.toLowerCase();

        if (normalized.contains("not found")) {
            return new ErrorDescriptor("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND, message);
        }

        if (
            normalized.contains("forbidden")
                || normalized.contains("permission")
                || normalized.contains("does not belong")
        ) {
            return new ErrorDescriptor("ACCESS_DENIED", HttpStatus.FORBIDDEN, message);
        }

        if (
            normalized.contains("invalid")
                || normalized.contains("cannot")
                || normalized.contains("required")
                || normalized.contains("malformed")
                || normalized.contains("not active")
                || normalized.contains("not assigned")
        ) {
            return new ErrorDescriptor("BUSINESS_RULE_VIOLATION", HttpStatus.BAD_REQUEST, message);
        }

        return new ErrorDescriptor(
            "INTERNAL_SERVER_ERROR",
            HttpStatus.INTERNAL_SERVER_ERROR,
            "An unexpected error occurred"
        );
    }

    private String resolvePath(WebRequest request) {
        return request.getDescription(false).replace("uri=", "");
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private void markRequestError(HttpServletRequest request, Exception ex) {
        if (request == null || ex == null) {
            return;
        }
        String message = ex.getClass().getSimpleName();
        if (ex.getMessage() != null && !ex.getMessage().isBlank()) {
            message = message + ": " + ex.getMessage();
        }
        request.setAttribute("system.error.message", message);
    }
}
