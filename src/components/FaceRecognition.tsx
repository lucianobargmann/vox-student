'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, CameraOff, UserCheck, Users, AlertCircle, RotateCcw } from 'lucide-react';
import { loadFaceApiModels, faceapi, getFaceDetectionOptions, FACE_MATCH_THRESHOLD } from '@/lib/face-api-loader';
import { toast } from 'sonner';
import { playSuccessSound, playErrorSound, playRecognitionSound } from '@/lib/audio-feedback';
import { FeedbackOverlay, useFeedbackMessages, RecognitionIndicator } from '@/components/FeedbackOverlay';

interface Student {
  id: string;
  name: string;
  faceDescriptor?: string;
}

interface FaceRecognitionProps {
  students: Student[];
  onStudentRecognized?: (studentId: string, confidence: number) => void;
  onError?: (error: string) => void;
  isActive?: boolean;
  className?: string;
  attendanceRecords?: Record<string, 'present' | 'absent' | 'makeup'>;
}

export function FaceRecognition({
  students,
  onStudentRecognized,
  onError,
  isActive = false,
  className = '',
  attendanceRecords = {}
}: FaceRecognitionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState<any>(null);
  const [recognizedStudents, setRecognizedStudents] = useState<Set<string>>(new Set());
  const [currentMatch, setCurrentMatch] = useState<{ name: string; confidence: number } | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [lastRecognitionTime, setLastRecognitionTime] = useState<number>(0);
  const [lastUnknownFaceTime, setLastUnknownFaceTime] = useState<number>(0);
  const feedbackMessages = useFeedbackMessages();

  // Initialize face-api models
  useEffect(() => {
    const initModels = async () => {
      try {
        setIsLoading(true);
        await loadFaceApiModels();
        setIsModelLoaded(true);
      } catch (error) {
        console.error('Error loading face-api models:', error);
        onError?.('Erro ao carregar modelos de reconhecimento facial');
        toast.error('Erro ao carregar modelos de reconhecimento facial');
      } finally {
        setIsLoading(false);
      }
    };

    initModels();
  }, [onError]);

  // Create face matcher from students data
  useEffect(() => {
    if (!isModelLoaded || !students.length) return;

    const createMatcher = async () => {
      try {
        const faceApiModule = await faceapi();
        if (!faceApiModule) return;

        const labeledDescriptors = students
          .filter(student => student.faceDescriptor)
          .map(student => {
            const descriptorArray = JSON.parse(student.faceDescriptor!);
            const descriptor = new Float32Array(descriptorArray);
            return new faceApiModule.LabeledFaceDescriptors(student.id, [descriptor]);
          });

        if (labeledDescriptors.length > 0) {
          const matcher = new faceApiModule.FaceMatcher(labeledDescriptors, FACE_MATCH_THRESHOLD);
          setFaceMatcher(matcher);
        } else {
          setFaceMatcher(null);
          toast.error('Nenhum aluno possui dados faciais cadastrados');
        }
      } catch (error) {
        console.error('Error creating face matcher:', error);
        onError?.('Erro ao processar dados faciais dos alunos');
      }
    };

    createMatcher();
  }, [isModelLoaded, students, onError]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      console.log('Starting face recognition camera...');

      // Show video element first
      setShowVideo(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      console.log('Face recognition camera stream obtained');
      streamRef.current = stream;

      // Wait for video element to be rendered
      setTimeout(() => {
        if (videoRef.current) {
          console.log('Assigning stream to face recognition video element...');
          videoRef.current.srcObject = stream;
          setIsCameraActive(true);
          console.log('Face recognition camera set to active');
        } else {
          console.error('Face recognition videoRef.current is null after timeout!');
        }
      }, 100);

    } catch (error) {
      console.error('Error accessing camera:', error);
      setShowVideo(false);
      onError?.('Erro ao acessar câmera');
      toast.error('Erro ao acessar câmera. Verifique as permissões.');
    }
  }, [onError]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setShowVideo(false);
    setCurrentMatch(null);
  }, []);

  // Recognize faces in video stream
  const recognizeFaces = useCallback(async () => {
    if (!videoRef.current || !isModelLoaded || !isCameraActive || !faceMatcher) return;

    try {
      const faceApiModule = await faceapi();
      const options = await getFaceDetectionOptions();

      if (!faceApiModule || !options) return;

      const detections = await faceApiModule
        .detectAllFaces(videoRef.current, options)
        .withFaceLandmarks()
        .withFaceDescriptors();

      // Clear canvas
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const displaySize = {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        };

        faceApiModule.matchDimensions(canvas, displaySize);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      let bestMatch: { name: string; confidence: number } | null = null;
      setFaceDetected(detections.length > 0);

      if (detections.length > 0) {
        const resizedDetections = faceApiModule.resizeResults(detections, {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        });

        // Draw detections
        if (canvasRef.current) {
          faceApiModule.draw.drawDetections(canvasRef.current, resizedDetections);
          faceApiModule.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
        }

        // Find best match
        let hasUnknownFace = false;

        for (const detection of detections) {
          const match = faceMatcher.findBestMatch(detection.descriptor);

          if (match.label !== 'unknown') {
            const confidence = 1 - match.distance;

            if (!bestMatch || confidence > bestMatch.confidence) {
              const student = students.find(s => s.id === match.label);
              if (student) {
                bestMatch = {
                  name: student.name,
                  confidence
                };

                // Auto-recognize if confidence is high enough
                if (confidence > 0.7 && !recognizedStudents.has(student.id)) {
                  // Check if student is already marked as present
                  const currentAttendance = attendanceRecords[student.id];

                  if (currentAttendance === 'present') {
                    console.log(`${student.name} already marked as present, skipping recognition`);
                    // Still add to recognized set to avoid repeated attempts
                    setRecognizedStudents(prev => new Set(prev).add(student.id));
                    return;
                  }

                  const now = Date.now();

                  // Only play sound if it's been at least 3 seconds since last recognition
                  if (now - lastRecognitionTime > 3000) {
                    setLastRecognitionTime(now);
                    playRecognitionSound();
                    feedbackMessages.addRecognition(student.name, Math.round(confidence * 100));
                  }

                  setRecognizedStudents(prev => new Set(prev).add(student.id));
                  onStudentRecognized?.(student.id, confidence);
                  toast.success(`${student.name} reconhecido automaticamente!`);
                }
              }
            }
          } else {
            // Face detected but not recognized
            hasUnknownFace = true;
          }
        }

        // Play error sound for unknown faces (but not too frequently)
        if (hasUnknownFace && !bestMatch) {
          const now = Date.now();
          if (now - lastUnknownFaceTime > 5000) { // 5 seconds cooldown for unknown faces
            setLastUnknownFaceTime(now);
            playErrorSound();
            feedbackMessages.addError('Rosto não reconhecido', { duration: 2000 });
          }
        }
      }

      setCurrentMatch(bestMatch);
    } catch (error) {
      console.error('Error recognizing faces:', error);
    }
  }, [isModelLoaded, isCameraActive, faceMatcher, students, recognizedStudents, onStudentRecognized, lastRecognitionTime, lastUnknownFaceTime]);

  // Face recognition loop
  useEffect(() => {
    if (!isCameraActive || !isActive) return;

    const interval = setInterval(recognizeFaces, 200);
    return () => clearInterval(interval);
  }, [isCameraActive, isActive, recognizeFaces]);

  // Auto-start camera when component becomes active
  useEffect(() => {
    if (isActive && isModelLoaded && faceMatcher && !isCameraActive) {
      console.log('Auto-starting face recognition camera...');
      startCamera();
    } else if (!isActive) {
      console.log('Stopping face recognition camera...');
      stopCamera();
    }
  }, [isActive, isModelLoaded, faceMatcher, isCameraActive, startCamera, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const resetRecognition = () => {
    setRecognizedStudents(new Set());
    setCurrentMatch(null);
    setLastRecognitionTime(0);
    setLastUnknownFaceTime(0);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Carregando modelos de reconhecimento...</p>
        </div>
      </div>
    );
  }

  if (!faceMatcher) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center text-gray-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Nenhum aluno possui dados faciais cadastrados</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Recognition Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {isCameraActive ? (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-600">Câmera ativa</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span className="text-sm text-gray-500">Iniciando câmera...</span>
            </div>
          )}

          <Button onClick={resetRecognition} variant="outline" size="sm">
            <RotateCcw className="w-3 h-3 mr-1" />
            Resetar
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            <Users className="w-3 h-3 mr-1" />
            {recognizedStudents.size} reconhecidos
          </Badge>
        </div>
      </div>

      {/* Camera Preview */}
      {showVideo && (
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full max-w-md mx-auto rounded-lg border"
            onLoadedMetadata={() => {
              if (canvasRef.current && videoRef.current) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
              }
            }}
          />

          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
          />

          {/* Recognition Indicator */}
          <RecognitionIndicator
            isActive={isActive}
            faceDetected={faceDetected}
            currentMatch={currentMatch}
          />
        </div>
      )}

      {/* Recognition Status */}
      {isActive && isCameraActive && (
        <div className="text-center">
          <p className="text-sm text-gray-600">
            {currentMatch
              ? `Reconhecendo: ${currentMatch.name} (${Math.round(currentMatch.confidence * 100)}%)`
              : 'Aguardando rosto...'
            }
          </p>
        </div>
      )}

      {/* Feedback Overlay */}
      <FeedbackOverlay
        messages={feedbackMessages.messages}
        onMessageExpire={feedbackMessages.removeMessage}
      />
    </div>
  );
}