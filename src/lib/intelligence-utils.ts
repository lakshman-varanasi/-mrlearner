import { collection, query, where, getDocs, addDoc, orderBy, limit, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Exam, TestResult, StudyPlan, Task, AIInsight, ExamPrediction } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { differenceInDays, parseISO, format, addDays, isBefore } from 'date-fns';

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  }
  return _ai;
}
const ai = { models: { generateContent: (args: Parameters<GoogleGenAI['models']['generateContent']>[0]) => getAI().models.generateContent(args) } };

/**
 * Predictive Intelligence: Analyzes user data to generate proactive insights.
 */
export const generateProactiveInsights = async (uid: string, profile: UserProfile): Promise<AIInsight[]> => {
  try {
    // 1. Fetch relevant data
    const examsQuery = query(collection(db, 'exams'), where('uid', '==', uid));
    const examsSnap = await getDocs(examsQuery);
    const exams = examsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Exam));

    const resultsQuery = query(collection(db, 'testResults'), where('uid', '==', uid), orderBy('timestamp', 'desc'), limit(5));
    const resultsSnap = await getDocs(resultsQuery);
    const results = resultsSnap.docs.map(d => ({ id: d.id, ...d.data() } as TestResult));

    const plansQuery = query(collection(db, 'studyPlans'), where('uid', '==', uid));
    const plansSnap = await getDocs(plansQuery);
    const plans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudyPlan));

    // 2. Local heuristic analysis
    const insights: AIInsight[] = [];
    const now = new Date();

    // Check for upcoming exams and syllabus coverage
    for (const exam of exams) {
      const examDate = parseISO(exam.date);
      const daysUntil = differenceInDays(examDate, now);
      
      if (daysUntil > 0 && daysUntil <= 14) {
        const plan = plans.find(p => p.subject === exam.subject || p.title.includes(exam.name));
        const progress = plan?.progress || 0;

        if (progress < 50 && daysUntil <= 7) {
          insights.push({
            id: `alert-exam-${exam.id}`,
            uid,
            type: 'alert',
            priority: 'high',
            title: 'Urgent: Exam Approaching',
            content: `Your ${exam.name} exam is in ${daysUntil} days and only ${progress}% of the syllabus is covered.`,
            actionLabel: 'Create Fast-Track Plan',
            actionType: 'plan',
            timestamp: now.toISOString(),
            isRead: false
          });
        } else if (progress < 80) {
          insights.push({
            id: `prediction-exam-${exam.id}`,
            uid,
            type: 'prediction',
            priority: 'medium',
            title: 'Study Recommendation',
            content: `To complete your ${exam.name} syllabus on time, you should aim for 2-3 topics per day.`,
            actionLabel: 'Revise Now',
            actionType: 'revise',
            timestamp: now.toISOString(),
            isRead: false
          });
        }
      }
    }

    // Check for performance trends
    if (results.length >= 3) {
      const avgScore = results.reduce((acc, r) => acc + r.percentage, 0) / results.length;
      if (avgScore < 60) {
        insights.push({
          id: 'guidance-performance',
          uid,
          type: 'guidance',
          priority: 'medium',
          title: 'Struggling with Accuracy?',
          content: 'Your recent test scores are below 60%. Let\'s simplify the topics and focus on the basics.',
          actionLabel: 'Revise Weak Topics',
          actionType: 'recovery',
          timestamp: now.toISOString(),
          isRead: false
        });
      }
    }

    // Check for streak risk
    if (profile.streak > 0) {
      const lastActive = profile.lastActive ? parseISO(profile.lastActive) : null;
      if (lastActive && differenceInDays(now, lastActive) >= 1) {
        insights.push({
          id: 'motivation-streak',
          uid,
          type: 'motivation',
          priority: 'high',
          title: 'Streak at Risk! ⚡',
          content: 'Don\'t break your streak today! You\'ve worked so hard to maintain it.',
          actionLabel: 'Quick Study Session',
          actionType: 'test',
          timestamp: now.toISOString(),
          isRead: false
        });
      }
    }

    // Check for smart revision (Spaced Repetition)
    const revisionTopics = await getSmartRevisionTopics(uid);
    if (revisionTopics.length > 0) {
      const topTopic = revisionTopics[0];
      insights.push({
        id: `guidance-revision-${topTopic.topic}`,
        uid,
        type: 'guidance',
        priority: topTopic.priority === 'high' ? 'high' : 'medium',
        title: 'Time for Revision',
        content: `It's been a while since you studied "${topTopic.topic}". A quick revision will help lock it in your long-term memory.`,
        actionLabel: 'Start Revision',
        actionType: 'revise',
        timestamp: now.toISOString(),
        isRead: false
      });
    }

    // 3. AI-driven emotional engagement (Gemini)
    // We can use Gemini to generate a personalized motivational message
    const motivationalPrompt = `You are a supportive AI learning mentor. 
    User Profile: Level ${profile.level}, XP ${profile.xp}, Streak ${profile.streak}.
    Recent Activity: ${profile.recentActivity?.slice(0, 3).map(a => a.title).join(', ') || 'None'}.
    Generate one short, emotionally engaging motivational sentence for the user's dashboard.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ text: motivationalPrompt }]
    });

    if (response.text) {
      insights.push({
        id: 'ai-motivation',
        uid,
        type: 'motivation',
        priority: 'low',
        title: 'Mentor\'s Note',
        content: response.text.trim(),
        timestamp: now.toISOString(),
        isRead: false
      });
    }

    return insights;
  } catch (error) {
    console.error('Error generating insights:', error);
    return [];
  }
};

/**
 * Weak Area Detection: Identifies topics where the user performs poorly.
 */
export const detectWeakAreas = async (uid: string): Promise<{ topic: string, score: number, count: number }[]> => {
  try {
    const resultsQuery = query(collection(db, 'testResults'), where('uid', '==', uid), orderBy('timestamp', 'desc'), limit(20));
    const resultsSnap = await getDocs(resultsQuery);
    const results = resultsSnap.docs.map(d => d.data() as TestResult);

    const topicStats: Record<string, { totalScore: number, count: number }> = {};

    results.forEach(res => {
      res.breakdown?.forEach(item => {
        if (!topicStats[item.topic]) {
          topicStats[item.topic] = { totalScore: 0, count: 0 };
        }
        topicStats[item.topic].totalScore += item.score;
        topicStats[item.topic].count += 1;
      });
    });

    return Object.entries(topicStats)
      .map(([topic, stats]) => ({
        topic,
        score: Math.round(stats.totalScore / stats.count),
        count: stats.count
      }))
      .filter(t => t.score < 70)
      .sort((a, b) => a.score - b.score);
  } catch (error) {
    console.error('Error detecting weak areas:', error);
    return [];
  }
};

/**
 * Smart Revision System: Suggests topics based on Spaced Repetition.
 */
export const getSmartRevisionTopics = async (uid: string): Promise<{ topic: string, lastStudied: string, priority: 'high' | 'medium' | 'low' }[]> => {
  try {
    const tasksQuery = query(collection(db, 'tasks'), where('uid', '==', uid), where('status', '==', 'completed'), orderBy('date', 'desc'), limit(50));
    const tasksSnap = await getDocs(tasksQuery);
    const tasks = tasksSnap.docs.map(d => d.data() as Task);

    const topicLastStudied: Record<string, string> = {};
    tasks.forEach(task => {
      task.topics.forEach(topic => {
        if (!topicLastStudied[topic] || isBefore(parseISO(topicLastStudied[topic]), parseISO(task.date))) {
          topicLastStudied[topic] = task.date;
        }
      });
    });

    const now = new Date();
    return Object.entries(topicLastStudied)
      .map(([topic, lastStudied]) => {
        const daysSince = differenceInDays(now, parseISO(lastStudied));
        let priority: 'high' | 'medium' | 'low' = 'low';
        if (daysSince >= 7) priority = 'high';
        else if (daysSince >= 3) priority = 'medium';
        
        return { topic, lastStudied, priority };
      })
      .filter(t => t.priority !== 'low')
      .sort((a, b) => {
        const pMap = { high: 3, medium: 2, low: 1 };
        return pMap[b.priority] - pMap[a.priority];
      });
  } catch (error) {
    console.error('Error getting revision topics:', error);
    return [];
  }
};

/**
 * Daily Goal Suggestions: Recommends targets based on exam date and progress.
 */
export const getDailyGoalSuggestions = async (uid: string): Promise<{ title: string, reason: string }[]> => {
  try {
    const examsQuery = query(collection(db, 'exams'), where('uid', '==', uid));
    const examsSnap = await getDocs(examsQuery);
    const exams = examsSnap.docs.map(d => d.data() as Exam);

    const goals: { title: string, reason: string }[] = [];
    const now = new Date();

    for (const exam of exams) {
      const daysUntil = differenceInDays(parseISO(exam.date), now);
      if (daysUntil > 0 && daysUntil <= 30) {
        if (daysUntil <= 7) {
          goals.push({ title: `Final Revision for ${exam.name}`, reason: 'Exam is in less than a week.' });
        } else {
          goals.push({ title: `Complete 2 topics for ${exam.name}`, reason: 'To stay on track with your syllabus.' });
        }
      }
    }

    if (goals.length === 0) {
      goals.push({ title: 'Explore a new subject', reason: 'You have no upcoming exams scheduled.' });
    }

    return goals;
  } catch (error) {
    console.error('Error getting daily goals:', error);
    return [];
  }
};

/**
 * Resume Learning Feature: "Continue where you left off".
 */
export const getResumeContext = async (uid: string): Promise<{ topic: string, type: 'task' | 'chat' } | null> => {
  try {
    // Check for last pending task
    const tasksQuery = query(collection(db, 'tasks'), where('uid', '==', uid), where('status', '==', 'pending'), orderBy('date', 'asc'), limit(1));
    const tasksSnap = await getDocs(tasksQuery);
    if (!tasksSnap.empty) {
      const task = tasksSnap.docs[0].data() as Task;
      return { topic: task.topics[0] || task.title, type: 'task' };
    }

    // Check for last chat session
    const chatsQuery = query(collection(db, 'chatSessions'), where('uid', '==', uid), orderBy('lastUpdatedAt', 'desc'), limit(1));
    const chatsSnap = await getDocs(chatsQuery);
    if (!chatsSnap.empty) {
      const chat = chatsSnap.docs[0].data();
      return { topic: chat.title, type: 'chat' };
    }

    return null;
  } catch (error) {
    console.error('Error getting resume context:', error);
    return null;
  }
};

/**
 * Adaptive Behavior: Adjusts difficulty and workload based on performance.
 */
export const getAdaptiveWorkload = (results: TestResult[]): { difficulty: 'easy' | 'medium' | 'hard', durationMultiplier: number } => {
  if (results.length === 0) return { difficulty: 'medium', durationMultiplier: 1 };

  const recentResults = results.slice(0, 3);
  const avgScore = recentResults.reduce((acc, r) => acc + r.percentage, 0) / recentResults.length;

  if (avgScore > 85) {
    return { difficulty: 'hard', durationMultiplier: 1.2 }; // Increase difficulty and duration
  } else if (avgScore < 50) {
    return { difficulty: 'easy', durationMultiplier: 0.8 }; // Simplify and reduce duration
  }

  return { difficulty: 'medium', durationMultiplier: 1 };
};

/**
 * WOW Feature: AI Exam Prediction System.
 */
export const predictExamQuestions = async (exam: Exam, results: TestResult[]): Promise<ExamPrediction> => {
  const prompt = `You are an expert exam predictor. 
  Exam: ${exam.name}
  Subject: ${exam.subject}
  Syllabus: ${exam.syllabusText || 'General subject knowledge'}
  User's Recent Performance: ${results.map(r => `${r.percentage}% in ${r.examName}`).join(', ')}

  Based on typical exam patterns and the syllabus, predict:
  1. 5 "Most Likely" questions with high weights.
  2. 3 "Important" questions.
  3. Frequently confused topics.
  4. A structured mind map (text-based).
  5. Memory techniques or shortcuts for difficult topics.

  Return the response in JSON format matching this schema:
  {
    "predictedQuestions": [
      { "question": "string", "weight": "high" | "medium" | "low", "topic": "string", "explanation": "string", "trick": "string", "memoryTechnique": "string" }
    ],
    "importantTopics": ["string"],
    "frequentlyConfused": ["string"],
    "mindMapText": "string"
  }`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ text: prompt }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          predictedQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                weight: { type: Type.STRING },
                topic: { type: Type.STRING },
                explanation: { type: Type.STRING },
                trick: { type: Type.STRING },
                memoryTechnique: { type: Type.STRING }
              }
            }
          },
          importantTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
          frequentlyConfused: { type: Type.ARRAY, items: { type: Type.STRING } },
          mindMapText: { type: Type.STRING }
        }
      }
    }
  });

  const data = JSON.parse(response.text);
  return {
    id: `prediction-${exam.id}-${Date.now()}`,
    uid: exam.uid,
    examId: exam.id,
    examName: exam.name,
    ...data,
    generatedAt: new Date().toISOString()
  };
};

/**
 * Generates a structured study plan based on exam and syllabus.
 */
export const generateStudyPlan = async (uid: string, exam: Exam): Promise<{ plan: Omit<StudyPlan, 'id'>, tasks: Omit<Task, 'id'>[] }> => {
  const prompt = `You are an expert academic planner. 
  Exam: ${exam.name}
  Subject: ${exam.subject}
  Syllabus: ${exam.syllabusText || 'General subject knowledge'}
  Exam Date: ${exam.date}
  Current Date: ${new Date().toISOString()}

  Generate a structured study plan from today until the exam date.
  The plan should include:
  1. A title for the study plan.
  2. A list of daily tasks. Each task should have:
     - title: A clear, concise task name.
     - type: Either 'learn' or 'test'.
     - date: The date for the task in YYYY-MM-DD format.
     - duration: Estimated duration in minutes.
     - topics: A list of topics to cover in this task.

  Return the response in JSON format matching this schema:
  {
    "title": "string",
    "tasks": [
      { "title": "string", "type": "learn" | "test", "date": "string", "duration": number, "topics": ["string"] }
    ]
  }`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ text: prompt }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                type: { type: Type.STRING },
                date: { type: Type.STRING },
                duration: { type: Type.NUMBER },
                topics: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["title", "type", "date", "duration"]
            }
          }
        },
        required: ["title", "tasks"]
      }
    }
  });

  const data = JSON.parse(response.text);
  
  const plan: Omit<StudyPlan, 'id'> = {
    uid,
    title: data.title,
    subject: exam.subject,
    startDate: new Date().toISOString(),
    endDate: exam.date,
    streak: 0,
    performance: 0,
    progress: 0,
    createdAt: new Date().toISOString()
  };

  const tasks: Omit<Task, 'id'>[] = data.tasks.map((t: any) => ({
    uid,
    planId: '', // Will be set after plan is created
    ...t,
    status: 'pending',
    rescheduled: false
  }));

  return { plan, tasks };
};
