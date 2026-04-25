import { useNavigate } from 'react-router-dom';

export default function AccessDenied() {
    const navigate = useNavigate();

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: '60vh', textAlign: 'center', padding: '2rem',
        }}>
            <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1.5rem', boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)',
            }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem' }}>
                Access Denied
            </h1>
            <p style={{ fontSize: '1rem', color: '#94a3b8', maxWidth: 400, marginBottom: '2rem', lineHeight: 1.6 }}>
                You don't have permission to access this page. Contact your administrator if you believe this is an error.
            </p>
            <button
                onClick={() => navigate('/dashboard')}
                style={{
                    padding: '0.75rem 2rem', borderRadius: '0.75rem', border: 'none',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                }}
                onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
                ← Back to Dashboard
            </button>
        </div>
    );
}
