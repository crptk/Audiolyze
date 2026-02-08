export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      padding: '2rem',
    }}>
      <div style={{ maxWidth: 640, textAlign: 'center' }}>
        <h1 style={{
          fontSize: '3.5rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          marginBottom: '0.75rem',
          background: 'linear-gradient(135deg, #c8ff7a 0%, #a8ff60 30%, #fff 60%, #a8ff60 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Audiolyze
        </h1>
        <p style={{ fontSize: '1.15rem', color: 'rgba(255,255,255,0.6)', marginBottom: '2.5rem' }}>
          Your music, on stage.
        </p>

        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: '2rem',
          textAlign: 'left',
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: 0, marginBottom: '1rem', color: 'rgba(200,255,122,0.9)' }}>
            Running Locally
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: '0 0 1.25rem' }}>
            This is a <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Vite + React</strong> app with a <strong style={{ color: 'rgba(255,255,255,0.8)' }}>FastAPI</strong> backend.
            To run locally:
          </p>
          <div style={{
            background: 'rgba(0,0,0,0.4)',
            borderRadius: 10,
            padding: '1rem 1.25rem',
            fontFamily: 'monospace',
            fontSize: '0.82rem',
            lineHeight: 2,
            color: 'rgba(200,255,122,0.8)',
            whiteSpace: 'pre',
            overflowX: 'auto',
          }}>
{`# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend (new terminal)
cd frontend
npm install
npm run dev`}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', marginTop: '1rem', marginBottom: 0 }}>
            Frontend: localhost:5173 &middot; Backend: localhost:8000
          </p>
        </div>
      </div>
    </div>
  );
}
