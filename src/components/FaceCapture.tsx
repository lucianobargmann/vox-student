'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, RotateCcw, Check, X } from 'lucide-react';
import { loadFaceApiModels, faceapi, getFaceDetectionOptions } from '@/lib/face-api-loader';
import { toast } from 'sonner';
import { playSuccessSound, playErrorSound, playDetectionSound } from '@/lib/audio-feedback';

interface FaceCaptureProps {
  onFaceDetected?: (faceDescriptor: Float32Array, imageData: string) => void;
  onError?: (error: string) => void;
  isCapturing?: boolean;
  showPreview?: boolean;
  className?: string;
}

export function FaceCapture({
  onFaceDetected,
  onError,
  isCapturing = false,
  showPreview = true,
  className = ''
}: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Debug: Log camera state changes
  useEffect(() => {
    console.log('Camera state changed:', { isCameraActive, isCapturing });
  }, [isCameraActive, isCapturing]);

  // Initialize face-api models
  useEffect(() => {
    const initModels = async () => {
      try {
        setIsLoading(true);
        console.log('Starting to load face-api models...');
        await loadFaceApiModels();
        console.log('Face-api models loaded successfully');
        setIsModelLoaded(true);
        toast.success('Modelos de reconhecimento carregados!');
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

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      console.log('Starting camera...');

      // Show video element first
      setShowVideo(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      console.log('Camera stream obtained');
      streamRef.current = stream;

      // Wait a bit for the video element to be rendered
      setTimeout(() => {
        console.log('videoRef.current exists:', !!videoRef.current);

        if (videoRef.current) {
          console.log('Assigning stream to video element...');
          videoRef.current.srcObject = stream;

          console.log('Stream assigned to video element');

          // Set camera active
          setIsCameraActive(true);
          console.log('Camera set to active');

          // Also try the metadata approach as backup
          videoRef.current.onloadedmetadata = () => {
            console.log('Video metadata loaded');
          };
        } else {
          console.error('videoRef.current is still null after timeout!');
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
    console.log('Stopping camera...');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.onloadedmetadata = null; // Clear listener
    }
    setIsCameraActive(false);
    setShowVideo(false);
    setFaceDetected(false);
  }, []);

  // Detect faces in video stream
  const detectFaces = useCallback(async () => {
    if (!videoRef.current || !isModelLoaded || !isCameraActive) {
      console.log('Detection skipped:', {
        hasVideo: !!videoRef.current,
        isModelLoaded,
        isCameraActive
      });
      return;
    }

    // Additional check: make sure video is actually playing
    if (videoRef.current.readyState < 2) {
      console.log('Video not ready yet, readyState:', videoRef.current.readyState);
      return;
    }

    try {
      console.log('Starting face detection...');
      const faceApiModule = await faceapi();
      const options = await getFaceDetectionOptions();

      if (!faceApiModule || !options) {
        console.log('Face API module or options not available');
        return;
      }

      console.log('Detecting faces...');
      const detections = await faceApiModule
        .detectAllFaces(videoRef.current, options)
        .withFaceLandmarks()
        .withFaceDescriptors();

      console.log('Detections found:', detections.length);

      const wasDetected = faceDetected;
      const isDetected = detections.length > 0;
      setFaceDetected(isDetected);

      // Note: Removed automatic detection sound to avoid noise
      // Sound will only play on successful capture or recognition

      // Draw detections on canvas if preview is enabled
      if (showPreview && canvasRef.current) {
        const canvas = canvasRef.current;
        const displaySize = {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        };
        
        faceApiModule.matchDimensions(canvas, displaySize);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (detections.length > 0) {
            const resizedDetections = faceApiModule.resizeResults(detections, displaySize);
            faceApiModule.draw.drawDetections(canvas, resizedDetections);
            faceApiModule.draw.drawFaceLandmarks(canvas, resizedDetections);
          }
        }
      }
    } catch (error) {
      console.error('Error detecting faces:', error);
    }
  }, [isModelLoaded, isCameraActive, showPreview]);

  // Capture face
  const captureFace = useCallback(async () => {
    if (!videoRef.current || !isModelLoaded || !faceDetected) return;

    try {
      const faceApiModule = await faceapi();
      const options = await getFaceDetectionOptions();

      if (!faceApiModule || !options) return;

      const detections = await faceApiModule
        .detectSingleFace(videoRef.current, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detections) {
        toast.error('Nenhum rosto detectado. Tente novamente.');
        return;
      }

      // Capture image data
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);

      // Call callback with face descriptor and image
      onFaceDetected?.(detections.descriptor, imageData);

      // Play success sound and show toast
      playSuccessSound();
      toast.success('Rosto capturado com sucesso!');
    } catch (error) {
      console.error('Error capturing face:', error);
      onError?.('Erro ao capturar rosto');
      playErrorSound();
      toast.error('Erro ao capturar rosto. Tente novamente.');
    }
  }, [isModelLoaded, faceDetected, onFaceDetected, onError]);

  // Face detection loop
  useEffect(() => {
    if (!isCameraActive || !isCapturing) {
      console.log('Detection loop not started:', { isCameraActive, isCapturing });
      return;
    }

    console.log('Starting detection loop...');
    const interval = setInterval(detectFaces, 500); // Increased to 500ms for better performance
    return () => {
      console.log('Stopping detection loop...');
      clearInterval(interval);
    };
  }, [isCameraActive, isCapturing, detectFaces]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const resetCapture = () => {
    setCapturedImage(null);
    setFaceDetected(false);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Carregando modelos de reconhecimento...</p>
          <p className="text-xs text-gray-500 mt-1">Isso pode levar alguns segundos...</p>
        </div>
      </div>
    );
  }

  if (!isModelLoaded) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-2">⚠️</div>
          <p className="text-sm text-gray-600">Modelos não carregados</p>
          <p className="text-xs text-gray-500 mt-1">Verifique o console para erros</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Camera Controls */}
      <div className="flex items-center justify-center space-x-2">
        {!isCameraActive ? (
          <Button onClick={startCamera} disabled={!isModelLoaded}>
            <Camera className="w-4 h-4 mr-2" />
            Iniciar Câmera
          </Button>
        ) : (
          <Button onClick={stopCamera} variant="outline">
            <CameraOff className="w-4 h-4 mr-2" />
            Parar Câmera
          </Button>
        )}
        
        {capturedImage && (
          <Button onClick={resetCapture} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Nova Captura
          </Button>
        )}
      </div>

      {/* Camera Preview */}
      {showVideo && !capturedImage && (
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
          
          {showPreview && (
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full"
            />
          )}
          
          {/* Face Detection Indicator */}
          <div className="absolute top-2 right-2">
            {faceDetected ? (
              <div className="flex items-center space-x-1 bg-green-500 text-white px-2 py-1 rounded text-xs">
                <Check className="w-3 h-3" />
                <span>Rosto detectado</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 bg-red-500 text-white px-2 py-1 rounded text-xs">
                <X className="w-3 h-3" />
                <span>Posicione seu rosto</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Captured Image Preview */}
      {capturedImage && (
        <div className="text-center">
          <img
            src={capturedImage}
            alt="Captured face"
            className="w-full max-w-md mx-auto rounded-lg border"
          />
          <p className="text-sm text-green-600 mt-2">Rosto capturado com sucesso!</p>
        </div>
      )}

      {/* Capture Button */}
      {isCameraActive && !capturedImage && (
        <div className="text-center">
          <Button
            onClick={captureFace}
            disabled={!faceDetected}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Camera className="w-4 h-4 mr-2" />
            Capturar Rosto
          </Button>
          {!faceDetected && (
            <p className="text-xs text-gray-500 mt-1">
              Posicione seu rosto na câmera para habilitar a captura
            </p>
          )}
        </div>
      )}
    </div>
  );
}
