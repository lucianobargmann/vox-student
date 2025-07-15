'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface WhatsAppQRCodeProps {
  qrCodeData: string;
  className?: string;
}

export function WhatsAppQRCode({ qrCodeData, className = '' }: WhatsAppQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateQRCode = async () => {
      if (!canvasRef.current || !qrCodeData) return;

      try {
        setIsLoading(true);
        setError(null);

        await QRCode.toCanvas(canvasRef.current, qrCodeData, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Error generating QR code:', err);
        setError('Erro ao gerar QR Code');
        setIsLoading(false);
      }
    };

    generateQRCode();
  }, [qrCodeData]);

  if (error) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <p className="text-red-800 text-sm">❌ {error}</p>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-white border border-gray-200 rounded-lg ${className}`}>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          📱 Conectar WhatsApp
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Escaneie este QR Code com seu WhatsApp para conectar
        </p>
        
        <div className="flex justify-center mb-4">
          {isLoading ? (
            <div className="w-64 h-64 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <canvas 
              ref={canvasRef} 
              className="border border-gray-200 rounded-lg shadow-sm"
            />
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>1. Abra o WhatsApp no seu celular</p>
          <p>2. Toque em ⋮ (menu) → Dispositivos conectados</p>
          <p>3. Toque em "Conectar um dispositivo"</p>
          <p>4. Escaneie este QR Code</p>
        </div>
      </div>
    </div>
  );
}
