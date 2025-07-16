import { stopMediaStream, clearVideoElement, stopCameraCompletely, getActiveTracksInfo } from '../camera-utils';

// Mock MediaStreamTrack
class MockMediaStreamTrack {
  kind: string;
  readyState: 'live' | 'ended' = 'live';
  
  constructor(kind: string) {
    this.kind = kind;
  }
  
  stop() {
    this.readyState = 'ended';
  }
}

// Mock MediaStream
class MockMediaStream {
  private tracks: MockMediaStreamTrack[] = [];
  
  constructor(tracks: MockMediaStreamTrack[]) {
    this.tracks = tracks;
  }
  
  getTracks() {
    return this.tracks;
  }
  
  removeTrack(track: MockMediaStreamTrack) {
    const index = this.tracks.indexOf(track);
    if (index > -1) {
      this.tracks.splice(index, 1);
    }
  }
}

// Mock HTMLVideoElement
class MockVideoElement {
  srcObject: any = null;
  src: string = '';
  paused: boolean = false;
  onloadedmetadata: any = null;
  onerror: any = null;
  onplay: any = null;
  onpause: any = null;
  
  pause() {
    this.paused = true;
  }
  
  load() {
    // Mock implementation
  }
}

describe('camera-utils', () => {
  beforeEach(() => {
    // Clear console logs for clean test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('stopMediaStream', () => {
    it('should stop all tracks in a stream', () => {
      const videoTrack = new MockMediaStreamTrack('video');
      const audioTrack = new MockMediaStreamTrack('audio');
      const stream = new MockMediaStream([videoTrack, audioTrack]) as any;

      stopMediaStream(stream);

      expect(videoTrack.readyState).toBe('ended');
      expect(audioTrack.readyState).toBe('ended');
    });

    it('should handle null stream gracefully', () => {
      expect(() => stopMediaStream(null)).not.toThrow();
    });

    it('should handle stream with no tracks', () => {
      const stream = new MockMediaStream([]) as any;
      expect(() => stopMediaStream(stream)).not.toThrow();
    });
  });

  describe('clearVideoElement', () => {
    it('should clear video element properties', () => {
      const video = new MockVideoElement() as any;
      video.srcObject = 'some-stream';
      video.src = 'some-src';
      video.onloadedmetadata = () => {};

      clearVideoElement(video);

      expect(video.srcObject).toBe(null);
      expect(video.src).toBe('');
      expect(video.onloadedmetadata).toBe(null);
    });

    it('should handle null video element gracefully', () => {
      expect(() => clearVideoElement(null)).not.toThrow();
    });
  });

  describe('stopCameraCompletely', () => {
    it('should stop stream and clear video element', () => {
      const videoTrack = new MockMediaStreamTrack('video');
      const stream = new MockMediaStream([videoTrack]) as any;
      const video = new MockVideoElement() as any;
      video.srcObject = stream;

      stopCameraCompletely(stream, video);

      expect(videoTrack.readyState).toBe('ended');
      expect(video.srcObject).toBe(null);
    });
  });

  describe('getActiveTracksInfo', () => {
    it('should return correct track info', () => {
      const videoTrack = new MockMediaStreamTrack('video');
      const audioTrack = new MockMediaStreamTrack('audio');
      audioTrack.stop(); // End one track
      
      const stream = new MockMediaStream([videoTrack, audioTrack]) as any;
      
      const info = getActiveTracksInfo(stream);
      expect(info).toBe('Total: 2, Active: 1, Ended: 1');
    });

    it('should handle null stream', () => {
      const info = getActiveTracksInfo(null);
      expect(info).toBe('No stream');
    });
  });
});
