/**
 * Offscreen Document for Clipboard Operations
 * 
 * Per Midori's Migration Guide Section 2.4:
 * Service workers cannot access DOM APIs like navigator.clipboard.
 * Offscreen documents provide DOM context for clipboard operations.
 */

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target !== 'offscreen') {
    return false;
  }

  if (request.type === 'copy-to-clipboard') {
    // Use the Clipboard API in the offscreen document context
    navigator.clipboard.writeText(request.text)
      .then(() => {
        console.log('LinkSlinger: Successfully copied to clipboard');
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('LinkSlinger: Failed to copy to clipboard:', error);
        // Fallback to execCommand if Clipboard API fails
        try {
          const textArea = document.createElement('textarea');
          textArea.value = request.text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          sendResponse({ success: true, fallback: true });
        } catch (fallbackError) {
          console.error('LinkSlinger: Fallback copy also failed:', fallbackError);
          sendResponse({ success: false, error: fallbackError.message });
        }
      });
    
    return true; // Keep channel open for async response
  }

  return false;
});
