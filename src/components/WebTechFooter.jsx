import Image from 'next/image';
import webtechLogo from '@/assets/images/webtech-logo.png';

export default function WebTechFooter({ variant = 'logo', showLinks = true, showLogo = true, compact = false }) {
  if (variant === 'bar') {
    return (
      <footer className={`webtech-footer webtech-footer-bar${compact ? ' webtech-footer-compact' : ''}`}>
        <p className="webtech-footer-copy">
          {showLinks ? (
            <>
              © WebTech Network |{' '}
              <a href="https://webtech.network/terms" target="_blank" rel="noopener noreferrer">
                Termos de uso
              </a>{' '}
              |{' '}
              <a href="https://webtech.network/privacy" target="_blank" rel="noopener noreferrer">
                Política de Privacidade
              </a>
            </>
          ) : (
            '© WebTech Network'
          )}
        </p>
        {showLogo && (
          <a href="https://webtech.network/" target="_blank" rel="noopener noreferrer" className="webtech-footer-link">
            <Image src={webtechLogo} alt="WebTech Network" className="webtech-footer-logo" />
          </a>
        )}
      </footer>
    );
  }

  return (
    <footer className="webtech-footer">
      {showLogo && (
        <a href="https://webtech.network/" target="_blank" rel="noopener noreferrer" className="webtech-footer-link">
          <Image src={webtechLogo} alt="WebTech Network" className="webtech-footer-logo" />
        </a>
      )}
    </footer>
  );
}
