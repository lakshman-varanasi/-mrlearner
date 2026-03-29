export interface Exam {
  id: string;
  uid: string;
  name: string;
  subject: string;
  date: string;
  syllabusText?: string;
  syllabusFileUrl?: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  goals?: string;
  subjects?: string[];
  availableTime?: number;
  streak: number;
  lastActive?: string;
  onboarded: boolean;
  lastUsernameUpdate?: string;
  learningMode?: 'learner' | 'tester';
  xp: number;
  level: number;
  recentActivity?: Activity[];
  onboardingData?: {
    examDate?: string;
    targetScore?: number;
    difficultyPreference?: 'easy' | 'medium' | 'hard';
  };
}

export interface AIInsight {
  id: string;
  uid: string;
  type: 'prediction' | 'alert' | 'motivation' | 'guidance';
  priority: 'low' | 'medium' | 'high';
  title: string;
  content: string;
  actionLabel?: string;
  actionPath?: string;
  actionType?: 'plan' | 'revise' | 'test' | 'recovery';
  timestamp: string;
  isRead: boolean;
}

export interface ExamPrediction {
  id: string;
  uid: string;
  examId: string;
  examName: string;
  predictedQuestions: {
    question: string;
    weight: 'high' | 'medium' | 'low';
    topic: string;
    explanation: string;
    trick?: string;
    memoryTechnique?: string;
  }[];
  importantTopics: string[];
  frequentlyConfused: string[];
  mindMapText?: string;
  generatedAt: string;
}

export interface ChatSession {
  id: string;
  uid: string;
  title: string;
  mode: 'learner';
  createdAt: string;
  lastUpdatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  uid: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface Activity {
  id: string;
  type: 'learning' | 'test' | 'doubt' | 'exam_added' | 'task_completed';
  title: string;
  timestamp: string;
  xpGained: number;
  metadata?: any;
}

export interface TestResult {
  id: string;
  uid: string;
  examId?: string;
  planId?: string;
  examName?: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timestamp: string;
  questions: {
    question: string;
    userAnswer: string;
    correctAnswer: string;
    explanation: string;
    isCorrect: boolean;
    topic?: string;
  }[];
  breakdown?: {
    topic: string;
    score: number;
    total: number;
  }[];
}

export interface StudyPlan {
  id: string;
  uid: string;
  title: string;
  subject?: string;
  startDate: string;
  endDate: string;
  streak: number;
  performance: number;
  progress: number;
  createdAt: string;
}

export interface Task {
  id: string;
  uid: string;
  planId: string;
  title: string;
  type: 'learn' | 'test';
  date: string;
  duration: number;
  topics?: string[];
  status: 'pending' | 'completed' | 'missed';
  rescheduled: boolean;
  completedAt?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
