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
  displayName?: string;
  goals?: string;
  subjects?: string[];
  availableTime?: number;
  streak: number;
  lastActive?: string;
  onboarded: boolean;
  learningMode?: 'tutor' | 'thinker' | 'tester';
  xp: number;
  level: number;
  recentActivity?: Activity[];
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
  examId: string;
  examName: string;
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
  }[];
}

export interface StudyPlan {
  id: string;
  uid: string;
  title: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface Task {
  id: string;
  uid: string;
  planId: string;
  title: string;
  date: string;
  duration: number;
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
