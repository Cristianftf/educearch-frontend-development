// ============ TIPOS BASE ============

export type UserRole = 'student' | 'professor' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar?: string
  createdAt: string
  lastLogin?: string
  isActive: boolean
}

export interface StudentSummary {
  id: string
  name: string
  email: string
  avatar?: string
  averageScore?: number
}

// ============ COMPETENCIAS (ESTUDIANTE) ============

export type CompetencyType = 'access' | 'process' | 'communicate'

export interface CompetencyProgress {
  type: CompetencyType
  score: number
  level: 'novice' | 'intermediate' | 'advanced'
  lastUpdated: string
}

export interface StudentProgress {
  userId: string
  competencies: Record<CompetencyType, CompetencyProgress>
  totalSearches: number
  totalVerifications: number
  totalBibliographies: number
  recentActivities: Activity[]
}

// ============ ACTIVIDADES ============

export interface Activity {
  id: string
  type: 'search' | 'verification' | 'export' | 'case_submission' | 'login'
  description: string
  timestamp: string
  metadata?: Record<string, unknown>
}

// ============ BÚSQUEDA ============

export interface MeshTerm {
  id: string
  term: string
  description?: string
  synonyms?: string[]
}

export interface SearchQuery {
  id: string
  terms: MeshTerm[]
  operators: ('AND' | 'OR' | 'NOT')[]
  filters: SearchFilters
  rawQuery: string
  createdAt: string
  resultCount?: number
  isFavorite?: boolean
}

export interface SearchFilters {
  yearRange?: [number, number]
  studyTypes?: string[]
  minSampleSize?: number
  languages?: string[]
}

export interface SearchResult {
  id: string
  pmid: string
  title: string
  authors: string[]
  journal: string
  year: number
  abstract: string
  studyType: string
  evidenceLevel: number
  sampleSize?: number
  hasConflictOfInterest: boolean
  doi?: string
}

export interface SearchSession {
  id: string
  query: SearchQuery
  results: SearchResult[]
  totalResults: number
  executedAt: string
}

// ============ VERIFICACIÓN ============

export type VerificationStatus = 'verified' | 'conflicting' | 'misinformation' | 'pending'

export interface VerificationResult {
  id: string
  claim: string
  status: VerificationStatus
  score: number
  supportingEvidence: EvidenceItem[]
  contradictingEvidence: EvidenceItem[]
  explanation: string
  recommendations: string[]
  verifiedAt: string
}

export interface EvidenceItem {
  articleId: string
  title: string
  snippet: string
  supports: boolean
  relevanceScore: number
}

// ============ BIBLIOGRAFÍA ============

export type BibliographyFormat = 'apa' | 'vancouver' | 'bibtex' | 'xml'

export interface Bibliography {
  id: string
  name: string
  articles: SearchResult[]
  format: BibliographyFormat
  content: string
  createdAt: string
  articleCount?: number
}

// ============ CASOS DE ESTUDIO (PROFESOR) ============

export type CaseStatus = 'draft' | 'active' | 'archived'
export type CaseDifficulty = 'novice' | 'intermediate' | 'advanced'

export interface CaseStudy {
  id: string
  title: string
  scenario: string
  difficulty: CaseDifficulty
  status: CaseStatus
  requiredArticles: string[]
  optionalArticles: string[]
  guidingQuestions: GuidingQuestion[]
  rubric: RubricItem[]
  createdBy: string
  createdAt: string
  startDate?: string
  dueDate?: string
  assignedStudents: string[]
}

export interface GuidingQuestion {
  id: string
  question: string
  competency: CompetencyType
  points: number
}

export interface RubricItem {
  id: string
  criteria: string
  competency: CompetencyType
  maxPoints: number
  levels: {
    excellent: string
    good: string
    needs_improvement: string
  }
}

export interface CaseSubmission {
  id: string
  caseId: string
  studentId: string
  submittedAt: string
  content: string
  selectedArticles: string[]
  bibliography: string
  status: 'pending' | 'reviewed' | 'returned'
  evaluation?: Evaluation
}

export interface Evaluation {
  id: string
  submissionId: string
  professorId: string
  scores: Record<CompetencyType, number>
  comments: Record<CompetencyType, string>
  overallScore: number
  feedback: string
  evaluatedAt: string
}

// ============ SEARCH HEDGES (PROFESOR) ============

export interface SearchHedge {
  id: string
  name: string
  category: string
  query: string
  description: string
  estimatedResults: number
  precision?: number
  recall?: number
  createdBy: string
  createdAt: string
}

// ============ ADMINISTRACIÓN ============

export interface SystemHealth {
  cpu: number
  memory: number
  dbConnections: number
  cacheHitRatio: number
  apiLatency: {
    p50: number
    p95: number
    p99: number
  }
  activeUsers: number
  requestsPerMinute: number
}

export interface AuditLog {
  id: string
  timestamp: string
  user: string
  userId?: string
  userEmail?: string
  action: string
  details: string
  resource?: string
  ip: string
  userAgent: string
  level: 'INFO' | 'WARN' | 'ERROR'
}

export interface AdminSystemConfiguration {
  pubmed?: {
    apiKey?: string
    baseUrl?: string
    enabled?: boolean
    cacheEnabled?: boolean
    cacheTTL?: number
    rateLimitPerDay?: number
  }
  rag?: {
    enabled?: boolean
    modelProvider?: string
    temperature?: number
    topP?: number
    maxTokens?: number
    embeddingModel?: string
    contextWindow?: number
  }
  pedagogical?: {
    competencyFramework?: string
    badgesEnabled?: boolean
    alertsEnabled?: boolean
    recommendationsEnabled?: boolean
    hedgesEnabled?: boolean
    competencyThresholds?: Record<CompetencyType, { novice: number; intermediate: number; advanced: number } | number>
    feedbackMessages?: {
      excellent: string
      good: string
      fair: string
      poor: string
    }
  }
  security?: {
    passwordMinLength?: number
    passwordRequireNumbers?: boolean
    passwordRequireSpecialChars?: boolean
    sessionTimeoutMinutes?: number
    maxLoginAttempts?: number
    lockoutDurationMinutes?: number
  }
}

export interface SystemSettings {
  pubmedApiKey: string
  pubmedRateLimit: number
  cacheDuration: number
  aiModel: string
  aiTemperature: number
  aiTopP: number
  competencyThresholds: Record<CompetencyType, { novice: number; intermediate: number; advanced: number }>
}

export interface Alert {
  id: string
  condition: string
  action: string
  severity: 'warning' | 'critical'
  isActive: boolean
  lastTriggered?: string
}

// ============ PERMISOS ============

export interface Permission {
  action: string
  resource: string
  allowed: boolean
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  student: [
    'search:execute',
    'search:save',
    'verify:claim',
    'export:bibliography',
    'progress:view_own',
    'case:view_assigned',
    'case:submit',
  ],
  professor: [
    'search:execute',
    'search:save',
    'verify:claim',
    'export:bibliography',
    'case:create',
    'case:edit',
    'case:assign',
    'case:evaluate',
    'hedge:manage',
    'student:view_progress',
    'analytics:view_class',
  ],
  admin: [
    '*', // Full access
  ],
}
