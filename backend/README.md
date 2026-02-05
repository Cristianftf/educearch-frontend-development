# UCI Competencia Informacional - Backend Spring Boot

## 📚 Descripción General

Backend de la Plataforma de Competencia Informacional para la Universidad de Ciencias Informáticas (UCI), basado en Spring Boot 4.0.2 con Java 21.

Esta es una API REST completa que soporta:
- Autenticación y autorización basada en roles
- Búsqueda de artículos científicos en PubMed
- Verificación de claims usando Retrieval Augmented Generation (RAG)
- Gestión de casos de estudio y evaluaciones
- Seguimiento de progreso en competencias informacionales
- Auditoría completa del sistema

## 🏗️ Estructura del Proyecto

```
backend/
├── src/
│   ├── main/
│   │   ├── java/com/uci/competencia/
│   │   │   ├── CompetenciaInformacionalApplication.java
│   │   │   ├── config/           # Configuraciones
│   │   │   ├── controller/api/   # Controladores REST
│   │   │   ├── service/          # Servicios de negocio
│   │   │   ├── repository/       # Repositorios JPA
│   │   │   ├── model/            # Entidades y DTOs
│   │   │   ├── security/         # JWT y seguridad
│   │   │   ├── exception/        # Manejo de excepciones
│   │   │   ├── aspect/           # Aspectos AOP
│   │   │   ├── scheduler/        # Tareas programadas
│   │   │   └── util/             # Utilidades
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/    # Flyway migrations
│   └── test/                     # Tests unitarios e integración
├── pom.xml                        # Dependencias Maven
└── README.md                      # Este archivo
```

## 🚀 Requisitos Previos

- **Java 21** LTS
- **Maven 3.8.0+**
- **PostgreSQL 13+**
- **Redis 7.0+**
- **Docker** (opcional, para desarrollo con containers)

## 📦 Instalación

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd educearch-frontend-development/backend
```

### 2. Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```bash
# Base de Datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=uci_competencia
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=mySecretKeyThatIsAtLeast32CharactersLongForSigningTokens
JWT_EXPIRATION=86400000
JWT_REFRESH_EXPIRATION=604800000

# PubMed API
PUBMED_API_KEY=<your-api-key>

# Servidor
SERVER_PORT=8080

# LDAP (opcional)
LDAP_ENABLED=false
LDAP_URL=ldap://ldap.uci.cu:389
LDAP_BASE_DN=dc=uci,dc=cu
```

### 3. Compilar el Proyecto

```bash
mvn clean install
```

### 4. Ejecutar la Aplicación

```bash
mvn spring-boot:run
```

O usando Java directamente:

```bash
java -jar target/backend-1.0.0.jar
```

## 🗄️ Base de Datos

El proyecto usa **Flyway** para migraciones automáticas de base de datos.

### Crear base de datos PostgreSQL

```bash
createdb uci_competencia -U postgres
```

Las migraciones se ejecutarán automáticamente al iniciar la aplicación:
- `V1.0__Initial_Schema.sql` - Schema inicial con todas las tablas

## 🔑 Autenticación

### Login

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@uci.cu","password":"Password123!"}'
```

**Respuesta:**
```json
{
  "token": "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...",
  "userId": "uuid",
  "username": "user@uci.cu",
  "firstName": "John",
  "lastName": "Doe",
  "role": "STUDENT"
}
```

### Usar Token en Requests

```bash
curl -X GET http://localhost:8080/api/student/dashboard/overview \
  -H "Authorization: Bearer <token>"
```

## 📡 Endpoints Principales

### Autenticación (`/api/auth`)
- `POST /login` - Iniciar sesión
- `POST /refresh` - Refrescar token
- `POST /logout` - Cerrar sesión
- `GET /me` - Información del usuario actual

### Búsqueda (`/api/search`)
- `POST /execute` - Ejecutar búsqueda en PubMed
- `GET /mesh/suggestions` - Obtener sugerencias de términos MeSH
- `GET /results/{searchId}/evidence-pyramid` - Obtener pirámide de evidencia

### Verificación (`/api/verify`)
- `POST /claim` - Verificar un claim con RAG
- `GET /result/{verificationId}` - Obtener resultado de verificación
- `GET /history` - Historial de verificaciones

### Estudiante (`/api/student`)
- `GET /dashboard/overview` - Dashboard del estudiante
- `GET /progress/detailed` - Progreso detallado
- `GET /search/history` - Historial de búsquedas

### Profesor (`/api/professor`)
- `GET /dashboard/overview` - Dashboard del profesor
- `GET /students` - Lista de estudiantes
- `GET /cases` - Casos de estudio
- `POST /cases` - Crear nuevo caso
- `GET /analytics/class-performance` - Análisis de desempeño

### Administrador (`/api/admin`)
- `GET /users` - Lista de usuarios
- `POST /users/batch` - Importar usuarios en lote
- `GET /audit/logs` - Registros de auditoría
- `GET /system/health` - Estado del sistema
- `GET /settings` - Configuración del sistema

### Sistema (`/api/system`)
- `GET /health` - Health check del sistema
- `GET /metrics/prometheus` - Métricas para Prometheus

## 🔍 Documentación API

Swagger/OpenAPI disponible en:
```
http://localhost:8080/swagger-ui.html
```

O ver JSON de OpenAPI:
```
http://localhost:8080/v3/api-docs
```

## 🏥 Monitoreo

### Health Check

```bash
curl http://localhost:8080/api/system/health
```

### Actuator Endpoints

```bash
curl http://localhost:8080/actuator/health
curl http://localhost:8080/actuator/metrics
```

### Prometheus Metrics

```bash
curl http://localhost:8080/api/system/metrics/prometheus
```

## 🧪 Testing

Ejecutar tests:

```bash
mvn test
```

Con cobertura:

```bash
mvn test jacoco:report
```

## 🐳 Docker

### Build Docker Image

```bash
docker build -t uci-competencia-backend:latest .
```

### Ejecutar con Docker Compose

```bash
docker-compose up -d
```

Ver logs:

```bash
docker-compose logs -f backend
```

Detener:

```bash
docker-compose down
```

## 🛠️ Desarrollo

### Hot Reload

El proyecto tiene `spring-boot-devtools` habilitado para desarrollo con hot reload:

```bash
mvn spring-boot:run
```

### Estructura de Paquetes

```
com.uci.competencia
├── config/              # Configuraciones de Spring
├── controller/api/      # Controladores REST
├── service/             # Interfaces de servicios
│   ├── impl/           # Implementaciones
│   └── external/       # Servicios externos
├── repository/          # Repositorios JPA
├── model/
│   ├── entity/         # Entidades JPA
│   ├── dto/            # Data Transfer Objects
│   └── enums/          # Enumeraciones
├── security/            # JWT, autenticación
├── exception/           # Excepciones personalizadas
├── aspect/              # Aspectos AOP (logging, auditoría)
├── scheduler/           # Tareas programadas
└── util/                # Utilidades
```

## 📋 Características Implementadas

### ✅ Completado

- [x] Estructura Spring Boot completa
- [x] Autenticación con JWT
- [x] Role-Based Access Control (RBAC)
- [x] Entidades y repositorios
- [x] Servicios base
- [x] Controladores REST
- [x] Configuración de seguridad
- [x] Configuración de CORS
- [x] Redis para caché
- [x] WebSocket para comunicación en tiempo real
- [x] Manejo centralizado de excepciones
- [x] Logging y auditoría
- [x] Migrations de base de datos con Flyway
- [x] OpenAPI/Swagger
- [x] Health checks
- [x] Prometheus metrics

### 🔄 En Desarrollo

- [ ] Integración completa con PubMed API
- [ ] Implementación del motor RAG
- [ ] Integración con LDAP de UCI
- [ ] Envío de emails
- [ ] Vector database (Weaviate) para embeddings
- [ ] Cálculos complejos de competencias

### 📅 Próximas Fases

- [ ] Tests unitarios e integración
- [ ] Performance tuning
- [ ] Caching estratégico
- [ ] Documentación avanzada
- [ ] Deployment en producción

## 🤝 Contribuir

1. Crear una rama feature: `git checkout -b feature/nueva-funcionalidad`
2. Hacer cambios y commits: `git commit -am 'Agregar nueva funcionalidad'`
3. Push a la rama: `git push origin feature/nueva-funcionalidad`
4. Abrir Pull Request

## 📝 Convenciones de Código

- **Nombres de clases:** PascalCase (ej: `UserService`)
- **Nombres de métodos:** camelCase (ej: `getUserById()`)
- **Nombres de variables:** camelCase (ej: `userId`)
- **Constantes:** UPPER_SNAKE_CASE (ej: `MAX_USERS`)

## 🔐 Seguridad

- Todas las contraseñas se hashean con BCrypt
- JWT tokens con expiración configurable
- CORS configurado para dominios específicos
- Validación de entrada en DTOs
- Manejo de excepciones seguro
- Auditoría completa de acciones

## 📊 Logging

Los logs se guardan en:
```
logs/application.log
```

Niveles configurables por paquete en `application.yml`

## 🚨 Troubleshooting

### Error de conexión a PostgreSQL
```
Verificar que PostgreSQL está ejecutándose
psql -U postgres -c "SELECT 1"
```

### Error de conexión a Redis
```
Verificar que Redis está ejecutándose
redis-cli ping
```

### Error de compilación Java
```
Limpiar Maven cache:
mvn clean install -DskipTests
```

## 📞 Soporte

Para reportar bugs o sugerencias, contactar al equipo de desarrollo.

## 📄 Licencia

Este proyecto es propiedad de la Universidad de Ciencias Informáticas (UCI).

---

**Última actualización:** Enero 2026
**Versión:** 1.0.0
**Estado:** EN DESARROLLO
