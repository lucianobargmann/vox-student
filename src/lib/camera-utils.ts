/**
 * Utility functions for camera management
 */

/**
 * Safely stops all tracks in a MediaStream and ensures camera LED is turned off
 */
export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;

  console.log('Stopping media stream...');
  
  // Get all tracks
  const tracks = stream.getTracks();
  
  if (tracks.length === 0) {
    console.log('No tracks found in stream');
    return;
  }

  // Stop each track
  tracks.forEach((track, index) => {
    console.log(`Stopping track ${index + 1}/${tracks.length}: ${track.kind} (state: ${track.readyState})`);
    
    if (track.readyState !== 'ended') {
      track.stop();
      
      // Verify track is stopped
      setTimeout(() => {
        if (track.readyState !== 'ended') {
          console.warn(`Track ${track.kind} still not ended after stop(), forcing...`);
          try {
            track.stop();
          } catch (error) {
            console.error('Error force-stopping track:', error);
          }
        } else {
          console.log(`✅ Track ${track.kind} successfully stopped`);
        }
      }, 50);
    } else {
      console.log(`Track ${track.kind} already ended`);
    }
  });

  // Additional cleanup - remove all tracks from stream
  tracks.forEach(track => {
    try {
      stream.removeTrack(track);
    } catch (error) {
      // Some browsers don't support removeTrack
      console.log('removeTrack not supported, skipping...');
    }
  });

  console.log('Media stream cleanup completed');
}

/**
 * Safely clears a video element and its associated stream
 */
export function clearVideoElement(videoElement: HTMLVideoElement | null): void {
  if (!videoElement) return;

  console.log('Clearing video element...');

  // Pause the video
  if (!videoElement.paused) {
    videoElement.pause();
  }

  // Clear the source
  videoElement.srcObject = null;
  videoElement.src = '';

  // Remove event listeners
  videoElement.onloadedmetadata = null;
  videoElement.onerror = null;
  videoElement.onplay = null;
  videoElement.onpause = null;

  // Force load to clear any cached data
  try {
    videoElement.load();
  } catch (error) {
    console.log('Error calling video.load():', error);
  }

  console.log('Video element cleared');
}

/**
 * Complete camera cleanup - stops stream and clears video element
 */
export function stopCameraCompletely(
  stream: MediaStream | null, 
  videoElement: HTMLVideoElement | null
): void {
  console.log('Performing complete camera cleanup...');
  
  stopMediaStream(stream);
  clearVideoElement(videoElement);
  
  // Additional check after a delay
  setTimeout(() => {
    if (stream) {
      const remainingTracks = stream.getTracks().filter(track => track.readyState === 'live');
      if (remainingTracks.length > 0) {
        console.warn(`${remainingTracks.length} tracks still active after cleanup, forcing stop...`);
        remainingTracks.forEach(track => {
          try {
            track.stop();
          } catch (error) {
            console.error('Error in final track cleanup:', error);
          }
        });
      } else {
        console.log('✅ All camera tracks successfully stopped');
      }
    }
  }, 200);
}

/**
 * Check if any camera tracks are still active
 */
export function hasActiveCameraTracks(): boolean {
  return navigator.mediaDevices.getUserMedia !== undefined;
}

/**
 * Get active media tracks info for debugging
 */
export function getActiveTracksInfo(stream: MediaStream | null): string {
  if (!stream) return 'No stream';
  
  const tracks = stream.getTracks();
  const activeCount = tracks.filter(track => track.readyState === 'live').length;
  const endedCount = tracks.filter(track => track.readyState === 'ended').length;
  
  return `Total: ${tracks.length}, Active: ${activeCount}, Ended: ${endedCount}`;
}
