'use client';

import { useState, useEffect, useCallback } from 'react';

interface CameraDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

interface UseCameraReturn {
  cameras: CameraDevice[];
  selectedCameraId: string | null;
  isLoading: boolean;
  error: string | null;
  setSelectedCamera: (deviceId: string) => void;
  refreshCameras: () => Promise<void>;
  hasMultipleCameras: boolean;
}

export function useCamera(): UseCameraReturn {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getCameras = useCallback(async (): Promise<CameraDevice[]> => {
    try {
      // Request permission to access cameras
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      return videoDevices.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Câmera ${videoDevices.indexOf(device) + 1}`,
        groupId: device.groupId
      }));
    } catch (err) {
      console.error('Error accessing cameras:', err);
      throw new Error('Erro ao acessar câmeras. Verifique as permissões.');
    }
  }, []);

  const refreshCameras = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const cameraList = await getCameras();
      setCameras(cameraList);
      
      // Auto-select first camera if none selected
      if (cameraList.length > 0 && !selectedCameraId) {
        setSelectedCameraId(cameraList[0].deviceId);
      }
      
      // If selected camera is no longer available, select first available
      if (selectedCameraId && !cameraList.find(cam => cam.deviceId === selectedCameraId)) {
        setSelectedCameraId(cameraList.length > 0 ? cameraList[0].deviceId : null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCameraId, getCameras]);

  const setSelectedCamera = useCallback((deviceId: string) => {
    setSelectedCameraId(deviceId);
  }, []);

  // Initialize cameras on mount
  useEffect(() => {
    refreshCameras();
  }, [refreshCameras]);

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      refreshCameras();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [refreshCameras]);

  return {
    cameras,
    selectedCameraId,
    isLoading,
    error,
    setSelectedCamera,
    refreshCameras,
    hasMultipleCameras: cameras.length > 1
  };
}