# ============================================================
# Dockerfile - EDUCEARCH Backend (Spring Boot)
# ============================================================
# Multi-stage build para producción:
#   1. Build - Compila el JAR
#   2. Production - Imagen final optimizada
# ============================================================

# ---- Stage 1: Build ----
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /build

# Copiar archivos de Maven
COPY mvnw pom.xml ./
COPY .mvn .mvn/
COPY wrapper wrapper/

# Descargar dependencias (cache layer)
RUN ./mvnw dependency:go-offline -B || true

# Copiar código fuente
COPY src src/

# Compilar y empaquetar
RUN ./mvnw package -DskipTests -B -q

# ---- Stage 2: Production ----
FROM eclipse-temurin:21-jre-alpine AS runner
WORKDIR /app

# Crear usuario no-root para seguridad
RUN addgroup -S -g 1001 appgroup && \
    adduser -S -u 1001 -G appgroup appuser

# Copiar JAR desde stage anterior
COPY --from=builder /build/target/*.jar app.jar

# Configurar permisos
RUN chown -R appuser:appgroup /app

# Usar usuario no-root
USER appuser

# Variables de entorno
ENV SPRING_PROFILES_ACTIVE=prod

# Exponer puerto
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Iniciar aplicación
ENTRYPOINT ["java", \
    "-Djava.security.egd=file:/dev/./urandom", \
    "-XX:+UseContainerSupport", \
    "-XX:MaxRAMPercentage=75.0", \
    "-jar", \
    "app.jar"]