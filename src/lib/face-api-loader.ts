// Dynamic import to avoid SSR issues
let faceapi: any = null;
let modelsLoaded = false;

async function getFaceApi() {
  if (!faceapi && typeof window !== 'undefined') {
    faceapi = await import('face-api.js');
  }
  return faceapi;
}

export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded || typeof window === 'undefined') {
    console.log('Models already loaded or not in browser environment');
    return;
  }

  try {
    console.log('Loading face-api.js models...');

    const faceApiModule = await getFaceApi();
    if (!faceApiModule) {
      throw new Error('face-api.js not available');
    }

    // Load models from public/models directory
    const MODEL_URL = '/models';

    console.log('Loading individual models...');
    await Promise.all([
      faceApiModule.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceApiModule.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceApiModule.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceApiModule.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
    ]);

    // Verify models are loaded
    const allLoaded = [
      faceApiModule.nets.tinyFaceDetector.isLoaded,
      faceApiModule.nets.faceLandmark68Net.isLoaded,
      faceApiModule.nets.faceRecognitionNet.isLoaded,
      faceApiModule.nets.ssdMobilenetv1.isLoaded
    ].every(Boolean);

    if (!allLoaded) {
      throw new Error('Not all models loaded successfully');
    }

    modelsLoaded = true;
    console.log('Modelos face-api.js carregados com sucesso');
  } catch (error) {
    console.error('Erro ao carregar modelos face-api.js:', error);
    modelsLoaded = false;
    throw new Error('Falha ao carregar modelos de reconhecimento facial');
  }
}

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

// Factory functions for options (created dynamically)
export async function getFaceDetectionOptions() {
  const faceApiModule = await getFaceApi();
  if (!faceApiModule) return null;

  return new faceApiModule.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.5
  });
}

export async function getFaceDetectionOptionsAccurate() {
  const faceApiModule = await getFaceApi();
  if (!faceApiModule) return null;

  return new faceApiModule.SsdMobilenetv1Options({
    minConfidence: 0.5,
    maxResults: 10
  });
}

// Distance threshold for face matching (lower = more strict)
export const FACE_MATCH_THRESHOLD = 0.6;

// Export the face-api module getter
export { getFaceApi as faceapi };
