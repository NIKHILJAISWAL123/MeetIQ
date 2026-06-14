import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Loader2, Sparkles, ArrowLeft, MessageSquare, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranscript } from '../../contexts/TranscriptContext';

// Simple chat without Firebase - uses Groq directly
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

const ChatPageSimple = () => {
  const navigate = useNavigate();
  const { transcript, summary, actionItems } = useTranscript();
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Initialize with welcome message
  useEffect(() => {
    if (!transcript) {
      setError('No transcript available. Please upload a meeting first.');
      return;
    }

    // Add welcome message with context
    const contextInfo = [];
    if (summary?.keyPoints?.length > 0) {
      contextInfo.push(`📝 ${summary.keyPoints.length} key points from the meeting`);
    }
    if (actionItems?.length > 0) {
      contextInfo.push(`✅ ${actionItems.length} action items identified`);
    }
    if (transcript.wordCount) {
      contextInfo.push(`📊 ${transcript.wordCount} words transcribed`);
    }

    const welcomeMessage = {
      role: 'assistant',
      content: `Hi! I'm MeetIQ, your AI meeting assistant. I've analyzed your meeting and I'm ready to answer any questions!\n\n${contextInfo.join('\n')}\n\nWhat would you like to know about this meeting?`,
    };
    setMessages([welcomeMessage]);
  }, [transcript, summary, actionItems]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
    };

    // Add user message to UI
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      // Get transcript text
      const transcriptText = transcript.text || transcript.transcript || '';
      
      // Build context from transcript
      const context = `Meeting Transcript:\n${transcriptText.substring(0, 3000)}...\n\n`;
      
      // Build conversation history
      const conversationHistory = messages
        .slice(-4)
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      // Create prompt for Groq
      const prompt = `You are an AI assistant helping users understand their meeting transcripts. Answer the user's question based on the provided context from the meeting transcript.

${conversationHistory ? `Previous conversation:\n${conversationHistory}\n\n` : ''}${context}

User's question: ${userMessage.content}

Instructions:
- Answer based ONLY on the provided context
- Be concise and specific
- If the context doesn't contain enough information, say so
- Reference specific parts of the meeting when relevant
- Maintain conversation continuity with previous messages

Answer:`;

      // Call Groq API
      console.log('🤖 Calling Groq API...');
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are an AI assistant helping users understand their meeting transcripts. Answer questions based on the provided context.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1024,
        })
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Groq API error:', errorData);
        throw new Error(errorData.error?.message || 'Failed to get answer from AI');
      }

      const data = await response.json();
      const answer = data.choices[0].message.content;

      const assistantMessage = {
        role: 'assistant',
        content: answer,
      };

      // Add assistant message to UI
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to get answer. Please try again.');
      
      const errorMessage = {
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try asking your question again.",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Error state
  if (error && !transcript) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Unable to Start Chat
            </h3>
            <p className="text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-bg flex flex-col">
      {/* Header */}
      <header className="bg-primary-surface border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-primary-hover rounded-lg transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-lg">
                <MessageSquare className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Chat with MeetIQ</h1>
                <p className="text-sm text-gray-400">
                  {transcript?.filename || 'Meeting Assistant'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className={`mb-6 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                  {/* Message bubble */}
                  <div
                    className={`rounded-2xl p-4 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-br from-cyan-500/20 to-purple-500/20 text-white ml-auto'
                        : 'bg-gray-800/50 text-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {message.role === 'assistant' && (
                        <Sparkles className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 flex justify-start"
            >
              <div className="bg-gray-800/50 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                  <span className="text-sm text-gray-400">MeetIQ is thinking...</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error message */}
          {error && transcript && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 flex justify-center"
            >
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-400">{error}</span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="bg-primary-surface border-t border-gray-800 sticky bottom-0">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about your meeting..."
                disabled={isLoading}
                rows={1}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none max-h-32"
                style={{ minHeight: '48px' }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                }}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatPageSimple;

// Made with Bob