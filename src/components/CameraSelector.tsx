'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, RotateCcw, AlertCircle } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';

interface CameraSelectorProps {
  onCameraChange?: (deviceId: string | null) => void;
  className?: string;
}

export function CameraSelector({ onCameraChange, className = '' }: CameraSelectorProps) {
  const { 
    cameras, 
    selectedCameraId, 
    isLoading, 
    error, 
    setSelectedCamera, 
    refreshCameras, 
    hasMultipleCameras 
  } = useCamera();

  const handleCameraChange = (deviceId: string) => {
    setSelectedCamera(deviceId);
    onCameraChange?.(deviceId);
  };

  const handleRefresh = async () => {
    await refreshCameras();
    onCameraChange?.(selectedCameraId);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-600">Detectando câmeras...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center space-x-2 text-red-600 ${className}`}>
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">{error}</span>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RotateCcw className="w-3 h-3 mr-1" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (cameras.length === 0) {
    return (
      <div className={`flex items-center space-x-2 text-gray-500 ${className}`}>
        <Camera className="w-4 h-4" />
        <span className="text-sm">Nenhuma câmera encontrada</span>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RotateCcw className="w-3 h-3 mr-1" />
          Atualizar
        </Button>
      </div>
    );
  }

  if (!hasMultipleCameras) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Camera className="w-4 h-4 text-green-600" />
        <span className="text-sm text-gray-600">{cameras[0].label}</span>
        <Badge variant="outline" className="text-xs">
          1 câmera
        </Badge>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RotateCcw className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Camera className="w-4 h-4 text-green-600" />
      <Select value={selectedCameraId || ''} onValueChange={handleCameraChange}>
        <SelectTrigger className="w-[200px] h-8 text-sm">
          <SelectValue placeholder="Selecionar câmera" />
        </SelectTrigger>
        <SelectContent>
          {cameras.map((camera) => (
            <SelectItem key={camera.deviceId} value={camera.deviceId}>
              {camera.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Badge variant="outline" className="text-xs">
        {cameras.length} câmeras
      </Badge>
      <Button onClick={handleRefresh} variant="outline" size="sm">
        <RotateCcw className="w-3 h-3" />
      </Button>
    </div>
  );
}