'use client'
import { useState, useEffect, useRef } from 'react';

const CHUNK_DURATION = 50; // Milliseconds per audio chunk
const SAMPLE_RATE = 16000;

export default function WebsocketClient() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [audioQueue, setAudioQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAssistantStreamingOver, setIsAssistantStreamingOver] = useState(false);
  const isAssistantStreamingOverRef = useRef(isAssistantStreamingOver);
  // ... existing state ...
  const bufferQueue = useRef([]);
  const isSending = useRef(false);

  // Modified mediaRecorder handler
  const handleDataAvailable = async (event) => {
    if (event.data.size > 0) {
      bufferQueue.current.push(event.data);
      processBufferQueue();
    }
  };

  // New buffer processing logic
  const processBufferQueue = async () => {
    if (!ws.current || isSending.current || bufferQueue.current.length === 0) return;

    isSending.current = true;
    
    try {
      while (bufferQueue.current.length > 0 && ws.current.readyState === WebSocket.OPEN) {
        const chunk = bufferQueue.current[0];
        await new Promise((resolve, reject) => {
          // Check WebSocket buffer backpressure
          if (ws.current && ws.current.bufferedAmount > 1024 * 1024) { // 1MB threshold
            setTimeout(resolve, 50);
            return;
          }
          
          if(ws.current){
            ws.current.send(chunk);
            bufferQueue.current.shift();
            resolve();
          }
        });
      }
    } catch (error) {
      console.error('Error sending audio:', error);
    } finally {
      isSending.current = false;
    }
  };

  ////////////////////

  // Synchronize the ref with the state
  useEffect(() => {
    isAssistantStreamingOverRef.current = isAssistantStreamingOver;
  }, [isAssistantStreamingOver]);

  const ws = useRef(null);
  const mediaRecorder = useRef(null);
  const audioContext = useRef(null);
  const audioQueueRef = useRef(audioQueue);

  useEffect(() => {
    audioQueueRef.current = audioQueue;
  }, [audioQueue]);

  useEffect(() => {
    // Initialize audio context
    audioContext.current = new (window.AudioContext || window.webkitAudioContext)();

    // Setup WebSocket connection
    ws.current = new WebSocket('ws://35.202.156.40:8000/');

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      startAudioRecording();
      processBufferQueue(); // Start processing any queued chunks
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'user_transcript_final':
          setMessages(prev => [...prev, `User: ${data.content}`]);
          break;
        case 'user_transcript_streaming':
          if(isAssistantStreamingOverRef.current){
            setMessages(prev => [...prev, `User: ${data.content}`]);
            setIsAssistantStreamingOver(false)
          }
          else{
            setMessages(prev => [...prev.slice(0, -1), `User: ${data.content}`]);
          }
          break;
        case 'assistant_reply':
          setIsAssistantStreamingOver(true)
          setMessages(prev => [...prev, `Assistant: ${data.content}`]);
          break;
        case 'assistant_voice_output':
          console.log('received audio')
          setAudioQueue(prev => [...prev, data.content]);
          break;
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      stopAudioRecording();
    };

    return () => {
      ws.current?.close();
      stopAudioRecording();
    };
  }, []);

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      });

      mediaRecorder.current.ondataavailable = handleDataAvailable
      
      // async (event) => {
      //   if (event.data.size > 0) {
      //   //   setAudioBuffer((prev) => [...prev, event.data])
      //   // }
      //   // if(audioBufferRef.current) {
      //   //   const currQueue = audioBufferRef.current
      //   //   const topElementInQueue = currQueue.shift()
      //   //   setAudioBuffer(currQueue)
      //     const arrayBuffer = await event.data.arrayBuffer();
      //     await ws.current.send(arrayBuffer);
      //   }
      // };

      mediaRecorder.current.start(CHUNK_DURATION);
      setIsRecording(true);
    } catch (error) {
      setIsRecording(false);
      console.error('Error accessing microphone:', error);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
  };

  const processAudioQueue = async () => {
    if (isPlaying || audioQueueRef.current.length === 0) return;

    setIsPlaying(true);
    const audioData = audioQueueRef.current[0];

    try {
      const decodedData = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
      const audioBuffer = await audioContext.current.decodeAudioData(decodedData.buffer);

      const source = audioContext.current.createBufferSource();
      source.buffer = audioBuffer;

      await source.connect(audioContext.current.destination);
      source.start(0);

      source.onended = () => {
        setAudioQueue(prev => prev.slice(1));
        setIsPlaying(false);
      };
    } catch (error) {
      console.error('Error playing audio:', error);
      setAudioQueue(prev => prev.slice(1));
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    processAudioQueue()
  }, [audioQueue])

  return (
    <div className="max-w-screen mx-auto text-center flex flex-row">
      {/* Conversation History */}
      {/* <div className="w-1/2 h-screen px-6 bg-sky-50 rounded-xl hidden md:block">
        <h2 className="text-xl font-semibold py-8">Conversation</h2>
        <div className="h-5/6 overflow-y-auto p-4 bg-white rounded-xl text-left space-y-3">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg ${msg.startsWith('User:')
                  ? 'bg-gray-100'
                  : 'bg-gray-50 border-black'
                }`}
            >
              {msg}
            </div>
          ))}
        </div>
      </div> */}

      <div className="w-screen h-screen px-6"> {/* Change to w-1/2*/}
        <h1 className="text-3xl font-bold mb-4 mt-80">Voice Assistant</h1>
        <p className="mb-8 text-lg">
          Status: {isConnected ? 'Connected 🟢' : 'Disconnected 🔴'}
        </p>
        {/* Jukebox Container */}
        <div
          className={`relative w-48 h-12 mx-auto my-8 transition-all duration-300 ${(isRecording || isPlaying) && 'animate-bounce-vertical' 
            }`}
        >
          {/* Status Lights */}
          <div className="absolute left-1/2 -translate-x-1/2 flex gap-4">
            <div
              className={`w-5 h-5 rounded-full transition-all duration-300 ${isRecording ? 'bg-green-400 shadow-green-glow' : 'bg-red-400 shadow-red-glow'
                }`}
            />
            <div
              className={`w-5 h-5 rounded-full transition-all duration-300 ${isPlaying ? 'bg-green-400 shadow-green-glow' : 'bg-gray-300'
                }`}
            />
          </div>
        </div>
      </div>

      {/* Custom Animation Style */}
      <style jsx global>{`
          @keyframes bounce-vertical {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
          .animate-bounce-vertical {
            animation: bounce-vertical 0.8s infinite;
          }
          .shadow-green-glow {
            box-shadow: 0 0 12px rgba(72, 187, 120, 0.5);
          }
        `}
      </style>
    </div>
  );
}