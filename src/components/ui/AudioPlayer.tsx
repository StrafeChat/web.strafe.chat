import { createSignal, onMount, onCleanup } from 'solid-js';
import { Show } from 'solid-js';

interface AudioPlayerProps {
  src: string;
  name?: string;
  size?: number;
}

export const AudioPlayer = (props: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [volume, setVolume] = createSignal(1);
  const [showVolumeSlider, setShowVolumeSlider] = createSignal(false);
  let audioRef: HTMLAudioElement | undefined;
  let progressRef: HTMLDivElement;
  let volumeContainerRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!audioRef) return;
    
    const updateTime = () => setCurrentTime(audioRef!.currentTime);
    const updateDuration = () => setDuration(audioRef!.duration);
    const handleEnded = () => setIsPlaying(false);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (volumeContainerRef && !volumeContainerRef.contains(event.target as Node)) {
        setShowVolumeSlider(false);
      }
    };

    audioRef.addEventListener('timeupdate', updateTime);
    audioRef.addEventListener('loadedmetadata', updateDuration);
    audioRef.addEventListener('ended', handleEnded);
    document.addEventListener('mousedown', handleClickOutside);

    onCleanup(() => {
      if (audioRef) {
        audioRef.removeEventListener('timeupdate', updateTime);
        audioRef.removeEventListener('loadedmetadata', updateDuration);
        audioRef.removeEventListener('ended', handleEnded);
      }
      document.removeEventListener('mousedown', handleClickOutside);
    });
  });

  const togglePlay = () => {
    if (!audioRef) return;
    
    if (isPlaying()) {
      audioRef.pause();
      setIsPlaying(false);
    } else {
      audioRef.play();
      setIsPlaying(true);
    }
  };

  const handleProgressClick = (e: MouseEvent) => {
    if (!audioRef) return;
    
    const rect = progressRef!.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration();
    audioRef.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: Event) => {
    if (!audioRef) return;
    
    const target = e.target as HTMLInputElement;
    const newVolume = parseFloat(target.value);
    setVolume(newVolume);
    audioRef.volume = newVolume;
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = () => {
    if (duration() === 0) return 0;
    return (currentTime() / duration()) * 100;
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(props.src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = props.name || 'audio-file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link
      window.open(props.src, '_blank');
    }
  };

  return (
    <div class="bg-surface bg-opacity-30 border border-border rounded-lg p-4 max-w-md">
      <audio ref={audioRef!} src={props.src} preload="metadata" />
      
      {/* Audio info */}
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 bg-surface border border-border rounded-lg flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9zM7 10.5v3c0 .83-.67 1.5-1.5 1.5S4 14.33 4 13.5v-3C4 9.67 4.67 9 5.5 9S7 9.67 7 10.5zm13 3c0 .83-.67 1.5-1.5 1.5S17 14.33 17 13.5v-3c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v3z"/>
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-text-primary truncate">
            {props.name || 'Audio File'}
          </div>
          <div class="text-xs text-text-secondary flex items-center gap-2">
            <span>{formatTime(currentTime())} / {formatTime(duration())}</span>
            <Show when={props.size}>
              <span>• {(props.size! / 1024 / 1024).toFixed(2)} MB</span>
            </Show>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div class="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          class="w-8 h-8 bg-primary hover:bg-primary-dark rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50"
        >
          <Show when={isPlaying()} fallback={
            <svg class="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 5v10l8-5-8-5z" />
            </svg>
          }>
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 4a1 1 0 011 1v10a1 1 0 11-2 0V5a1 1 0 011-1zM14 4a1 1 0 011 1v10a1 1 0 11-2 0V5a1 1 0 011-1z" />
            </svg>
          </Show>
        </button>

        {/* Progress Bar */}
        <div class="flex-1 relative">
          <div
            ref={progressRef!}
            class="h-2 bg-surface bg-opacity-50 rounded-full cursor-pointer group relative overflow-hidden"
            onClick={handleProgressClick}
          >
            {/* Background track */}
            <div class="absolute inset-0 bg-border rounded-full" />
            {/* Progress fill */}
            <div
              class="h-full bg-primary rounded-full transition-all duration-150 relative z-10"
              style={{ width: `${progressPercentage()}%` }}
            >
              <div class="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
            </div>
          </div>
        </div>

        {/* Volume Control */}
        <div class="relative" ref={volumeContainerRef!}>
          <button
            onClick={() => setShowVolumeSlider(!showVolumeSlider())}
            class="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors rounded focus:outline-none"
          >
            <Show when={volume() > 0.5} fallback={
              <Show when={volume() > 0} fallback={
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.828 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.828l3.555-3.793a1 1 0 011.617.793zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" />
                </svg>
              }>
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.828 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.828l3.555-3.793a1 1 0 011.617.793zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" />
                </svg>
              </Show>
            }>
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.828 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.828l3.555-3.793a1 1 0 011.617.793zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" />
              </svg>
            </Show>
          </button>
          
          <Show when={showVolumeSlider()}>
            <div class="absolute bottom-full right-0 mb-2 bg-surface border border-border rounded-lg p-3 shadow-lg">
              <div class="relative">
                <div class="w-20 h-2 bg-border rounded-full relative overflow-hidden">
                  <div 
                    class="h-full bg-primary rounded-full transition-all duration-150"
                    style={{ width: `${volume() * 100}%` }}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume()}
                  onInput={handleVolumeChange}
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </Show>
        </div>

        {/* Download Button */}
        <button 
          onClick={handleDownload}
          class="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface hover:bg-opacity-30 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50"
          title="Download"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};
