import React, { useEffect, useState, useRef } from 'react';
import { chatApi } from '../../services/api';
import type { ChatSession, ChatMessage } from '../../types';
import {
  Send,
  Plus,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Bot,
  User as UserIcon
} from 'lucide-react';

export const AIAssistant: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Load user's chat sessions
  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoadingSessions(true);
      try {
        const sessList = await chatApi.getSessions();
        setSessions(sessList);
        if (sessList.length > 0) {
          setCurrentSessionId(sessList[0].id);
        } else {
          // Auto create initial session
          const newSess = await chatApi.createSession('General Citizen Inquiry');
          setSessions([newSess]);
          setCurrentSessionId(newSess.id);
        }
      } catch (err) {
        console.error('Failed to load chat sessions:', err);
      } finally {
        setIsLoadingSessions(false);
      }
    };
    fetchSessions();
  }, []);

  // Load messages when current session changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!currentSessionId) return;
      try {
        const msgs = await chatApi.getMessages(currentSessionId);
        setMessages(msgs);
      } catch (err) {
        console.error('Failed to load session messages:', err);
      }
    };
    fetchMessages();
  }, [currentSessionId]);

  const handleCreateSession = async () => {
    try {
      const newSess = await chatApi.createSession('New Inquiry');
      setSessions((prev) => [newSess, ...prev]);
      setCurrentSessionId(newSess.id);
      setMessages([]);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isSending || !currentSessionId) return;

    const query = inputQuery.trim();
    setInputQuery('');

    // Optimistically add citizen message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: query,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsSending(true);

    try {
      const assistantMsg = await chatApi.sendMessage(currentSessionId, query);
      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, assistantMsg]);
    } catch (err) {
      console.error('Failed to send message:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, but an error occurred while processing your query with the public service knowledge repository. Please try again.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col md:flex-row bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Session Sidebar */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/70 p-4 flex flex-col shrink-0">
        <button
          onClick={handleCreateSession}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition mb-4"
        >
          <Plus size={16} />
          <span>New AI Conversation</span>
        </button>

        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
          Your Consultations
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {isLoadingSessions && (
            <p className="px-2 text-[11px] text-slate-400">Loading consultations...</p>
          )}
          {sessions.map((s) => {
            const isSelected = s.id === currentSessionId;
            return (
              <button
                key={s.id}
                onClick={() => setCurrentSessionId(s.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition flex items-center space-x-2 ${
                  isSelected
                    ? 'bg-blue-100/70 text-blue-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100/80'
                }`}
              >
                <MessageSquare size={14} className={isSelected ? 'text-blue-600 shrink-0' : 'text-slate-400 shrink-0'} />
                <span className="truncate">{s.title || 'Inquiry Session'}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-slate-200/80 text-[11px] text-slate-500">
          <p className="flex items-center space-x-1 font-medium text-slate-700">
            <ShieldCheck size={13} className="text-blue-600" />
            <span>Curated Knowledge Grounding</span>
          </p>
          <p className="mt-1 text-[10px] text-slate-400 leading-tight">
            Responses use strictly verified Citizen Charters & Service Rules.
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-slate-50/30">
        {/* Chat Messages Display */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4 shadow-xs">
                <Sparkles size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Civic Service AI Assistant
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Ask about eligibility, documents required, application procedures, or complaint redressal rules across government departments.
              </p>

              <div className="mt-6 w-full space-y-2">
                {[
                  'What documents are needed for a Birth Certificate?',
                  'How long does a pipeline leakage repair take?',
                  'What is the eligibility for BPL Ration Card?',
                ].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputQuery(prompt);
                    }}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50/50 hover:border-blue-300 text-xs text-slate-700 transition"
                  >
                    &ldquo;{prompt}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold ${
                      isUser ? 'bg-blue-600' : 'bg-slate-800'
                    }`}
                  >
                    {isUser ? <UserIcon size={14} /> : <Bot size={15} />}
                  </div>

                  <div className={`max-w-2xl space-y-2.5 ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-tr-xs shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-xs'
                      }`}
                    >
                      {!isUser && (
                        <div className="flex items-center space-x-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2">
                          <Sparkles size={12} />
                          <span>AI Assistant &bull; Curated Grounding</span>
                        </div>
                      )}
                      <div>{m.content}</div>
                    </div>

                    {/* Sourced References Cards */}
                    {!isUser && m.sources && m.sources.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Verified Reference Sources ({m.sources.length}):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {m.sources.map((src, idx) => (
                            <div
                              key={idx}
                              className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-700 shadow-2xs"
                            >
                              <div className="font-semibold text-slate-900 line-clamp-1">
                                {src.title}
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                                <span>Reviewed: {src.last_reviewed || 'Recent'}</span>
                                {src.source_url && (
                                  <a
                                    href={src.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700 flex items-center space-x-0.5"
                                  >
                                    <span>Portal</span>
                                    <ExternalLink size={10} />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {isSending && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0">
                <Bot size={15} />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-4 shadow-xs text-xs text-slate-500 flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></div>
                <span>Searching knowledge repository and generating answer...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Query Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask a question about government services, procedures, documents or complaints..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isSending}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-40 shadow-xs transition shrink-0"
              title="Send Inquiry"
            >
              <Send size={18} />
            </button>
          </form>
          <div className="mt-2 text-[10px] text-center text-slate-400">
            AI responses are generated based on curated public documents. For legal certification, visit official departmental counters.
          </div>
        </div>
      </div>
    </div>
  );
};
