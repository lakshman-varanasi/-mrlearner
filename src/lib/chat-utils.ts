import { collection, addDoc, query, where, getDocs, orderBy, limit, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { ChatSession, ChatMessage } from '../types';
import { handleFirestoreError, OperationType } from './firestore-errors';

export const createChatSession = async (uid: string, title: string, mode: 'learner'): Promise<string | null> => {
  try {
    const sessionData: Omit<ChatSession, 'id'> = {
      uid,
      title,
      mode,
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString()
    };
    
    const docRef = await addDoc(collection(db, 'chatSessions'), sessionData).catch(err => 
      handleFirestoreError(err, OperationType.WRITE, 'chatSessions')
    );
    
    return docRef ? docRef.id : null;
  } catch (error) {
    console.error('Error creating chat session:', error);
    return null;
  }
};

export const getChatSessions = async (uid: string, mode: 'learner'): Promise<ChatSession[]> => {
  try {
    const q = query(
      collection(db, 'chatSessions'),
      where('uid', '==', uid),
      where('mode', '==', mode),
      orderBy('lastUpdatedAt', 'desc')
    );
    
    const snap = await getDocs(q).catch(err => 
      handleFirestoreError(err, OperationType.GET, 'chatSessions')
    );
    
    if (!snap) return [];
    
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ChatSession));
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    return [];
  }
};

export const saveChatMessage = async (sessionId: string, uid: string, role: 'user' | 'model', content: string) => {
  try {
    const messageData: Omit<ChatMessage, 'id'> = {
      sessionId,
      uid,
      role,
      content,
      timestamp: new Date().toISOString()
    };
    
    await addDoc(collection(db, 'chatMessages'), messageData).catch(err => 
      handleFirestoreError(err, OperationType.WRITE, 'chatMessages')
    );
    
    // Update session's lastUpdatedAt
    const sessionRef = doc(db, 'chatSessions', sessionId);
    await updateDoc(sessionRef, {
      lastUpdatedAt: new Date().toISOString()
    }).catch(err => 
      handleFirestoreError(err, OperationType.UPDATE, 'chatSessions')
    );
  } catch (error) {
    console.error('Error saving chat message:', error);
  }
};

export const getChatMessages = async (sessionId: string): Promise<ChatMessage[]> => {
  try {
    const q = query(
      collection(db, 'chatMessages'),
      where('sessionId', '==', sessionId),
      orderBy('timestamp', 'asc')
    );
    
    const snap = await getDocs(q).catch(err => 
      handleFirestoreError(err, OperationType.GET, 'chatMessages')
    );
    
    if (!snap) return [];
    
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ChatMessage));
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return [];
  }
};

export const deleteChatSession = async (sessionId: string) => {
  try {
    // Delete all messages in the session
    const q = query(collection(db, 'chatMessages'), where('sessionId', '==', sessionId));
    const snap = await getDocs(q);
    
    const batch = writeBatch(db);
    snap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Delete the session document
    batch.delete(doc(db, 'chatSessions', sessionId));
    
    await batch.commit().catch(err => 
      handleFirestoreError(err, OperationType.WRITE, 'chatSessions/chatMessages batch delete')
    );
  } catch (error) {
    console.error('Error deleting chat session:', error);
  }
};

export const renameChatSession = async (sessionId: string, newTitle: string) => {
  try {
    const sessionRef = doc(db, 'chatSessions', sessionId);
    await updateDoc(sessionRef, {
      title: newTitle,
      lastUpdatedAt: new Date().toISOString()
    }).catch(err => 
      handleFirestoreError(err, OperationType.UPDATE, 'chatSessions')
    );
  } catch (error) {
    console.error('Error renaming chat session:', error);
  }
};
