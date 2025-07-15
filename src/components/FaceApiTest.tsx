'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { loadFaceApiModels, areModelsLoaded } from '@/lib/face-api-loader';
import { toast } from 'sonner';

export function FaceApiTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setModelsLoaded(areModelsLoaded());
  }, []);

  const testFaceApi = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await loadFaceApiModels();
      setModelsLoaded(true);
      toast.success('Face-api.js models loaded successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast.error(`Error loading models: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Face-API Test</h3>
      
      <div className="space-y-4">
        <div>
          <strong>Status:</strong>{' '}
          {modelsLoaded ? (
            <span className="text-green-600">Models Loaded ✓</span>
          ) : (
            <span className="text-red-600">Models Not Loaded ✗</span>
          )}
        </div>

        {error && (
          <div className="text-red-600 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="space-y-2">
          <Button
            onClick={testFaceApi}
            disabled={isLoading || modelsLoaded}
            className="w-full"
          >
            {isLoading ? 'Loading Models...' : 'Test Face-API Loading'}
          </Button>

          <Button
            onClick={() => {
              console.log('=== FACE-API DEBUG INFO ===');
              console.log('Models loaded:', modelsLoaded);
              console.log('Window available:', typeof window !== 'undefined');
              console.log('Navigator available:', typeof navigator !== 'undefined');
              console.log('getUserMedia available:', !!(navigator?.mediaDevices?.getUserMedia));
            }}
            variant="outline"
            size="sm"
            className="w-full"
          >
            Debug Info
          </Button>
        </div>

        {modelsLoaded && (
          <div className="text-green-600 text-sm">
            ✓ Face recognition is ready to use!
          </div>
        )}
      </div>
    </div>
  );
}
