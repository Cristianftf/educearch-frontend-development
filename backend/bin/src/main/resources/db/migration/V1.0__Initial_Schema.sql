-- V1.0__Initial_Schema.sql
-- Initial database schema creation for UCI Competencia Informacional

-- Create USERS table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    role VARCHAR(50) NOT NULL,
    faculty VARCHAR(255),
    department VARCHAR(255),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    last_login TIMESTAMP,
    dtype VARCHAR(31)
);

-- Create STUDENTS table
CREATE TABLE IF NOT EXISTS students (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    student_id VARCHAR(255) UNIQUE,
    year_of_study INTEGER,
    program VARCHAR(255)
);

-- Create PROFESSORS table
CREATE TABLE IF NOT EXISTS professors (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    professor_id VARCHAR(255) UNIQUE,
    academic_title VARCHAR(255),
    research_area VARCHAR(255)
);

-- Create ADMINISTRATORS table
CREATE TABLE IF NOT EXISTS administrators (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    admin_level VARCHAR(255),
    managed_faculties VARCHAR(255),
    can_impersonate BOOLEAN DEFAULT false,
    can_audit BOOLEAN DEFAULT false
);

-- Create PROFESSOR_EXPERTISE table
CREATE TABLE IF NOT EXISTS professor_expertise (
    professor_id UUID NOT NULL REFERENCES professors(user_id),
    expertise_areas VARCHAR(255) NOT NULL
);

-- Create COMPETENCY_PROGRESS table
CREATE TABLE IF NOT EXISTS competency_progress (
    id UUID PRIMARY KEY,
    student_id UUID UNIQUE REFERENCES students(user_id),
    access_score DOUBLE PRECISION,
    total_searches INTEGER DEFAULT 0,
    successful_searches INTEGER DEFAULT 0,
    avg_search_time DOUBLE PRECISION,
    mesh_terms_mastered INTEGER DEFAULT 0,
    processing_score DOUBLE PRECISION,
    total_verifications INTEGER DEFAULT 0,
    correct_verifications INTEGER DEFAULT 0,
    avg_verification_confidence DOUBLE PRECISION,
    strongest_area VARCHAR(255),
    communication_score DOUBLE PRECISION,
    bibliographies_generated INTEGER DEFAULT 0,
    citation_accuracy DOUBLE PRECISION,
    peer_reviews_completed INTEGER DEFAULT 0,
    last_updated TIMESTAMP
);

-- Create SEARCH_SESSIONS table
CREATE TABLE IF NOT EXISTS search_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    original_query TEXT NOT NULL,
    transformed_query TEXT,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    results_count INTEGER,
    search_engine VARCHAR(50),
    filters_applied TEXT,
    is_practice BOOLEAN DEFAULT false,
    efficiency_score DOUBLE PRECISION,
    feedback TEXT
);

-- Create SEARCH_RESULTS table
CREATE TABLE IF NOT EXISTS search_results (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES search_sessions(id),
    pmid VARCHAR(255) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    abstract_text TEXT,
    authors TEXT,
    journal VARCHAR(255),
    publication_date DATE,
    study_type VARCHAR(50),
    evidence_level INTEGER,
    relevance_score DOUBLE PRECISION,
    has_full_text BOOLEAN,
    full_text_url VARCHAR(500),
    metadata TEXT
);

-- Create RESULT_MESH_TERMS table
CREATE TABLE IF NOT EXISTS result_mesh_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_result_id UUID REFERENCES search_results(id),
    mesh_terms VARCHAR(255)
);

-- Create VERIFICATION_RESULTS table
CREATE TABLE IF NOT EXISTS verification_results (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    claim_text TEXT NOT NULL,
    source_url VARCHAR(500),
    submitted_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    overall_score DOUBLE PRECISION,
    verdict VARCHAR(50),
    status VARCHAR(50),
    confidence DOUBLE PRECISION,
    evidence_count INTEGER,
    supporting_evidence TEXT,
    conflicting_evidence TEXT,
    gen_text TEXT,
    explanations TEXT,
    recommendations TEXT,
    is_learning_example BOOLEAN DEFAULT false,
    session_context UUID REFERENCES search_sessions(id)
);

-- Create CASE_STUDIES table
CREATE TABLE IF NOT EXISTS case_studies (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    scenario TEXT NOT NULL,
    difficulty VARCHAR(50),
    professor_id UUID REFERENCES professors(user_id),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    due_date TIMESTAMP,
    rubric TEXT,
    is_active BOOLEAN DEFAULT true,
    tags VARCHAR(500)
);

-- Create CASE_REQUIRED_ARTICLES table
CREATE TABLE IF NOT EXISTS case_required_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES case_studies(id),
    required_pmids VARCHAR(255)
);

-- Create CASE_OPTIONAL_ARTICLES table
CREATE TABLE IF NOT EXISTS case_optional_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES case_studies(id),
    optional_pmids VARCHAR(255)
);

-- Create CASE_GUIDING_QUESTIONS table
CREATE TABLE IF NOT EXISTS case_guiding_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES case_studies(id),
    question VARCHAR(1000)
);

-- Create CASE_SUBMISSIONS table
CREATE TABLE IF NOT EXISTS case_submissions (
    id UUID PRIMARY KEY,
    case_id UUID REFERENCES case_studies(id),
    student_id UUID REFERENCES students(user_id),
    submitted_at TIMESTAMP NOT NULL,
    graded_at TIMESTAMP,
    answers TEXT,
    search_queries TEXT,
    verification_results TEXT,
    bibliography TEXT,
    auto_score DOUBLE PRECISION,
    professor_score DOUBLE PRECISION,
    professor_feedback TEXT,
    feedback_attachments TEXT,
    status VARCHAR(50) DEFAULT 'DRAFT'
);

-- Create SYSTEM_LOGS table
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    level VARCHAR(50),
    user_id VARCHAR(255),
    user_role VARCHAR(50),
    ip_address VARCHAR(255),
    user_agent TEXT,
    action VARCHAR(50),
    endpoint VARCHAR(500),
    request_details TEXT,
    response_details TEXT,
    response_time BIGINT,
    response_status INTEGER,
    error_message VARCHAR(1000),
    stack_trace TEXT,
    session_id VARCHAR(255),
    correlation_id VARCHAR(255)
);

-- Create indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_faculty ON users(faculty);
CREATE INDEX idx_competency_student_id ON competency_progress(student_id);
CREATE INDEX idx_search_sessions_user_id ON search_sessions(user_id);
CREATE INDEX idx_search_sessions_started_at ON search_sessions(started_at);
CREATE INDEX idx_search_results_pmid ON search_results(pmid);
CREATE INDEX idx_verification_user_id ON verification_results(user_id);
CREATE INDEX idx_verification_status ON verification_results(status);
CREATE INDEX idx_case_studies_professor_id ON case_studies(professor_id);
CREATE INDEX idx_case_submissions_case_id ON case_submissions(case_id);
CREATE INDEX idx_case_submissions_student_id ON case_submissions(student_id);
CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp);
CREATE INDEX idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX idx_system_logs_action ON system_logs(action);
