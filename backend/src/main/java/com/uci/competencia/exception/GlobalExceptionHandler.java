package com.uci.competencia.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.TransactionSystemException;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

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

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParam(
        MissingServletRequestParameterException ex,
        WebRequest request,
        HttpServletRequest httpServletRequest
    ) {
        markRequestError(httpServletRequest, ex);
        ErrorResponse errorResponse = new ErrorResponse(
            "MISSING_PARAMETER",
            "Required parameter '" + ex.getParameterName() + "' is missing",
            HttpStatus.BAD_REQUEST.value()
        );
        errorResponse.setPath(resolvePath(request));
        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotAllowed(
        HttpRequestMethodNotSupportedException ex,
        WebRequest request,
        HttpServletRequest httpServletRequest
    ) {
        markRequestError(httpServletRequest, ex);
        ErrorResponse errorResponse = new ErrorResponse(
            "METHOD_NOT_ALLOWED",
            "HTTP method " + ex.getMethod() + " is not supported for this endpoint",
            HttpStatus.METHOD_NOT_ALLOWED.value()
        );
        errorResponse.setPath(resolvePath(request));
        return new ResponseEntity<>(errorResponse, HttpStatus.METHOD_NOT_ALLOWED);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ErrorResponse> handleMultipartException(
        MultipartException ex,
        WebRequest request,
        HttpServletRequest httpServletRequest
    ) {
        markRequestError(httpServletRequest, ex);
        ErrorResponse errorResponse = new ErrorResponse(
            "MULTIPART_ERROR",
            "File upload error: " + ex.getMostSpecificCause().getMessage(),
            413
        );
        errorResponse.setPath(resolvePath(request));
        return new ResponseEntity<>(errorResponse, HttpStatus.valueOf(413));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(
        DataIntegrityViolationException ex,
        WebRequest request,
        HttpServletRequest httpServletRequest
    ) {
        markRequestError(httpServletRequest, ex);
        String message = ex.getMostSpecificCause() != null
            ? ex.getMostSpecificCause().getMessage()
            : ex.getMessage();
        ErrorResponse errorResponse = new ErrorResponse(
            "DATA_INTEGRITY_VIOLATION",
            "A database constraint was violated",
            HttpStatus.CONFLICT.value()
        );
        errorResponse.setPath(resolvePath(request));
        log.error("Data integrity violation: {}", message);
        return new ResponseEntity<>(errorResponse, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ErrorResponse> handleDataAccessException(
        DataAccessException ex,
        WebRequest request,
        HttpServletRequest httpServletRequest
    ) {
        markRequestError(httpServletRequest, ex);
        log.error("Database access error: {}", ex.getMessage());
        ErrorResponse errorResponse = new ErrorResponse(
            "DATABASE_ERROR",
            "A database error occurred",
            HttpStatus.INTERNAL_SERVER_ERROR.value()
        );
        errorResponse.setPath(resolvePath(request));
        return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler(TransactionSystemException.class)
    public ResponseEntity<ErrorResponse> handleTransactionSystemException(
        TransactionSystemException ex,
        WebRequest request,
        HttpServletRequest httpServletRequest
    ) {
        markRequestError(httpServletRequest, ex);
        log.error("Transaction error: {}", ex.getMessage());
        ErrorResponse errorResponse = new ErrorResponse(
            "TRANSACTION_ERROR",
            "A transaction error occurred",
            HttpStatus.INTERNAL_SERVER_ERROR.value()
        );
        errorResponse.setPath(resolvePath(request));
        return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler({
        ResourceNotFoundException.class,
        InvalidCredentialsException.class,
        AuthenticationException.class,
        AccessDeniedException.class,
        IllegalArgumentException.class,
        HttpMessageNotReadableException.class,
        RateLimitExceededException.class,
        Exception.class
    })
    public ResponseEntity<ErrorResponse> handleException(
        Exception ex,
        WebRequest request,
        HttpServletRequest httpServletRequest
    ) {
        markRequestError(httpServletRequest, ex);
        ErrorDescriptor descriptor = resolveErrorDescriptor(ex);

        // Log internal server errors with full stack trace
        if (descriptor.status() == HttpStatus.INTERNAL_SERVER_ERROR) {
            log.error("Unhandled exception at {}: {}", resolvePath(request), ex.getMessage(), ex);
        }

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
                "Invalid credentials provided"
            );
        }

        if (ex instanceof AuthenticationException) {
            return new ErrorDescriptor(
                "AUTHENTICATION_FAILED",
                HttpStatus.UNAUTHORIZED,
                "Authentication is required to access this resource"
            );
        }

        if (ex instanceof AccessDeniedException) {
            return new ErrorDescriptor(
                "ACCESS_DENIED",
                HttpStatus.FORBIDDEN,
                "You don't have permission to access this resource"
            );
        }

        if (ex instanceof RateLimitExceededException) {
            return new ErrorDescriptor(
                "RATE_LIMIT_EXCEEDED",
                HttpStatus.TOO_MANY_REQUESTS,
                firstNonBlank(ex.getMessage(), "Too many requests. Please try again later.")
            );
        }

        if (ex instanceof HttpMessageNotReadableException notReadableException) {
            Throwable root = notReadableException.getMostSpecificCause();
            return new ErrorDescriptor(
                "INVALID_REQUEST_BODY",
                HttpStatus.BAD_REQUEST,
                firstNonBlank(
                    root != null ? root.getMessage() : null,
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

        if (ex instanceof NoResourceFoundException || ex instanceof NoHandlerFoundException) {
            return new ErrorDescriptor(
                "ENDPOINT_NOT_FOUND",
                HttpStatus.NOT_FOUND,
                "The requested endpoint does not exist"
            );
        }

        String message = firstNonBlank(ex.getMessage(), "An unexpected error occurred");
        String normalized = message.toLowerCase();

        if (normalized.contains("not found")) {
            return new ErrorDescriptor("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND, message);
        }

        if (normalized.contains("forbidden")
            || normalized.contains("permission")
            || normalized.contains("does not belong")) {
            return new ErrorDescriptor("ACCESS_DENIED", HttpStatus.FORBIDDEN, message);
        }

        if (normalized.contains("invalid")
            || normalized.contains("cannot")
            || normalized.contains("required")
            || normalized.contains("malformed")
            || normalized.contains("not active")
            || normalized.contains("not assigned")) {
            return new ErrorDescriptor("BUSINESS_RULE_VIOLATION", HttpStatus.BAD_REQUEST, message);
        }

        if (normalized.contains("timeout") || normalized.contains("timed out")) {
            return new ErrorDescriptor("REQUEST_TIMEOUT", HttpStatus.REQUEST_TIMEOUT, message);
        }

        if (normalized.contains("too large") || normalized.contains("exceeds")) {
            return new ErrorDescriptor("PAYLOAD_TOO_LARGE", HttpStatus.valueOf(413), message);
        }

        return new ErrorDescriptor(
            "INTERNAL_SERVER_ERROR",
            HttpStatus.INTERNAL_SERVER_ERROR,
            "An unexpected error occurred. Please try again later."
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
