// Audio feedback system for face recognition

class AudioFeedback {
  private audioContext: AudioContext | null = null;
  private isEnabled: boolean = true;
  private audioCache: Map<string, HTMLAudioElement> = new Map();

  constructor() {
    // Initialize audio context on user interaction
    if (typeof window !== 'undefined') {
      this.initializeAudioContext();
      this.preloadAudioFiles();
    }
  }

  private preloadAudioFiles() {
    const audioFiles = [
      'success.mp3',
      'error.mp3',
      'detection.mp3',
      'recognition.mp3'
    ];

    audioFiles.forEach(filename => {
      try {
        const audio = new Audio(`/sounds/${filename}`);
        audio.preload = 'auto';
        audio.volume = 0.5; // 50% volume
        this.audioCache.set(filename, audio);
      } catch (error) {
        console.warn(`Failed to preload audio file: ${filename}`, error);
      }
    });
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Audio context not supported:', error);
      this.isEnabled = false;
    }
  }

  private async ensureAudioContext() {
    if (!this.audioContext) {
      this.initializeAudioContext();
    }

    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.warn('Failed to resume audio context:', error);
      }
    }
  }

  private createTone(frequency: number, duration: number, type: OscillatorType = 'sine'): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isEnabled || !this.audioContext) {
        resolve();
        return;
      }

      try {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;

        // Envelope for smooth sound
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);

        oscillator.onended = () => resolve();
      } catch (error) {
        console.warn('Error creating tone:', error);
        resolve();
      }
    });
  }

  private async playAudioFile(filename: string, fallbackTone?: () => Promise<void>) {
    if (!this.isEnabled) return;

    const audio = this.audioCache.get(filename);
    if (audio) {
      try {
        // Reset audio to beginning
        audio.currentTime = 0;
        await audio.play();
        return;
      } catch (error) {
        console.warn(`Failed to play audio file: ${filename}`, error);
      }
    }

    // Fallback to synthetic tone if file not available
    if (fallbackTone) {
      await fallbackTone();
    }
  }

  async playSuccess() {
    await this.playAudioFile('success.mp3', async () => {
      await this.ensureAudioContext();
      // Success sound: ascending notes
      await this.createTone(523.25, 0.15); // C5
      await this.createTone(659.25, 0.15); // E5
      await this.createTone(783.99, 0.3);  // G5
    });
  }

  async playError() {
    await this.playAudioFile('error.mp3', async () => {
      await this.ensureAudioContext();
      // Error sound: descending notes
      await this.createTone(392, 0.2);     // G4
      await this.createTone(329.63, 0.3);  // E4
    });
  }

  async playDetection() {
    await this.playAudioFile('detection.mp3', async () => {
      await this.ensureAudioContext();
      // Detection sound: single beep
      await this.createTone(800, 0.1);
    });
  }

  async playRecognition() {
    await this.playAudioFile('recognition.mp3', async () => {
      await this.ensureAudioContext();
      // Recognition sound: double beep
      await this.createTone(1000, 0.1);
      await new Promise(resolve => setTimeout(resolve, 50));
      await this.createTone(1200, 0.1);
    });
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  isAudioEnabled(): boolean {
    return this.isEnabled && !!this.audioContext;
  }

  // Test method to check if audio files are loaded
  testAudioFiles() {
    console.log('=== AUDIO FILES STATUS ===');
    const files = ['success.mp3', 'error.mp3', 'detection.mp3', 'recognition.mp3'];

    files.forEach(filename => {
      const audio = this.audioCache.get(filename);
      if (audio) {
        console.log(`✅ ${filename}: Loaded (duration: ${audio.duration || 'unknown'}s)`);
      } else {
        console.log(`❌ ${filename}: Not loaded`);
      }
    });
  }

  // Test play all sounds
  async testAllSounds() {
    console.log('Testing all sounds...');
    await this.playSuccess();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.playError();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.playDetection();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.playRecognition();
  }
}

// Singleton instance
export const audioFeedback = new AudioFeedback();

// Utility functions
export const playSuccessSound = () => audioFeedback.playSuccess();
export const playErrorSound = () => audioFeedback.playError();
export const playDetectionSound = () => audioFeedback.playDetection();
export const playRecognitionSound = () => audioFeedback.playRecognition();

// Debug functions (available in console)
export const testAudioFiles = () => audioFeedback.testAudioFiles();
export const testAllSounds = () => audioFeedback.testAllSounds();

// Make debug functions available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).testAudioFiles = testAudioFiles;
  (window as any).testAllSounds = testAllSounds;
}
