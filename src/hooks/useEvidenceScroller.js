import { useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';

export default function useEvidenceScroller() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const evidenceId = searchParams.get('evidence');
    if (!evidenceId) return;

    let attempts = 0;
    const maxAttempts = 20; // 2 seconds total with 100ms interval
    let retryInterval;

    const tryHighlight = () => {
      const targetId = `evidence-${evidenceId}`;
      const element = document.getElementById(targetId);

      if (element) {
        // Element found, clear interval
        clearInterval(retryInterval);

        // Scroll to the element
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Add highlight class
        element.classList.add('highlight-evidence');

        // Remove highlight class after animation duration (2s)
        setTimeout(() => {
          element.classList.remove('highlight-evidence');
        }, 2000);

        // Clear the query parameter safely without adding to history
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('evidence');
        const newSearch = newSearchParams.toString();
        
        navigate(`${location.pathname}${newSearch ? '?' + newSearch : ''}${location.hash}`, { 
          replace: true 
        });

      } else {
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(retryInterval);
          // Graceful fallback if evidence doesn't exist
          console.warn(`Referenced evidence ${evidenceId} is no longer available in the DOM.`);
          // Optional: Could trigger a non-blocking toast here
          
          // Clear param so it doesn't stay stuck
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete('evidence');
          const newSearch = newSearchParams.toString();
          
          navigate(`${location.pathname}${newSearch ? '?' + newSearch : ''}${location.hash}`, { 
            replace: true 
          });
        }
      }
    };

    // Initial check
    tryHighlight();
    
    // Bounded retry if not found immediately (helps with React suspense/lazy loading)
    if (!document.getElementById(`evidence-${evidenceId}`)) {
      retryInterval = setInterval(tryHighlight, 100);
    }

    return () => {
      if (retryInterval) clearInterval(retryInterval);
    };
  }, [searchParams, navigate, location]);
}
