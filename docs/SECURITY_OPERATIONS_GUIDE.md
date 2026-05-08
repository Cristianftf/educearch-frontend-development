# Guía de Administración de Seguridad - Mejores Prácticas

## 1. Manejo de Credenciales Sensibles

### ❌ NO Hacer

```properties
# application.properties - NUNCA hacer esto
spring.datasource.password=1234
ssl.keystore.password=misecretoptimo123
spring.data.redis.password=micontraseña
```

### ✅ Hacer

```bash
# 1. Variables de entorno
export DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id db-password --query SecretString --output text)
export SSL_KEYSTORE_PASSWORD=$(aws secretsmanager get-secret-value --secret-id ssl-password --query SecretString --output text)

# 2. Docker Secrets (Swarm)
docker secret create db_password - < /secure/location/db_password.txt

# 3. Kubernetes Secrets
kubectl create secret generic db-credentials --from-literal=password=$DB_PASSWORD

# 4. Vault (Hashicorp)
vault kv get secret/uci/database
```

### En application.properties

```properties
# CORRECTO - Sin credenciales sensibles
spring.datasource.url=${DATASOURCE_URL:jdbc:postgresql://localhost:5432/uci_competencia}
spring.datasource.username=${DATASOURCE_USER:postgres}
spring.datasource.password=${DATASOURCE_PASSWORD}
```

---

## 2. Rotación de IPs en Whitelist

### Procedimiento de Actualización Segura

```bash
#!/bin/bash
# scripts/update-ip-whitelist.sh

# Paso 1: Validar nueva IP
NEW_IP="10.0.2.5"
if ! ping -c 1 $NEW_IP > /dev/null; then
  echo "Error: IP $NEW_IP no responde"
  exit 1
fi

# Paso 2: Actualizar configuración en staging primero
cp application.properties application.properties.bak
sed -i "s/security.ip.whitelist=.*/security.ip.whitelist=$NEW_IP/" application.properties

# Paso 3: Verificar sintaxis
./mvnw spring-boot:run &
PID=$!
sleep 5
HEALTH=$(curl -s http://localhost:8080/api/health || echo "FAIL")
kill $PID

if [[ "$HEALTH" == "FAIL" ]]; then
  echo "Error: Aplicación falló después de cambio"
  cp application.properties.bak application.properties
  exit 1
fi

# Paso 4: Deploy a producción
echo "IP whitelist actualizada exitosamente"
```

### Rollback en Caso de Error

```bash
# Si algo falla, revertir inmediatamente
git diff application.properties  # Ver cambios
git checkout application.properties  # Revertir
# o
./scripts/rollback-security-config.sh
```

---

## 3. Auditoría de Accesos Denegados

### Monitorear Intentos de Acceso No Autorizado

```bash
# 1. Extraer IPs que accedieron a endpoints protegidos
grep "Access denied\|403 Forbidden" /var/log/backend/application.log | \
  cut -d' ' -f5 | sort | uniq -c | sort -rn | head -20

# 2. Configurar alertas
grep -E "Access denied|IP whitelist|CORS violation" /var/log/backend/application.log | \
  tail -1 | mail -s "⚠️ Security Alert" security@uci.cu
```

### Log Format Recomendado

```java
// SecurityHeadersFilter.java
if (!isIpAllowed(clientIp)) {
    log.warn("ACCESS_DENIED: IP={}, Endpoint={}, Timestamp={}", 
        clientIp, requestPath, System.currentTimeMillis());
    // Guardar en base de datos para auditoría
    auditService.logAccessDenied(clientIp, requestPath);
}
```

### Análisis Periódico

```bash
# Script para generar reporte semanal
#!/bin/bash
# scripts/security-audit-report.sh

WEEK_AGO=$(date -d '7 days ago' +%Y-%m-%d)

echo "=== REPORTE DE SEGURIDAD - ÚLTIMOS 7 DÍAS ==="
echo

echo "Intentos de acceso denegados por IP:"
grep "ACCESS_DENIED" /var/log/backend/application.log | \
  awk -v w="$WEEK_AGO" '$0 > w' | \
  cut -d' ' -f7 | sort | uniq -c | sort -rn

echo

echo "Endpoints más atacados:"
grep "ACCESS_DENIED" /var/log/backend/application.log | \
  awk -v w="$WEEK_AGO" '$0 > w' | \
  cut -d' ' -f9 | sort | uniq -c | sort -rn

echo

echo "Violaciones CORS:"
grep "CORS" /var/log/backend/application.log | \
  awk -v w="$WEEK_AGO" '$0 > w' | wc -l
```

---

## 4. Testing de Cambios de Seguridad

### Pre-Deployment Checklist

```bash
#!/bin/bash
# scripts/pre-deployment-security-check.sh

echo "🔒 Pre-Deployment Security Checklist"
echo

# 1. Verificar que no hay credenciales en código
echo -n "Buscando credenciales en código... "
if grep -r "password\|secret\|key" src/ | grep -v "\.class" | grep -v "maven"; then
  echo "❌ FAIL: Posibles credenciales encontradas"
  exit 1
else
  echo "✅ PASS"
fi

# 2. Verificar que IPs whitelist no están vacías
echo -n "Validando IP whitelist... "
if grep "^security.ip.whitelist=$" application.properties; then
  echo "❌ FAIL: IP whitelist vacío"
  exit 1
else
  echo "✅ PASS"
fi

# 3. Verificar que CORS no es '*'
echo -n "Validando CORS... "
if grep "security.cors.allowed-origins.*\*" application.properties; then
  echo "❌ FAIL: CORS permite '*'"
  exit 1
else
  echo "✅ PASS"
fi

# 4. Verificar SSL en prod
echo -n "Validando SSL... "
if grep -q "spring.profiles.active=prod" application.properties && \
   ! grep -q "ssl.enabled=true" application.properties; then
  echo "⚠️  WARNING: SSL no habilitado en prod"
else
  echo "✅ PASS"
fi

# 5. Ejecutar security tests
echo -n "Ejecutando security tests... "
if ./scripts/test-security-config.sh dev http://localhost:8080 | grep -q "FAIL"; then
  echo "❌ FAIL: Algunos tests fallaron"
  exit 1
else
  echo "✅ PASS"
fi

echo
echo "✅ Todos los checks pasaron. Listo para deploy."
```

### Post-Deployment Verification

```bash
#!/bin/bash
# scripts/verify-deployment.sh

BACKEND_URL="https://api.uci.cu"

echo "🔍 Post-Deployment Verification"
echo "Backend: $BACKEND_URL"
echo

# 1. Verificar CORS correcto
CORS_CHECK=$(curl -s -H "Origin: https://frontend.uci.cu" \
  -w "\n%{http_code}" "$BACKEND_URL/api/search" | tail -1)
if [[ $CORS_CHECK == "401" ]]; then
  echo "✅ CORS OK"
else
  echo "❌ CORS FAILED (HTTP $CORS_CHECK)"
fi

# 2. Verificar endpoints protegidos
SWAGGER_CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BACKEND_URL/swagger-ui/index.html")
if [[ $SWAGGER_CHECK == "403" ]]; then
  echo "✅ Swagger protegido"
else
  echo "❌ Swagger no protegido (HTTP $SWAGGER_CHECK)"
fi

# 3. Verificar SSL
SSL_CHECK=$(curl -s -I "$BACKEND_URL" | grep -i "strict-transport-security")
if [[ -n "$SSL_CHECK" ]]; then
  echo "✅ SSL/TLS habilitado"
else
  echo "❌ SSL/TLS no habilitado o mal configurado"
fi

echo
echo "📊 Deployment verification complete"
```

---

## 5. Monitoreo en Tiempo Real

### Configuración de Alertas (ELK Stack)

```json
{
  "trigger": {
    "schedule": {
      "interval": "5m"
    }
  },
  "input": {
    "search": {
      "request": {
        "indices": ["backend-logs-*"],
        "body": {
          "query": {
            "bool": {
              "must": [
                {
                  "match": {
                    "message": "ACCESS_DENIED"
                  }
                },
                {
                  "range": {
                    "timestamp": {
                      "gte": "now-5m"
                    }
                  }
                }
              ]
            }
          }
        }
      }
    }
  },
  "condition": {
    "compare": {
      "ctx.payload.hits.total": {
        "gt": 10
      }
    }
  },
  "actions": {
    "send_email": {
      "email": {
        "to": "security@uci.cu",
        "subject": "⚠️ Security Alert: Multiple Access Denials Detected",
        "body": "{{ctx.payload.hits.total}} access denials in last 5 minutes"
      }
    }
  }
}
```

### DataDog / New Relic Configuration

```yaml
# monitors.yml
- name: "Security - Access Denied Rate"
  type: "threshold"
  query: "max:custom.app.access_denied{*} by {ip}"
  alert_threshold: 5
  alert_window: "last_5m"
  notification: "security@uci.cu"
  
- name: "Security - CORS Violations"
  type: "threshold"
  query: "max:custom.app.cors_violations{*}"
  alert_threshold: 10
  alert_window: "last_1h"
  notification: "security@uci.cu"
```

---

## 6. Política de Actualización de Seguridad

### Ciclo de Revisión

```
Mensual:
├─ Revisar logs de access denied
├─ Analizar intentos de ataque
└─ Actualizar IP whitelist si es necesario

Trimestral:
├─ Auditar CORS configuration
├─ Revisar certificados SSL (fecha de expiración)
├─ Actualizar dependencias de seguridad
└─ Realizar security scan

Anual:
├─ Penetration testing
├─ Security audit completo
├─ Revisión de política de seguridad
└─ Capacitación de equipo
```

### Registro de Cambios

```bash
# scripts/log-security-change.sh
CHANGE_TYPE=$1  # "IP_WHITELIST", "CORS", "SSL", etc.
OLD_VALUE=$2
NEW_VALUE=$3

cat >> logs/security-changes.log << EOF
$(date +"%Y-%m-%d %H:%M:%S"): $CHANGE_TYPE
  Anterior: $OLD_VALUE
  Nuevo: $NEW_VALUE
  Usuario: $(whoami)
  Host: $(hostname)
EOF

# Enviar a Slack
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-type: application/json' \
  --data "{
    \"text\": \"🔐 Security Change: $CHANGE_TYPE\",
    \"attachments\": [{
      \"color\": \"warning\",
      \"fields\": [
        {\"title\": \"Type\", \"value\": \"$CHANGE_TYPE\", \"short\": true},
        {\"title\": \"User\", \"value\": \"$(whoami)\", \"short\": true},
        {\"title\": \"Old Value\", \"value\": \"$OLD_VALUE\", \"short\": false},
        {\"title\": \"New Value\", \"value\": \"$NEW_VALUE\", \"short\": false}
      ]
    }]
  }"
```

---

## 7. Recuperación ante Incidentes

### Escenario: IP Whitelist Bloqueó Administrador

```bash
#!/bin/bash
# scripts/emergency-unlock-admin.sh

# Desactivar IP whitelist temporalmente
sed -i 's/security.ip.whitelist=.*/security.ip.whitelist=/' application.properties

# Reiniciar aplicación
systemctl restart backend

# Notificar
mail -s "🚨 Emergency: IP Whitelist Disabled" ops@uci.cu

# Esperar instrucciones
# Luego restaurar
git checkout application.properties
systemctl restart backend
```

### Escenario: Ataque DDoS en Endpoint Específico

```bash
#!/bin/bash
# scripts/block-ddos-endpoint.sh

ENDPOINT=$1  # ej. /api/admin/users

# Añadir block en nginx
cat >> /etc/nginx/conf.d/security.conf << EOF
location ${ENDPOINT} {
    return 429 "Rate limit exceeded";
}
EOF

nginx -s reload

# Notificar
mail -s "🚨 DDoS Attack Detected" security@uci.cu << EOF
Endpoint bloqueado: $ENDPOINT
Timestamp: $(date)
Acciones: Revisar logs y determinar origen
EOF
```

---

## 8. Documentación y Cambios

### Template para cambios de seguridad

```markdown
## Cambio de Seguridad: [Título]

**Fecha**: YYYY-MM-DD
**Autor**: Nombre
**Tipo**: CORS / IP / SSL / Auth / Otro

### Descripción
Qué cambió y por qué.

### Impacto
- Usuarios afectados
- Endpoints afectados
- Riesgo de regresión

### Testing
- [x] Tests unitarios pasados
- [x] Security tests ejecutados
- [x] Staging verificado

### Rollback
Pasos para revertir en caso de error.

### Aprobación
- [ ] Lead de seguridad
- [ ] DevOps lead
- [ ] Product owner
```

---

## 9. Matriz de Responsabilidades

| Rol | Responsabilidad |
|-----|-----------------|
| **Arquitecto de Seguridad** | Diseñar políticas, revisar cambios |
| **DevOps Engineer** | Implementar configuración, monitoreo |
| **Backend Lead** | Revisar código de seguridad |
| **Operations** | Monitorear alertas, responder incidentes |
| **Desarrolladores** | Implementar cambios, testing local |

---

## 10. Contactos de Emergencia

```
🚨 INCIDENTE DE SEGURIDAD CRÍTICO

Escalación inmediata:
- CTO: cto@uci.cu (24/7)
- Security Lead: security-lead@uci.cu
- DevOps On Call: devops-oncall@uci.cu

Contacto externo:
- Proveedor hosting: support@host.com
- Consultor seguridad: security-consultant@firm.com
```

---

## Documento de Referencia Rápida

Guardar como: `SECURITY_OPS_CHEATSHEET.md`

```bash
# CORS Issue?
grep "CORS\|403" /var/log/backend/application.log | tail -20

# IP Whitelist Issue?
systemctl stop backend
grep "security.ip.whitelist" application.properties

# SSL Issue?
openssl s_client -connect api.uci.cu:443 -showcerts

# Check Backend Health
curl -v http://localhost:8080/api/health

# Emergency Restart
systemctl restart backend

# Emergency Unlock (temporal)
sed -i 's/security.ip.whitelist=.*/security.ip.whitelist=/' application.properties
systemctl restart backend
```

---

**Última actualización**: 6 de mayo de 2026
**Versión**: 1.0
**Mantenedor**: Equipo de Seguridad
