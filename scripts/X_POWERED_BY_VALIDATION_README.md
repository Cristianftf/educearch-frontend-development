# 🔒 Script de Validación - Supresión de X-Powered-By

Script bash para validar que las cabeceras "X-Powered-By" están suprimidas en frontend y backend, previniendo la divulgación de información del servidor.

---

## 📋 Requisitos

- `bash` shell
- `curl` instalado
- Servidor(es) ejecutándose

---

## 🚀 Uso

### Forma Básica

```bash
chmod +x scripts/validate-x-powered-by.sh
./scripts/validate-x-powered-by.sh
```

Usa valores por defecto:
- URL: `http://localhost:8080/api/health`

### Con URL Personalizada

```bash
# Backend específico
./scripts/validate-x-powered-by.sh https://api.uci.cu/health

# Frontend
./scripts/validate-x-powered-by.sh https://frontend.uci.cu/
```

---

## ✅ Validaciones Realizadas

### Backend (Spring Boot)
- ✅ Header `X-Powered-By` no presente en respuestas
- ✅ Verificado en endpoint `/api/health` (requiere IP whitelist)

### Frontend (Next.js)
- ✅ Header `X-Powered-By` no presente en respuestas
- ✅ Verificado en página principal

### Balanceadores de Carga
- 📋 Documentado para configuración manual:
  - **Nginx**: `proxy_hide_header X-Powered-By;`
  - **Apache**: `Header unset X-Powered-By`
  - **Otros**: Configurar según documentación

---

## 📊 Salida del Script

### Éxito
```
🔍 Validando supresión de X-Powered-By en: http://localhost:8080/api/health
==================================================

📡 Verificando Backend Spring Boot...
Verificando header 'X-Powered-By' en http://localhost:8080/api/health...
✅ PASÓ: Header 'X-Powered-By' no encontrado

🌐 Verificando Frontend Next.js...
Verificando header 'X-Powered-By' en http://localhost:3000/...
✅ PASÓ: Header 'X-Powered-By' no encontrado

📊 Resultado Final:
==================
✅ ÉXITO: X-Powered-By suprimido correctamente en todos los componentes
```

### Fallo
```
❌ FALLÓ: Header 'X-Powered-By' encontrado:
X-Powered-By: Express
```

---

## 🔧 Implementación Técnica

### Backend (Spring Boot)
```java
// SecurityHeadersFilter.java
httpResponse.setHeader("X-Powered-By", "");
```

### Frontend (Next.js)
```javascript
// next.config.mjs
{
  key: 'X-Powered-By',
  value: '',
}
```

### Balanceadores de Carga
Configurar según el servidor usado:

**Nginx** (nginx.conf):
```nginx
location / {
    proxy_pass http://backend;
    proxy_hide_header X-Powered-By;
}
```

**Apache** (.htaccess):
```apache
Header unset X-Powered-By
```

---

## 🎯 Propósito de Seguridad

La supresión del header `X-Powered-By`:
- ❌ **Previene fingerprinting** del servidor
- ✅ **Reduce superficie de ataque**
- ❌ **No revela tecnología** (Express, PHP, etc.)
- ✅ **Mejora hardening** general

---

## 📞 Soporte

Si el script falla:
1. Verificar que los servidores estén ejecutándose
2. Confirmar configuración en `SecurityHeadersFilter.java` y `next.config.mjs`
3. Para balanceadores: Aplicar configuración específica del servidor