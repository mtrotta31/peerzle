import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getLegalTerms } from '../services/api';

export default function TermsOfService() {
  const [content, setContent] = useState<string>('');
  const [version, setVersion] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLegalTerms()
      .then((data) => {
        setContent(data.content);
        setVersion(data.version);
      })
      .catch(() => {
        setError('Failed to load Terms of Service');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Simple markdown rendering - converts headers, bold, links, and lists
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} style={{ marginBottom: '16px', paddingLeft: '24px' }}>
            {listItems.map((item, i) => (
              <li key={i} style={{ marginBottom: '8px', lineHeight: '1.6' }}>
                {formatInlineText(item)}
              </li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    const formatInlineText = (text: string) => {
      // Handle bold text
      const parts = text.split(/(\*\*[^*]+\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Headers
      if (trimmedLine.startsWith('# ')) {
        flushList();
        elements.push(
          <h1
            key={index}
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#1E3A5F',
              marginTop: '32px',
              marginBottom: '16px',
            }}
          >
            {trimmedLine.slice(2)}
          </h1>
        );
      } else if (trimmedLine.startsWith('## ')) {
        flushList();
        elements.push(
          <h2
            key={index}
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#1E3A5F',
              marginTop: '28px',
              marginBottom: '12px',
            }}
          >
            {trimmedLine.slice(3)}
          </h2>
        );
      } else if (trimmedLine.startsWith('### ')) {
        flushList();
        elements.push(
          <h3
            key={index}
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#1E3A5F',
              marginTop: '20px',
              marginBottom: '8px',
            }}
          >
            {trimmedLine.slice(4)}
          </h3>
        );
      } else if (trimmedLine.startsWith('- ')) {
        listItems.push(trimmedLine.slice(2));
      } else if (trimmedLine === '') {
        flushList();
      } else if (trimmedLine.startsWith('---')) {
        flushList();
        elements.push(
          <hr
            key={index}
            style={{
              border: 'none',
              borderTop: '1px solid #E2E8F0',
              margin: '24px 0',
            }}
          />
        );
      } else {
        flushList();
        elements.push(
          <p
            key={index}
            style={{
              marginBottom: '16px',
              lineHeight: '1.7',
              color: '#475569',
            }}
          >
            {formatInlineText(trimmedLine)}
          </p>
        );
      }
    });

    flushList();
    return elements;
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        padding: '40px 20px',
      }}
    >
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link to="/login">
            <img
              src="/peerzle-logo-vertical.svg"
              alt="Peerzle"
              style={{ width: '120px', height: 'auto' }}
            />
          </Link>
        </div>

        {/* Content Card */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '40px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid #E2E8F0',
          }}
        >
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
              Loading...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#DC2626' }}>
              {error}
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '24px', color: '#64748B', fontSize: '14px' }}>
                Version {version}
              </div>
              {renderMarkdown(content)}
            </>
          )}
        </div>

        {/* Back Link */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link
            to="/login"
            style={{
              color: '#2B7CF6',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
