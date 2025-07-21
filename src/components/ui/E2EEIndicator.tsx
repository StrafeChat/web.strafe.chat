import { Component, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Tooltip } from "../common/Tooltip";

// Custom Lock Icons with improved styling
const LockClosed: Component<{ class?: string }> = (props) => (
  <svg class={props.class} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/>
  </svg>
);

const LockOpen: Component<{ class?: string }> = (props) => (
  <svg class={props.class} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM18 20H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/>
  </svg>
);

const LockAlert: Component<{ class?: string }> = (props) => (
  <svg class={props.class} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10z"/>
    <circle cx="12" cy="15" r="1" fill="white"/>
    <path d="M12 12v2" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
  </svg>
);

const LockLoading: Component<{ class?: string }> = (props) => (
  <svg class={props.class} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12a9 9 0 11-6.219-8.56"/>
    <rect x="9" y="11" width="6" height="7" rx="1"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);

type E2EEStatus = 'enabled' | 'partial' | 'disabled' | 'loading';

interface E2EEIndicatorProps {
  status: E2EEStatus;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const E2EEIndicator: Component<E2EEIndicatorProps> = (props) => {
  const sizeClasses = () => {
    switch (props.size || 'md') {
      case 'sm':
        return 'w-3 h-3';
      case 'md':
        return 'w-4 h-4';
      case 'lg':
        return 'w-5 h-5';
      default:
        return 'w-4 h-4';
    }
  };

  const getStatusInfo = () => {
    switch (props.status) {
      case 'enabled':
        return {
          icon: LockClosed,
          color: 'text-green-400 drop-shadow-sm',
          text: 'End-to-end encrypted',
          tooltip: 'Messages are end-to-end encrypted'
        };
      case 'partial':
        return {
          icon: LockAlert,
          color: 'text-yellow-400 drop-shadow-sm',
          text: 'Partially encrypted',
          tooltip: 'Some participants do not have E2EE enabled'
        };
      case 'disabled':
        return {
          icon: LockOpen,
          color: 'text-gray-500',
          text: 'Not encrypted',
          tooltip: 'Messages are not encrypted'
        };
      case 'loading':
        return {
          icon: LockLoading,
          color: 'text-blue-400 animate-spin drop-shadow-sm',
          text: 'Initializing...',
          tooltip: 'Setting up encryption...'
        };
      default:
        return {
          icon: LockOpen,
          color: 'text-gray-500',
          text: 'Unknown',
          tooltip: 'Encryption status unknown'
        };
    }
  };

  const statusInfo = () => getStatusInfo();

  return (
    <Tooltip content={statusInfo().tooltip} position="bottom">
      <div class={`flex items-center gap-1 ${props.className || ''}`}>
        <Dynamic 
          component={statusInfo().icon}
          class={`${sizeClasses()} ${statusInfo().color} transition-colors duration-200`}
        />
        <Show when={props.showText}>
          <span class={`text-xs ${statusInfo().color} transition-colors duration-200`}>
            {statusInfo().text}
          </span>
        </Show>
      </div>
    </Tooltip>
  );
};

export default E2EEIndicator;