// Global audio manager to handle audio playback across the application
class AudioManager {
  private static instance: AudioManager;
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioId: string | null = null;
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private playbackStates: Map<string, { isPlaying: boolean; currentTime: number; duration: number }> = new Map();
  private stateUpdateCallbacks: Map<string, (state: { isPlaying: boolean; currentTime: number; duration: number }) => void> = new Map();

  private constructor() {}

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public registerAudio(id: string, audioElement: HTMLAudioElement, onStateUpdate: (state: { isPlaying: boolean; currentTime: number; duration: number }) => void): void {
    this.audioElements.set(id, audioElement);
    this.stateUpdateCallbacks.set(id, onStateUpdate);
    
    // Initialize state
    const initialState = { isPlaying: false, currentTime: 0, duration: 0 };
    this.playbackStates.set(id, initialState);
    onStateUpdate(initialState);

    // Add event listeners
    const updateState = () => {
      const state = {
        isPlaying: !audioElement.paused,
        currentTime: audioElement.currentTime,
        duration: audioElement.duration || 0
      };
      this.playbackStates.set(id, state);
      onStateUpdate(state);
    };

    audioElement.addEventListener('timeupdate', updateState);
    audioElement.addEventListener('loadedmetadata', updateState);
    audioElement.addEventListener('play', updateState);
    audioElement.addEventListener('pause', updateState);
    audioElement.addEventListener('ended', updateState);
  }

  public unregisterAudio(id: string): void {
    const audioElement = this.audioElements.get(id);
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
    
    this.audioElements.delete(id);
    this.stateUpdateCallbacks.delete(id);
    this.playbackStates.delete(id);
    
    if (this.currentAudioId === id) {
      this.currentAudio = null;
      this.currentAudioId = null;
    }
  }

  public play(id: string): void {
    const audioElement = this.audioElements.get(id);
    if (!audioElement) return;

    // Stop currently playing audio if different
    if (this.currentAudio && this.currentAudioId !== id) {
      this.currentAudio.pause();
      this.updateStateForAudio(this.currentAudioId!);
    }

    // Play the requested audio
    this.currentAudio = audioElement;
    this.currentAudioId = id;
    audioElement.play().catch(console.error);
  }

  public pause(id: string): void {
    const audioElement = this.audioElements.get(id);
    if (!audioElement) return;

    audioElement.pause();
    
    if (this.currentAudioId === id) {
      this.currentAudio = null;
      this.currentAudioId = null;
    }
  }

  public toggle(id: string): void {
    const state = this.playbackStates.get(id);
    if (!state) return;

    if (state.isPlaying) {
      this.pause(id);
    } else {
      this.play(id);
    }
  }

  public setCurrentTime(id: string, time: number): void {
    const audioElement = this.audioElements.get(id);
    if (!audioElement) return;

    audioElement.currentTime = time;
    this.updateStateForAudio(id);
  }

  public setVolume(id: string, volume: number): void {
    const audioElement = this.audioElements.get(id);
    if (!audioElement) return;

    audioElement.volume = volume;
  }

  public getState(id: string): { isPlaying: boolean; currentTime: number; duration: number } | null {
    return this.playbackStates.get(id) || null;
  }

  private updateStateForAudio(id: string): void {
    const audioElement = this.audioElements.get(id);
    const callback = this.stateUpdateCallbacks.get(id);
    
    if (audioElement && callback) {
      const state = {
        isPlaying: !audioElement.paused,
        currentTime: audioElement.currentTime,
        duration: audioElement.duration || 0
      };
      this.playbackStates.set(id, state);
      callback(state);
    }
  }

  public stopAll(): void {
    this.audioElements.forEach((audio, id) => {
      audio.pause();
      this.updateStateForAudio(id);
    });
    this.currentAudio = null;
    this.currentAudioId = null;
  }
}

export const audioManager = AudioManager.getInstance();
export default audioManager;