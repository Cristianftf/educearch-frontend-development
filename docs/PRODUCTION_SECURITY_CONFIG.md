# Configuración de Seguridad para Producción

Este archivo proporciona ejemplos de configuración para ambiente de producción.

## 1. Variables de Entorno Recomendadas

```bash
# Production Environment Variables
export SPRING_PROFILES_ACTIVE=prod
export SERVER_PORT=8080

# CORS Configuration
export SECURITY_CORS_ALLOWED_ORIGINS_0=https://frontend.uci.cu
export SECURITY_CORS_ALLOWED_ORIGINS_1=https://www.frontend.uci.cu

# IP Whitelist - IMPORTANTE: Actualizar con IPs reales
# Ejemplo para infraestructura típica:
export SECURITY_IP_WHITELIST=10.0.0.1,10.0.0.2,10.0.1.1

# SSL/TLS
export SSL_KEYSTORE_PATH=/etc/ssl/certs/keystore.p12
export SSL_KEYSTORE_PASSWORD=tu-password-seguro-aqui

# Database
export SPRING_DATASOURCE_URL=jdbc:postgresql://db-server:5432/uci_competencia
export SPRING_DATASOURCE_USERNAME=db-user
export SPRING_DATASOURCE_PASSWORD=db-password-seguro

# Redis
export SPRING_DATA_REDIS_HOST=redis-server
export SPRING_DATA_REDIS_PORT=6379
export SPRING_DATA_REDIS_PASSWORD=redis-password
```

## 2. Aplicar Configuración en Producción

### Docker Compose

```yaml
version: '3.8'
services:
  backend:
    image: uci-backend:latest
    ports:
      - "8443:8443"  # HTTPS
    environment:
      - SPRING_PROFILES_ACTIVE=prod
      - SECURITY_CORS_ALLOWED_ORIGINS_0=https://frontend.uci.cu
      - SECURITY_IP_WHITELIST=10.0.0.1,10.0.0.2,10.0.1.1
      - SSL_KEYSTORE_PATH=/app/config/keystore.p12
      - SSL_KEYSTORE_PASSWORD=${SSL_KEYSTORE_PASSWORD}
    volumes:
      - /etc/ssl/certs/keystore.p12:/app/config/keystore.p12:ro
    networks:
      - backend-network

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: uci_competencia
      POSTGRES_USER: db-user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - backend-network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    networks:
      - backend-network

networks:
  backend-network:
    driver: bridge

volumes:
  postgres-data:
```

### Kubernetes

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: uci-backend-config
data:
  application-prod.properties: |
    spring.profiles.active=prod
    security.cors.allowed-origins[0]=https://frontend.uci.cu
    security.ip.whitelist=10.0.0.1,10.0.0.2,10.0.1.1

---
apiVersion: v1
kind: Secret
metadata:
  name: uci-backend-secrets
type: Opaque
stringData:
  SPRING_DATASOURCE_PASSWORD: ${DB_PASSWORD}
  SSL_KEYSTORE_PASSWORD: ${SSL_PASSWORD}
  SPRING_DATA_REDIS_PASSWORD: ${REDIS_PASSWORD}

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: uci-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: uci-backend
  template:
    metadata:
      labels:
        app: uci-backend
    spec:
      containers:
      - name: backend
        image: uci-backend:latest
        ports:
        - containerPort: 8443
          name: https
        env:
        - name: SPRING_PROFILES_ACTIVE
          value: "prod"
        - name: SECURITY_CORS_ALLOWED_ORIGINS_0
          value: "https://frontend.uci.cu"
        - name: SECURITY_IP_WHITELIST
          valueFrom:
            configMapKeyRef:
              name: uci-backend-config
              key: ip-whitelist
        envFrom:
        - secretRef:
            name: uci-backend-secrets
        volumeMounts:
        - name: ssl-certs
          mountPath: /app/config/ssl
          readOnly: true
        livenessProbe:
          httpGet:
            path: /api/health
            port: 8443
            scheme: HTTPS
          initialDelaySeconds: 30
          periodSeconds: 10
      volumes:
      - name: ssl-certs
        secret:
          secretName: backend-ssl-cert
```

## 3. Validar Configuración en Producción

### Test 1: Verificar CORS

```bash
# Desde dominio permitido (debería funcionar)
curl -i -H "Origin: https://frontend.uci.cu" \
  -H "Access-Control-Request-Method: GET" \
  https://api.uci.cu/api/search

# Respuesta esperada:
# HTTP/2 200
# Access-Control-Allow-Origin: https://frontend.uci.cu

# Desde dominio NO permitido (debería rechazarse)
curl -i -H "Origin: https://attacker.com" \
  https://api.uci.cu/api/search

# Respuesta: 403 o sin cabecera CORS
```

### Test 2: Verificar IP Whitelist

```bash
# Verificar acceso a Swagger desde zona permitida
# (debería funcionar con token ADMIN)
curl -i -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-internal.uci.cu/swagger-ui/index.html

# Verificar rechazo desde zona externa
# (debería rechazarse con 403)
curl -i -H "Authorization: Bearer $TOKEN" \
  https://api-external.uci.cu/swagger-ui/index.html
```

### Test 3: Verificar SSL/TLS

```bash
# Verificar certificado SSL
openssl s_client -connect api.uci.cu:443

# Verificar que solo HTTPS funciona
# HTTP debería ser rechazado o redirigido
curl -i http://api.uci.cu/api/health
```

## 4. Nginx Reverse Proxy - Configuración Recomendada

```nginx
upstream backend {
    server backend-1:8443;
    server backend-2:8443;
    server backend-3:8443;
}

# Redirigir HTTP a HTTPS
server {
    listen 80;
    server_name api.uci.cu;
    return 301 https://$server_name$request_uri;
}

# HTTPS con restricciones de seguridad
server {
    listen 443 ssl http2;
    server_name api.uci.cu;

    # SSL/TLS Configuration
    ssl_certificate /etc/ssl/certs/api.uci.cu.crt;
    ssl_certificate_key /etc/ssl/private/api.uci.cu.key;
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;

    # Proxy to backend
    location / {
        proxy_pass https://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Bloquear endpoints sensibles desde Internet público
    location ~ ^/(swagger-ui|v3/api-docs|actuator|api/admin/metrics) {
        # Permitir solo desde red interna (ej. 10.0.0.0/8)
        allow 10.0.0.0/8;
        deny all;
    }
}
```

## 5. Monitoreo y Alertas

### Monitorear Violaciones de CORS

```bash
# Script para verificar logs de violaciones
grep -E "CORS|403|Forbidden" /var/log/backend/application.log | \
  tail -100

# Alertar si hay más de 10 violaciones en 5 minutos
watch -n 300 'grep -c "CORS|403" /var/log/backend/application.log'
```

### Prometheus Metrics

```yaml
# Añadir a application-prod.properties
management.endpoints.web.exposure.include=health,metrics,prometheus
management.metrics.enable.jvm=true
management.metrics.enable.process=true

# Scrape config en Prometheus
scrape_configs:
  - job_name: 'backend'
    static_configs:
      - targets: ['api-internal.uci.cu:8443']
    metrics_path: '/actuator/prometheus'
    scheme: 'https'
    bearer_token: ${PROMETHEUS_TOKEN}
```

## 6. Checklist de Despliegue

- [ ] Certificado SSL/TLS válido instalado
- [ ] Variables de entorno configuradas correctamente
- [ ] IP Whitelist actualizada con IPs reales
- [ ] CORS limitado a dominios permitidos solamente
- [ ] Swagger UI deshabilitado (`springdoc.swagger-ui.enabled=false`)
- [ ] API Docs deshabilitado (`springdoc.api-docs.enabled=false`)
- [ ] Logging en WARN level (no DEBUG)
- [ ] Database con credenciales seguras
- [ ] Redis con contraseña habilitada
- [ ] Nginx configurado con security headers
- [ ] Rate limiting activado
- [ ] Backup database configurado
- [ ] Monitoreo y alertas activados
- [ ] Acceso SSH solo con key-based auth
- [ ] Firewall configurado permitiendo solo puertos necesarios

## 7. Incidentes de Seguridad

### Si notas intentos de acceso desde IPs no autorizadas:

```bash
# 1. Revisar logs
tail -f /var/log/backend/application.log | grep "Access denied"

# 2. Identificar IP atacante
grep "Access denied" /var/log/backend/application.log | \
  cut -d' ' -f8 | sort | uniq -c | sort -rn

# 3. Bloquear en firewall
ufw deny from 203.0.113.45

# 4. Actualizar logs en SIEM
# (Si tienes Splunk, ELK, etc.)
```

### Si notas violaciones CORS:

```bash
# 1. Verificar origen atacante
grep "CORS" /var/log/backend/application.log | \
  grep -oP 'Origin: \K[^;]+' | sort | uniq -c

# 2. Analizar si es legitimó
# Si es legítimo: Añadir a allowed-origins
# Si es ataque: Monitoriear e ignorar

# 3. Alertar a equipo de seguridad
```

---

**Importante**: Guardar todas las contraseñas en un gestor de secretos (Vault, AWS Secrets Manager, etc.), no en variables de entorno en texto plano.
