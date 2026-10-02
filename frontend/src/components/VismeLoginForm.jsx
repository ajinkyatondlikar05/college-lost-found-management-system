import { useEffect, useRef } from 'react';

const VISME_SCRIPT_SRC = 'https://static-bundles.visme.co/forms/vismeforms-embed.js';
const VISME_SCRIPT_ID = 'visme-forms-script';

export default function VismeLoginForm() {
  const containerRef = useRef(null);

  useEffect(() => {
    // Remove any previously injected Visme script to force a fresh initialisation
    // when navigating back to this component.
    const existing = document.getElementById(VISME_SCRIPT_ID);
    if (existing) {
      existing.remove();
    }

    // Inject the Visme embed script
    const script = document.createElement('script');
    script.id = VISME_SCRIPT_ID;
    script.src = VISME_SCRIPT_SRC;
    script.async = true;
    document.body.appendChild(script);

    // Cleanup: remove script on unmount so it doesn't stack on navigation
    return () => {
      const s = document.getElementById(VISME_SCRIPT_ID);
      if (s) s.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="visme_d"
      data-title="Business Registration Form"
      data-url="8kvg17yv-business-registration-form?fullPage=true"
      data-domain="forms"
      data-full-page="true"
      data-min-height="100vh"
      data-form-id="192190"
      style={{ width: '100%', minHeight: '100vh' }}
    />
  );
}
