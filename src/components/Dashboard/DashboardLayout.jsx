import { useState } from 'react';
import { motion } from 'framer-motion';
import DashboardHeader from './DashboardHeader';
import AudioUpload from '../Upload/AudioUpload';
import TranscriptViewer from '../Transcript/TranscriptViewer';
import SummaryCards from '../Summary/SummaryCards';
import { transcribeAudio, formatDuration, countWords, generateSummaryAndActions } from '../../services/groqService';
import { saveTranscript } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { useTranscript } from '../../contexts/TranscriptContext';
import { isFirebaseConfigured } from '../../config/firebase';

const DashboardLayout = () => {
  const { user } = useAuth();
  const {
    transcript,
    setTranscript,
    transcriptId,
    setTranscriptId,
    summary,
    setSummary,
    actionItems,
    setActionItems
  } = useTranscript();
  
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = async (file) => {
    setUploadedFile(file);
    setIsLoading(true);
    setError(null);
    
    try {
      // Step 1: Transcribe audio using Groq Whisper (ABUSE IT! 😈)
      console.log('🎤 Starting transcription with Groq Whisper...');
      const transcriptionResult = await transcribeAudio(file);
      
      // Create transcript object
      const transcriptData = {
        id: Date.now(),
        filename: file.name,
        duration: formatDuration(transcriptionResult.duration),
        uploadDate: new Date().toISOString().split('T')[0],
        status: 'completed',
        text: transcriptionResult.text,
        wordCount: countWords(transcriptionResult.text),
        language: transcriptionResult.language,
      };
      
      setTranscript(transcriptData);
      console.log('✅ Transcription complete!');
      
      // Step 2: Generate summary using Groq (free tier is generous!)
      console.log('🤖 Generating summary with Groq...');
      const summaryResult = await generateSummaryAndActions(transcriptionResult.text);
      
      // Set summary data
      const summaryData = {
        keyPoints: summaryResult.keyPoints,
        sentiment: summaryResult.sentiment,
        topics: summaryResult.topics,
      };
      setSummary(summaryData);
      
      // Set action items
      setActionItems(summaryResult.actionItems);
      
      console.log('✅ Summary and action items generated!');
      
      // Step 3: Save to Firestore if user is authenticated and Firebase is configured
      if (user && user.uid && isFirebaseConfigured) {
        console.log('💾 Saving transcript to Firestore...');
        try {
          const result = await saveTranscript(user.uid, {
            ...transcriptData,
            transcript: transcriptionResult.text,
            summary: summaryData,
            actionItems: summaryResult.actionItems,
          });
          
          if (result.success) {
            console.log('✅ Transcript saved to Firestore!');
            setTranscriptId(result.id);
          } else {
            console.error('❌ Failed to save to Firestore:', result.error);
          }
        } catch (firestoreError) {
          console.error('❌ Firestore save error:', firestoreError);
          // Don't fail the whole process if Firestore fails
        }
      } else if (user && !isFirebaseConfigured) {
        console.warn('⚠️ Firebase not configured. Transcript not saved to cloud.');
      } else if (!user) {
        console.log('ℹ️ User not authenticated. Transcript not saved to cloud.');
      }
      
      setIsLoading(false);
      
    } catch (err) {
      console.error('❌ Error processing audio:', err);
      setError(err.message || 'Failed to process audio file');
      setIsLoading(false);
      
      // Show error to user
      alert(`Error: ${err.message}\n\nPlease check:\n1. Your API keys are correct\n2. Audio file is valid\n3. You have internet connection`);
    }
  };

  const handleLoadTranscript = (savedTranscript) => {
    // Load a saved transcript from history
    setTranscript({
      id: savedTranscript.id,
      filename: savedTranscript.filename,
      duration: savedTranscript.duration,
      uploadDate: savedTranscript.uploadDate,
      status: savedTranscript.status,
      text: savedTranscript.text,
      wordCount: savedTranscript.wordCount,
      language: savedTranscript.language,
    });
    
    setTranscriptId(savedTranscript.id);
    
    if (savedTranscript.summary) {
      setSummary(savedTranscript.summary);
    }
    
    if (savedTranscript.actionItems) {
      setActionItems(savedTranscript.actionItems);
    }
  };

  return (
    <div className="min-h-screen bg-primary-bg">
      <DashboardHeader
        transcript={transcript}
        summary={summary}
        actionItems={actionItems}
        onLoadTranscript={handleLoadTranscript}
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* VERTICAL STACK LAYOUT - Full Width Sections */}
        <div className="flex flex-col gap-8 w-full">
          
          {/* SECTION 1 - Upload Audio */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full"
          >
            <AudioUpload onFileUpload={handleFileUpload} />
          </motion.section>

          {/* SECTION 2 - Transcript */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full"
          >
            <TranscriptViewer
              transcript={transcript}
              isLoading={isLoading}
            />
          </motion.section>

          {/* SECTION 3 - AI Summary */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full"
          >
            <SummaryCards
              summary={summary}
              isLoading={isLoading}
            />
          </motion.section>

        </div>
      </main>

      {/* Background Effects - Subtle */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-accent-cyan/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent-purple/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
};

export default DashboardLayout;
