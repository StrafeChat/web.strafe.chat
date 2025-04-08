/**
 * Utility functions for code block functionality
 */

/**
 * Checks if text contains an unclosed code block
 * @param text The text to check for unclosed code blocks
 * @returns True if the text contains an unclosed code block
 */
export const hasUnclosedCodeBlock = (text: string): boolean => {
  if (!text) return false;
  
  // Count the number of code block markers (```) in the text
  const codeBlockMarkers = text.match(/```/g) || [];
  
  // If there's an odd number of markers, we have an unclosed block
  if (codeBlockMarkers.length % 2 !== 0) {
    return true;
  }
  
  // Check for specific case where we have balanced markers but the last one is opening a new block
  // This happens when the text ends with a code block marker
  if (codeBlockMarkers.length > 0 && text.trim().endsWith('```')) {
    // Check if this is an opening or closing marker
    // Count the number of markers before this one to determine if it's opening or closing
    const textBeforeLastMarker = text.substring(0, text.lastIndexOf('```'));
    const markersBeforeLast = textBeforeLastMarker.match(/```/g) || [];
    
    // If we have an even number of markers before the last one, the last one is opening a new block
    return markersBeforeLast.length % 2 === 0;
  }
  
  return false;
};

/**
 * Provides visual feedback when a user is typing in an unclosed code block
 * @param element The input element to add the visual indicator to
 * @param hasUnclosedBlock Whether there is an unclosed code block
 */
export const updateCodeBlockIndicator = (element: HTMLElement, hasUnclosedBlock: boolean): void => {
  // Add or remove a class to indicate unclosed code block
  if (hasUnclosedBlock) {
    element.classList.add('in-code-block');
  } else {
    element.classList.remove('in-code-block');
  }
};

/**
 * Initializes copy buttons for all code blocks on the page
 */
export const initializeCodeBlockCopyButtons = (): void => {
  // Find all code blocks
  const codeBlocks = document.querySelectorAll('.markdown-pre');
  
  // Add copy button to each code block
  codeBlocks.forEach((codeBlock) => {
    // Skip if already has a copy button
    if (codeBlock.querySelector('.copy-button')) return;
    
    // Create copy button
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.setAttribute('aria-label', 'Copy code to clipboard');
    
    // Create SVG icon for copy button
    const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgIcon.setAttribute('width', '16');
    svgIcon.setAttribute('height', '16');
    svgIcon.setAttribute('viewBox', '0 0 24 24');
    svgIcon.setAttribute('fill', 'none');
    svgIcon.setAttribute('stroke', 'currentColor');
    svgIcon.setAttribute('stroke-width', '2');
    svgIcon.setAttribute('stroke-linecap', 'round');
    svgIcon.setAttribute('stroke-linejoin', 'round');
    
    // Create path for the copy icon
    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path1.setAttribute('d', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2');
    
    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path2.setAttribute('d', 'M14 2H10a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z');
    
    // Append paths to SVG
    svgIcon.appendChild(path1);
    svgIcon.appendChild(path2);
    
    // Append SVG to button
    copyButton.appendChild(svgIcon);
    
    // Add click event listener
    copyButton.addEventListener('click', () => {
      // Get the code text
      const codeElement = codeBlock.querySelector('code');
      if (!codeElement) return;
      
      // Copy to clipboard
      navigator.clipboard.writeText(codeElement.textContent || '')
        .then(() => {
          // Show success state
          // Replace SVG with checkmark icon for success state
          copyButton.innerHTML = '';
          const checkIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          checkIcon.setAttribute('width', '16');
          checkIcon.setAttribute('height', '16');
          checkIcon.setAttribute('viewBox', '0 0 24 24');
          checkIcon.setAttribute('fill', 'none');
          checkIcon.setAttribute('stroke', 'currentColor');
          checkIcon.setAttribute('stroke-width', '2');
          checkIcon.setAttribute('stroke-linecap', 'round');
          checkIcon.setAttribute('stroke-linejoin', 'round');
          
          const checkPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          checkPath.setAttribute('d', 'M20 6L9 17l-5-5');
          checkIcon.appendChild(checkPath);
          copyButton.appendChild(checkIcon);
          copyButton.classList.add('copied');
          
          // Reset after 2 seconds
          setTimeout(() => {
            // Restore original copy icon
            copyButton.innerHTML = '';
            const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgIcon.setAttribute('width', '16');
            svgIcon.setAttribute('height', '16');
            svgIcon.setAttribute('viewBox', '0 0 24 24');
            svgIcon.setAttribute('fill', 'none');
            svgIcon.setAttribute('stroke', 'currentColor');
            svgIcon.setAttribute('stroke-width', '2');
            svgIcon.setAttribute('stroke-linecap', 'round');
            svgIcon.setAttribute('stroke-linejoin', 'round');
            
            const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path1.setAttribute('d', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2');
            
            const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path2.setAttribute('d', 'M14 2H10a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z');
            
            svgIcon.appendChild(path1);
            svgIcon.appendChild(path2);
            copyButton.appendChild(svgIcon);
            copyButton.classList.remove('copied');
          }, 2000);
        })
        .catch((error) => {
          console.error('Failed to copy code:', error);
          
          // Replace SVG with error icon
          copyButton.innerHTML = '';
          const errorIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          errorIcon.setAttribute('width', '16');
          errorIcon.setAttribute('height', '16');
          errorIcon.setAttribute('viewBox', '0 0 24 24');
          errorIcon.setAttribute('fill', 'none');
          errorIcon.setAttribute('stroke', 'currentColor');
          errorIcon.setAttribute('stroke-width', '2');
          errorIcon.setAttribute('stroke-linecap', 'round');
          errorIcon.setAttribute('stroke-linejoin', 'round');
          
          const errorPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          errorPath1.setAttribute('d', 'M18 6L6 18');
          
          const errorPath2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          errorPath2.setAttribute('d', 'M6 6l12 12');
          
          errorIcon.appendChild(errorPath1);
          errorIcon.appendChild(errorPath2);
          copyButton.appendChild(errorIcon);
          
          // Reset after 2 seconds
          setTimeout(() => {
            // Restore original copy icon
            copyButton.innerHTML = '';
            const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgIcon.setAttribute('width', '16');
            svgIcon.setAttribute('height', '16');
            svgIcon.setAttribute('viewBox', '0 0 24 24');
            svgIcon.setAttribute('fill', 'none');
            svgIcon.setAttribute('stroke', 'currentColor');
            svgIcon.setAttribute('stroke-width', '2');
            svgIcon.setAttribute('stroke-linecap', 'round');
            svgIcon.setAttribute('stroke-linejoin', 'round');
            
            const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path1.setAttribute('d', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2');
            
            const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path2.setAttribute('d', 'M14 2H10a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z');
            
            svgIcon.appendChild(path1);
            svgIcon.appendChild(path2);
            copyButton.appendChild(svgIcon);
          }, 2000);
        });
    });
    
    // Append button to code block
    codeBlock.appendChild(copyButton);
  });
};

/**
 * Shows the copy button when hovering over a code block
 */
export const initializeCodeBlockHoverEffects = (): void => {
  // Find all code blocks
  const codeBlocks = document.querySelectorAll('.markdown-pre');
  
  // Add hover event listeners to each code block
  codeBlocks.forEach((codeBlock) => {
    const copyButton = codeBlock.querySelector('.copy-button');
    if (!copyButton) return;
    
    // Show button on hover
    codeBlock.addEventListener('mouseenter', () => {
      (copyButton as HTMLElement).style.opacity = '1';
    });
    
    // Hide button when not hovering
    codeBlock.addEventListener('mouseleave', () => {
      // Don't hide if button is in 'copied' state
      if (!copyButton.classList.contains('copied')) {
        (copyButton as HTMLElement).style.opacity = '0';
      }
    });
  });
};