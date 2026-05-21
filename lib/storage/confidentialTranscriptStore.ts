'use client';

import { openDB, type IDBPDatabase } from 'idb';
import type { ConfidentialHistoryEntry } from '@/types/chat';

const DB_NAME = 'lawexa-confidential';
const DB_VERSION = 1;
const STORE = 'transcripts';

export interface ConfidentialAttachment {
  file_id: number;
  file_name: string;
  file_size: number;
  expires_at?: string;
}

export interface ConfidentialTranscriptEntry {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  created_at: string;
  local_id: string;
  attachment?: ConfidentialAttachment;
}

export interface ConfidentialTranscript {
  conversation_id: string;
  created_at: string;
  updated_at: string;
  agent_id?: number;
  workflow_id?: number;
  title?: string;
  messages: ConfidentialTranscriptEntry[];
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable on the server'));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'conversation_id' });
          store.createIndex('updated_at', 'updated_at');
        }
      },
    });
  }
  return dbPromise;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newLocalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function ensureTranscript(
  conversation_id: string,
  seed?: Partial<Omit<ConfidentialTranscript, 'conversation_id'>>,
): Promise<ConfidentialTranscript> {
  const db = await getDB();
  const existing = (await db.get(STORE, conversation_id)) as ConfidentialTranscript | undefined;
  if (existing) return existing;

  const transcript: ConfidentialTranscript = {
    conversation_id,
    created_at: seed?.created_at ?? nowIso(),
    updated_at: seed?.updated_at ?? nowIso(),
    agent_id: seed?.agent_id,
    workflow_id: seed?.workflow_id,
    title: seed?.title,
    messages: seed?.messages ?? [],
  };
  await db.put(STORE, transcript);
  return transcript;
}

export async function getTranscript(
  conversation_id: string,
): Promise<ConfidentialTranscript | null> {
  const db = await getDB();
  const row = (await db.get(STORE, conversation_id)) as ConfidentialTranscript | undefined;
  return row ?? null;
}

export async function hasTranscript(conversation_id: string): Promise<boolean> {
  const db = await getDB();
  const key = await db.getKey(STORE, conversation_id);
  return key != null;
}

export async function appendUserTurn(
  conversation_id: string,
  payload: { content: string; attachment?: ConfidentialAttachment },
): Promise<ConfidentialTranscriptEntry> {
  const transcript = await ensureTranscript(conversation_id);
  const entry: ConfidentialTranscriptEntry = {
    role: 'user',
    content: payload.content,
    created_at: nowIso(),
    local_id: newLocalId(),
    ...(payload.attachment && { attachment: payload.attachment }),
  };
  const updated: ConfidentialTranscript = {
    ...transcript,
    updated_at: nowIso(),
    messages: [...transcript.messages, entry],
  };
  const db = await getDB();
  await db.put(STORE, updated);
  return entry;
}

export async function appendAssistantTurn(
  conversation_id: string,
  content: string,
): Promise<ConfidentialTranscriptEntry> {
  const transcript = await ensureTranscript(conversation_id);

  const tail = transcript.messages[transcript.messages.length - 1];
  if (tail && tail.role === 'assistant') {
    const merged: ConfidentialTranscriptEntry = { ...tail, content };
    const updated: ConfidentialTranscript = {
      ...transcript,
      updated_at: nowIso(),
      messages: [...transcript.messages.slice(0, -1), merged],
    };
    const db = await getDB();
    await db.put(STORE, updated);
    return merged;
  }

  const entry: ConfidentialTranscriptEntry = {
    role: 'assistant',
    content,
    created_at: nowIso(),
    local_id: newLocalId(),
  };
  const updated: ConfidentialTranscript = {
    ...transcript,
    updated_at: nowIso(),
    messages: [...transcript.messages, entry],
  };
  const db = await getDB();
  await db.put(STORE, updated);
  return entry;
}

export async function upsertTranscriptTitle(
  conversation_id: string,
  title: string,
): Promise<void> {
  const existing = await getTranscript(conversation_id);
  if (!existing) return;
  const db = await getDB();
  await db.put(STORE, { ...existing, title, updated_at: nowIso() });
}

export async function renameTranscript(
  oldId: string,
  newId: string,
): Promise<void> {
  if (oldId === newId) return;
  const db = await getDB();
  const existing = (await db.get(STORE, oldId)) as ConfidentialTranscript | undefined;
  if (!existing) return;
  const renamed: ConfidentialTranscript = {
    ...existing,
    conversation_id: newId,
    updated_at: nowIso(),
  };
  const tx = db.transaction(STORE, 'readwrite');
  await tx.store.put(renamed);
  await tx.store.delete(oldId);
  await tx.done;
}

export async function listConversationIds(): Promise<string[]> {
  const db = await getDB();
  const keys = await db.getAllKeys(STORE);
  return keys.map((k) => String(k));
}

export async function deleteTranscript(conversation_id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, conversation_id);
}

export async function clearAllTranscripts(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE);
}

export function historyEntriesFor(
  transcript: ConfidentialTranscript | null,
): ConfidentialHistoryEntry[] {
  if (!transcript) return [];
  return transcript.messages.map((m) => ({ role: m.role, content: m.content }));
}
