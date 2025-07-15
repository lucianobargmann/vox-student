'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FaceCapture } from '@/components/FaceCapture';
import { User, Camera, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  name: string;
  email?: string;
  faceDescriptor?: string;
  photoUrl?: string;
  faceDataUpdatedAt?: string;
}

interface FaceRegistrationProps {
  student: Student;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistrationComplete?: (studentId: string) => void;
}

export function FaceRegistration({
  student,
  open,
  onOpenChange,
  onRegistrationComplete
}: FaceRegistrationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [capturedDescriptor, setCapturedDescriptor] = useState<Float32Array | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [registrationStep, setRegistrationStep] = useState<'capture' | 'confirm' | 'success'>('capture');

  const handleFaceDetected = (faceDescriptor: Float32Array, imageData: string) => {
    setCapturedDescriptor(faceDescriptor);
    setCapturedImage(imageData);
    setRegistrationStep('confirm');
  };

  const handleConfirmRegistration = async () => {
    if (!capturedDescriptor || !capturedImage) {
      toast.error('Dados faciais não capturados');
      return;
    }

    try {
      setIsLoading(true);

      const token = localStorage.getItem('auth_token');
      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      // Convert Float32Array to regular array for JSON serialization
      const descriptorArray = Array.from(capturedDescriptor);

      const response = await fetch(`/api/students/${student.id}/face-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          faceDescriptor: JSON.stringify(descriptorArray),
          photoUrl: capturedImage
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar dados faciais');
      }

      setRegistrationStep('success');
      toast.success('Dados faciais cadastrados com sucesso!');
      
      setTimeout(() => {
        onRegistrationComplete?.(student.id);
        handleClose();
      }, 2000);

    } catch (error) {
      console.error('Error saving face data:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar dados faciais');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCapturedDescriptor(null);
    setCapturedImage(null);
    setRegistrationStep('capture');
    onOpenChange(false);
  };

  const handleRetry = () => {
    setCapturedDescriptor(null);
    setCapturedImage(null);
    setRegistrationStep('capture');
  };

  const hasExistingFaceData = student.faceDescriptor && student.faceDataUpdatedAt;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="face-registration-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            {hasExistingFaceData ? 'Atualizar' : 'Cadastrar'} Dados Faciais
          </DialogTitle>
          <DialogDescription>
            {hasExistingFaceData 
              ? `Atualize os dados faciais de ${student.name}`
              : `Cadastre os dados faciais de ${student.name} para reconhecimento automático`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Student Info */}
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{student.name}</h3>
              {student.email && (
                <p className="text-sm text-gray-500">{student.email}</p>
              )}
            </div>
            {hasExistingFaceData && (
              <Badge variant="outline" className="text-green-600">
                <Check className="w-3 h-3 mr-1" />
                Cadastrado
              </Badge>
            )}
          </div>

          {/* Existing Face Data Warning */}
          {hasExistingFaceData && registrationStep === 'capture' && (
            <div className="flex items-start space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-yellow-800">
                  Este aluno já possui dados faciais cadastrados desde{' '}
                  {new Date(student.faceDataUpdatedAt!).toLocaleDateString('pt-BR')}.
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Continuar irá substituir os dados existentes.
                </p>
              </div>
            </div>
          )}

          {/* Registration Steps */}
          {registrationStep === 'capture' && (
            <div className="space-y-4">
              <div className="text-center">
                <h4 className="font-medium text-gray-900 mb-2">Captura Facial</h4>
                <p className="text-sm text-gray-600">
                  Posicione o rosto na câmera e clique em "Capturar Rosto" quando o rosto for detectado
                </p>
              </div>
              
              <FaceCapture
                onFaceDetected={handleFaceDetected}
                onError={(error) => toast.error(error)}
                isCapturing={true}
                showPreview={true}
              />
            </div>
          )}

          {registrationStep === 'confirm' && capturedImage && (
            <div className="space-y-4">
              <div className="text-center">
                <h4 className="font-medium text-gray-900 mb-2">Confirmar Cadastro</h4>
                <p className="text-sm text-gray-600">
                  Verifique se a imagem capturada está clara e bem posicionada
                </p>
              </div>

              <div className="text-center">
                <img
                  src={capturedImage}
                  alt="Face captured"
                  className="w-64 h-64 object-cover rounded-lg border mx-auto"
                />
              </div>

              <div className="flex justify-center space-x-3">
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  disabled={isLoading}
                >
                  Capturar Novamente
                </Button>
                <Button
                  onClick={handleConfirmRegistration}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Confirmar Cadastro
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {registrationStep === 'success' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Cadastro Concluído!</h4>
                <p className="text-sm text-gray-600">
                  Os dados faciais de {student.name} foram salvos com sucesso.
                  Agora o aluno pode ser reconhecido automaticamente no controle de presença.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
