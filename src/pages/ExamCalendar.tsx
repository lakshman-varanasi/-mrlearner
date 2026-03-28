import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/FirebaseProvider';
import { Exam } from '../types';
import { GoogleGenAI } from "@google/genai";
import { Plus, Calendar as CalendarIcon, BookOpen, Trash2, Edit2, X, Loader2, FileText, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { addXP, XP_VALUES } from '../lib/xp-utils';

export const ExamCalendar: React.FC = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState('');
  const [syllabusText, setSyllabusText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'exams'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const examsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
      setExams(examsData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'exams');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSyllabusFile(file);

    // If it's an image, we can try to extract text using Gemini
    if (file.type.startsWith('image/')) {
      setIsExtracting(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
              parts: [
                { inlineData: { data: base64Data, mimeType: file.type } },
                { text: "Please extract the syllabus topics from this image. Return only the topics as a plain text list." }
              ]
            }
          });
          if (response.text) {
            setSyllabusText(response.text);
          }
          setIsExtracting(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("Extraction error:", error);
        setIsExtracting(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    const examData = {
      uid: user.uid,
      name,
      subject,
      date,
      syllabusText,
      createdAt: new Date().toISOString(),
    };

    try {
      if (editingExam) {
        await updateDoc(doc(db, 'exams', editingExam.id), examData).catch(err => handleFirestoreError(err, OperationType.UPDATE, `exams/${editingExam.id}`));
      } else {
        await addDoc(collection(db, 'exams'), examData).catch(err => handleFirestoreError(err, OperationType.CREATE, 'exams'));
        
        // Award XP for adding an exam
        await addXP(user.uid, XP_VALUES.EXAM_ADDED, {
          title: `Added exam: ${name}`,
          type: 'learning'
        });
      }
      closeModal();
    } catch (error) {
      console.error("Error saving exam:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this exam?")) {
      try {
        await deleteDoc(doc(db, 'exams', id)).catch(err => handleFirestoreError(err, OperationType.DELETE, `exams/${id}`));
      } catch (error) {
        console.error("Error deleting exam:", error);
      }
    }
  };

  const openModal = (exam?: Exam) => {
    if (exam) {
      setEditingExam(exam);
      setName(exam.name);
      setSubject(exam.subject);
      setDate(exam.date);
      setSyllabusText(exam.syllabusText || '');
    } else {
      setEditingExam(null);
      setName('');
      setSubject('');
      setDate('');
      setSyllabusText('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExam(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-neutral-900">Exam Calendar</h1>
          <p className="text-neutral-500 mt-2">Manage your upcoming exams and syllabi.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5" />
          Add Exam
        </button>
      </header>

      {exams.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam) => (
            <motion.div
              layout
              key={exam.id}
              className="bg-white p-6 rounded-[32px] border border-neutral-200 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                  <CalendarIcon className="w-6 h-6" />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openModal(exam)} className="p-2 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(exam.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-1">{exam.name}</h3>
              <p className="text-indigo-600 font-semibold text-sm mb-4">{exam.subject}</p>
              
              <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
                <CalendarIcon className="w-4 h-4" />
                {format(new Date(exam.date), 'MMMM d, yyyy')}
              </div>

              {exam.syllabusText ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl">
                  <FileText className="w-4 h-4" />
                  Syllabus Added
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">
                  <BookOpen className="w-4 h-4" />
                  No Syllabus
                </div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-neutral-200 rounded-[40px] p-16 text-center">
          <div className="w-20 h-20 bg-neutral-50 rounded-3xl flex items-center justify-center text-neutral-300 mx-auto mb-6">
            <CalendarIcon className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-bold text-neutral-900 mb-2">No exams found in your calendar</h3>
          <p className="text-neutral-500 max-w-sm mx-auto mb-8">
            Add your upcoming exams to get personalized AI tutoring and exam preparation.
          </p>
          <button
            onClick={() => openModal()}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all"
          >
            Add Your First Exam
          </button>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold">{editingExam ? 'Edit Exam' : 'Add New Exam'}</h2>
                  <button onClick={closeModal} className="p-2 hover:bg-neutral-100 rounded-full transition-all">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Exam Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Final Semester Exam"
                      className="w-full px-5 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Subject</label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Computer Science"
                      className="w-full px-5 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Exam Date</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-5 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Syllabus / Topics</label>
                    <div className="space-y-4">
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-neutral-200 border-dashed rounded-2xl cursor-pointer bg-neutral-50 hover:bg-neutral-100 transition-all">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-neutral-500">
                            {isExtracting ? (
                              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                            ) : (
                              <Upload className="w-8 h-8 mb-2" />
                            )}
                            <p className="text-sm font-bold">{isExtracting ? 'Extracting topics...' : 'Upload Syllabus (Image)'}</p>
                            <p className="text-xs">PNG, JPG or JPEG</p>
                          </div>
                          <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isExtracting} />
                        </label>
                      </div>
                      <textarea
                        value={syllabusText}
                        onChange={(e) => setSyllabusText(e.target.value)}
                        placeholder="Or paste your syllabus content or list of topics here..."
                        rows={4}
                        className="w-full px-5 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : editingExam ? 'Update Exam' : 'Add Exam'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
