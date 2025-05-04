"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { Mic, MicOff, Send, Upload, FileText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import EnhancedBackground from "@/components/enhanced-background"
import { useMouse } from "@/hooks/use-mouse"
import ScrollProgress from "@/components/scroll-progress"

interface Message {
  id: string
  content: string
  sender: "user" | "advisor"
  timestamp: Date
  fileAttachment?: {
    name: string
    type: string
    size: string
  }
}

export default function AIAdvisorPage() {
  const { mousePosition } = useMouse()
  const [scrollY, setScrollY] = useState(0)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content: "Hello! I'm your AI Advisor. How can I help you with your learning journey today?",
      sender: "advisor",
      timestamp: new Date(),
    },
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const speechRecognitionRef = useRef<any>(null)
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Initialize AudioContext
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      } catch (error) {
        console.error("Web Audio API not supported:", error)
      }

      // Initialize Speech Recognition
      if ("webkitSpeechRecognition" in window) {
        // @ts-ignore - webkitSpeechRecognition is not in the types
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        speechRecognitionRef.current = new SpeechRecognition()
        speechRecognitionRef.current.continuous = true
        speechRecognitionRef.current.interimResults = true

        speechRecognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0])
            .map((result: any) => result.transcript)
            .join("")

          setInputMessage(transcript)
        }

        speechRecognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error)
          setIsRecording(false)
        }
      }
    }

    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop()
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    window.addEventListener("scroll", handleScroll)

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Stop speech synthesis when component unmounts
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const toggleRecording = async () => {
    if (isRecording) {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop()
      }

      // Stop microphone stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
      }

      // If we have input after stopping recording, send the message
      if (inputMessage.trim()) {
        handleSendMessage()
      }

      setIsRecording(false)
    } else {
      try {
        // Get microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = stream

        // Start speech recognition
        if (speechRecognitionRef.current) {
          setInputMessage("")
          speechRecognitionRef.current.start()
          setIsRecording(true)
        }
      } catch (error) {
        console.error("Error accessing microphone:", error)
      }
    }
  }

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        content: inputMessage,
        sender: "user",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, newMessage])
      setInputMessage("")

      // Show that we're generating a response
      setIsGeneratingResponse(true)

      // Simulate advisor response
      setTimeout(() => {
        const advisorResponse = generateResponse(inputMessage)
        const responseMessage: Message = {
          id: Date.now().toString(),
          content: advisorResponse,
          sender: "advisor",
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, responseMessage])
        setIsGeneratingResponse(false)

        // Speak the response
        speakText(advisorResponse)
      }, 1500)
    }
  }

  const speakText = (text: string) => {
    if (window.speechSynthesis) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1
      utterance.pitch = 1
      utterance.volume = 1

      // Get available voices and set a good one if available
      const voices = window.speechSynthesis.getVoices()
      const preferredVoice = voices.find(
        (voice) => voice.name.includes("Google") || voice.name.includes("Female") || voice.name.includes("Samantha"),
      )

      if (preferredVoice) {
        utterance.voice = preferredVoice
      }

      // Set up events to track speaking progress
      utterance.onstart = () => {
        setIsPlaying(true)
      }

      utterance.onend = () => {
        setIsPlaying(false)
      }

      utterance.onerror = (event) => {
        console.error("Speech synthesis error", event)
        setIsPlaying(false)
      }

      speechSynthesisRef.current = utterance
      window.speechSynthesis.speak(utterance)
    }
  }

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
      setIsPlaying(false)
    }
  }

  const triggerFileUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setIsUploading(true)

      // Process each file
      Array.from(files).forEach((file) => {
        // Format file size
        const formatFileSize = (bytes: number): string => {
          if (bytes < 1024) return bytes + " bytes"
          else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"
          else return (bytes / 1048576).toFixed(1) + " MB"
        }

        // Create a message with the file attachment
        const newMessage: Message = {
          id: Date.now().toString() + Math.random(),
          content: `I've uploaded a file: ${file.name}`,
          sender: "user",
          timestamp: new Date(),
          fileAttachment: {
            name: file.name,
            type: file.type,
            size: formatFileSize(file.size),
          },
        }

        setMessages((prev) => [...prev, newMessage])

        // Show that we're generating a response
        setIsGeneratingResponse(true)

        // Simulate processing and response
        setTimeout(() => {
          const responseMessage: Message = {
            id: Date.now().toString() + Math.random(),
            content: `I've received your file "${file.name}". I can analyze this and provide insights based on its content. What specific aspects would you like me to focus on?`,
            sender: "advisor",
            timestamp: new Date(),
          }

          setMessages((prev) => [...prev, responseMessage])
          setIsGeneratingResponse(false)
          setIsUploading(false)

          // Speak the response
          speakText(responseMessage.content)
        }, 1500)
      })

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const generateResponse = (query: string): string => {
    // Simple response generation logic - in a real app, this would use an AI model
    const queryLower = query.toLowerCase()

    if (queryLower.includes("learning path") || queryLower.includes("curriculum")) {
      return "Based on your interests, I recommend starting with the fundamentals of computer science, then moving to programming basics with Python. After that, you can specialize in data structures, algorithms, and then move to your area of interest like web development, data science, or AI."
    } else if (queryLower.includes("machine learning") || queryLower.includes("ai")) {
      return "For a machine learning path, I recommend starting with mathematics fundamentals (linear algebra, calculus, and statistics), then learning Python programming, followed by ML libraries like scikit-learn and TensorFlow. After that, you can explore deep learning concepts and specialized areas like NLP or computer vision."
    } else if (
      queryLower.includes("web development") ||
      queryLower.includes("frontend") ||
      queryLower.includes("backend")
    ) {
      return "For web development, start with HTML, CSS, and JavaScript fundamentals. Then learn a frontend framework like React, Vue, or Angular. For backend, explore Node.js, Python (Django/Flask), or other server technologies. Database knowledge is also crucial - both SQL and NoSQL options."
    } else if (queryLower.includes("hello") || queryLower.includes("hi")) {
      return "Hello! I'm your AI learning advisor. I can help you create personalized learning paths, recommend resources, and answer questions about your educational journey. What would you like to learn about?"
    } else {
      return "I can help you create a personalized learning path based on your interests and goals. Could you tell me more about what subjects or skills you're interested in developing? This will help me provide more tailored recommendations."
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <EnhancedBackground mousePosition={mousePosition} />
      <Navbar scrollY={scrollY} />
      <ScrollProgress />

      <main className="relative z-10 pt-24 pb-20 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-4 transition-colors duration-700">
              AI Advisor
            </h1>
            <p className="text-xl dark:text-gray-300 text-slate-700 max-w-3xl mx-auto transition-colors duration-700">
              Your personal guide to creating customized learning paths
            </p>
          </motion.div>

          <div className="relative">
            {/* Main conversation area */}
            <div className="flex flex-col items-center">
              {/* Messages container */}
              <div
                ref={messagesContainerRef}
                className="w-full max-w-4xl h-[500px] overflow-y-auto rounded-xl bg-black/10 backdrop-blur-sm p-6"
              >
                <div className="space-y-6">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] ${
                          message.sender === "user"
                            ? "bg-purple-500/20 backdrop-blur-sm border border-purple-500/30"
                            : "bg-transparent border-0 text-white/90 dark:text-white/90"
                        } rounded-xl p-4 ${message.sender === "user" ? "text-slate-800 dark:text-white/90" : ""}`}
                      >
                        {message.fileAttachment && (
                          <div className="mb-3 p-3 bg-white/20 dark:bg-slate-800/40 rounded-lg flex items-center">
                            <FileText className="h-5 w-5 mr-2 text-purple-500" />
                            <div>
                              <p className="font-medium">{message.fileAttachment.name}</p>
                              <p className="text-xs opacity-70">
                                {message.fileAttachment.size} • {message.fileAttachment.type}
                              </p>
                            </div>
                          </div>
                        )}
                        <p>{message.content}</p>
                        <div className="mt-2 text-xs opacity-50 text-right">
                          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Status indicator */}
              {(isPlaying || isGeneratingResponse) && (
                <div className="mt-4 text-center">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex items-center px-3 py-1 rounded-full bg-purple-500/20 backdrop-blur-sm border border-purple-500/30 text-sm"
                  >
                    <span className="mr-2 h-2 w-2 rounded-full bg-purple-500 animate-pulse"></span>
                    {isPlaying ? "Speaking..." : "Generating response..."}
                  </motion.div>
                </div>
              )}

              {/* Input area */}
              <div className="mt-4 w-full max-w-4xl flex items-center space-x-2">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />

                <Button
                  onClick={triggerFileUpload}
                  variant="outline"
                  size="icon"
                  className="bg-white/20 dark:bg-slate-800/40 border-0 hover:bg-white/30 dark:hover:bg-slate-700/50"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <div className="h-4 w-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </Button>

                <div className="flex-1 relative">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Ask about learning paths or upload materials..."
                    className="bg-white/20 dark:bg-slate-800/40 border-0 focus-visible:ring-purple-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-white"
                  />
                  {inputMessage && (
                    <button
                      onClick={() => setInputMessage("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <Button
                  onClick={toggleRecording}
                  variant="outline"
                  size="icon"
                  className={`${
                    isRecording
                      ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 hover:text-red-600"
                      : "bg-white/20 dark:bg-slate-800/40 hover:bg-white/30 dark:hover:bg-slate-700/50"
                  } border-0`}
                >
                  {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>

                <Button
                  onClick={handleSendMessage}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
