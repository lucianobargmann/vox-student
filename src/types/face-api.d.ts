// Type definitions for face-api.js
declare module 'face-api.js' {
  export interface FaceDetection {
    box: Box;
    score: number;
  }

  export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export interface FaceLandmarks68 {
    positions: Point[];
    shift: (x: number, y: number) => FaceLandmarks68;
  }

  export interface Point {
    x: number;
    y: number;
  }

  export interface FaceDescriptor extends Float32Array {}

  export interface WithFaceDetection<T> {
    detection: FaceDetection;
  }

  export interface WithFaceLandmarks<T> {
    landmarks: FaceLandmarks68;
  }

  export interface WithFaceDescriptor<T> {
    descriptor: FaceDescriptor;
  }

  export type FullFaceDescription = WithFaceDetection<{}> & WithFaceLandmarks<{}> & WithFaceDescriptor<{}>;

  export interface FaceMatch {
    label: string;
    distance: number;
  }

  export class FaceMatcher {
    constructor(faceDescriptors: LabeledFaceDescriptors[], distanceThreshold?: number);
    findBestMatch(faceDescriptor: FaceDescriptor): FaceMatch;
  }

  export class LabeledFaceDescriptors {
    constructor(label: string, descriptors: FaceDescriptor[]);
    label: string;
    descriptors: FaceDescriptor[];
  }

  export interface NetInput {
    width: number;
    height: number;
  }

  export interface TinyFaceDetectorOptions {
    inputSize?: number;
    scoreThreshold?: number;
  }

  export interface SsdMobilenetv1Options {
    minConfidence?: number;
    maxResults?: number;
  }

  // Main API functions
  export function detectAllFaces(
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageData,
    options?: TinyFaceDetectorOptions | SsdMobilenetv1Options
  ): Promise<FaceDetection[]>;

  export function detectSingleFace(
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageData,
    options?: TinyFaceDetectorOptions | SsdMobilenetv1Options
  ): Promise<FaceDetection | undefined>;

  // Model loading
  export const nets: {
    tinyFaceDetector: {
      loadFromUri: (uri: string) => Promise<void>;
      load: () => Promise<void>;
    };
    faceLandmark68Net: {
      loadFromUri: (uri: string) => Promise<void>;
      load: () => Promise<void>;
    };
    faceRecognitionNet: {
      loadFromUri: (uri: string) => Promise<void>;
      load: () => Promise<void>;
    };
    ssdMobilenetv1: {
      loadFromUri: (uri: string) => Promise<void>;
      load: () => Promise<void>;
    };
  };

  // Utility functions
  export function euclideanDistance(arr1: Float32Array, arr2: Float32Array): number;
  export function resizeResults<T>(results: T[], dimensions: { width: number; height: number }): T[];
}
