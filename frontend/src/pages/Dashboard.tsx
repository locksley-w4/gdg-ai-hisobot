import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface User {
  id: number;
  username: string;
  role: string;
}

interface Report {
  id: number;
  title: string;
  content: string;
  template_type: string;
  ai_model: string;
  created_at: string;
}

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [generating, setGenerating] = useState(false);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [genError, setGenError] = useState('');
  const [tab, setTab] = useState<'reports' | 'generate'>('reports');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await api.get('/api/reports');
      setReports(res.data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenError('');
    setGenerating(true);
    try {
      await api.post('/api/reports/generate', { title, prompt });
      setTitle('');
      setPrompt('');
      setTab('reports');
      await fetchReports();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setGenError(axiosError.response?.data?.error || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this report?')) return;
    try {
      await api.delete(`/api/reports/${id}`);
      setSelectedReport(null);
      await fetchReports();
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  const handleViewReport = async (id: number) => {
    try {
      const res = await api.get(`/api/reports/${id}`);
      setSelectedReport(res.data);
    } catch (err) {
      console.error('Failed to fetch report:', err);
    }
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.logo}>GDG AI Hisobot</h1>
        <div style={styles.userInfo}>
          <span style={styles.username}>👤 {user.username}</span>
          {user.role === 'admin' && <span style={styles.badge}>Admin</span>}
          <button onClick={onLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </header>

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === 'reports' ? styles.activeTab : {}) }}
          onClick={() => setTab('reports')}
        >
          📄 My Reports
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'generate' ? styles.activeTab : {}) }}
          onClick={() => setTab('generate')}
        >
          ✨ Generate Report
        </button>
      </div>

      <main style={styles.main}>
        {tab === 'reports' && (
          <div style={styles.reportsLayout}>
            <div style={styles.reportsList}>
              <h2 style={styles.sectionTitle}>Reports ({reports.length})</h2>
              {reports.length === 0 ? (
                <p style={styles.empty}>No reports yet. Generate your first report!</p>
              ) : (
                reports.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      ...styles.reportItem,
                      ...(selectedReport?.id === r.id ? styles.reportItemActive : {}),
                    }}
                    onClick={() => handleViewReport(r.id)}
                  >
                    <div style={styles.reportTitle}>{r.title}</div>
                    <div style={styles.reportMeta}>
                      {r.template_type} · {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedReport && (
              <div style={styles.reportDetail}>
                <div style={styles.reportDetailHeader}>
                  <h3 style={styles.reportDetailTitle}>{selectedReport.title}</h3>
                  <button
                    onClick={() => handleDelete(selectedReport.id)}
                    style={styles.deleteBtn}
                  >
                    🗑 Delete
                  </button>
                </div>
                <div style={styles.reportMeta2}>
                  Model: {selectedReport.ai_model} ·{' '}
                  {new Date(selectedReport.created_at).toLocaleString()}
                </div>
                <pre style={styles.reportContent}>{selectedReport.content}</pre>
              </div>
            )}
          </div>
        )}

        {tab === 'generate' && (
          <div style={styles.generateContainer}>
            <h2 style={styles.sectionTitle}>Generate New Report</h2>
            <form onSubmit={handleGenerate} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Report Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={styles.input}
                  placeholder="e.g., Q1 2024 Performance Summary"
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Prompt / Instructions</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  style={styles.textarea}
                  placeholder="Describe what you want the AI to write about..."
                  rows={6}
                  required
                />
              </div>
              {genError && <div style={styles.error}>{genError}</div>}
              <button
                type="submit"
                style={{ ...styles.button, opacity: generating ? 0.7 : 1 }}
                disabled={generating}
              >
                {generating ? '⏳ Generating...' : '✨ Generate with AI'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#f0f2f5',
  },
  header: {
    background: '#1a73e8',
    color: '#fff',
    padding: '16px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  logo: {
    fontSize: '22px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  username: {
    fontSize: '15px',
  },
  badge: {
    background: '#fff',
    color: '#1a73e8',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
  },
  logoutBtn: {
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: '6px',
    padding: '6px 14px',
    fontSize: '14px',
  },
  tabs: {
    background: '#fff',
    padding: '0 32px',
    display: 'flex',
    gap: '0',
    borderBottom: '1px solid #e0e0e0',
  },
  tab: {
    background: 'none',
    border: 'none',
    padding: '14px 20px',
    fontSize: '15px',
    color: '#666',
    borderBottom: '3px solid transparent',
    transition: 'all 0.2s',
  },
  activeTab: {
    color: '#1a73e8',
    borderBottomColor: '#1a73e8',
    fontWeight: '600',
  },
  main: {
    flex: 1,
    padding: '32px',
  },
  reportsLayout: {
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: '24px',
    maxWidth: '1200px',
  },
  reportsList: {
    background: '#fff',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    height: 'fit-content',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#222',
  },
  empty: {
    color: '#888',
    fontSize: '14px',
    textAlign: 'center',
    padding: '20px 0',
  },
  reportItem: {
    padding: '12px 14px',
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '8px',
    background: '#f8f9fa',
    border: '1.5px solid transparent',
    transition: 'all 0.15s',
  },
  reportItemActive: {
    background: '#e8f0fe',
    borderColor: '#1a73e8',
  },
  reportTitle: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#222',
    marginBottom: '4px',
  },
  reportMeta: {
    fontSize: '12px',
    color: '#888',
  },
  reportDetail: {
    background: '#fff',
    borderRadius: '10px',
    padding: '24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  reportDetailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
  },
  reportDetailTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#222',
  },
  deleteBtn: {
    background: '#fce8e6',
    color: '#c62828',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '13px',
  },
  reportMeta2: {
    fontSize: '13px',
    color: '#888',
    marginBottom: '16px',
  },
  reportContent: {
    background: '#f8f9fa',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '16px',
    fontSize: '14px',
    lineHeight: '1.7',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '500px',
    overflowY: 'auto',
  },
  generateContainer: {
    maxWidth: '640px',
    background: '#fff',
    borderRadius: '10px',
    padding: '32px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#444',
  },
  input: {
    padding: '10px 14px',
    border: '1.5px solid #ddd',
    borderRadius: '8px',
    fontSize: '15px',
    outline: 'none',
  },
  textarea: {
    padding: '10px 14px',
    border: '1.5px solid #ddd',
    borderRadius: '8px',
    fontSize: '15px',
    outline: 'none',
    resize: 'vertical',
  },
  error: {
    background: '#fce8e6',
    color: '#c62828',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '14px',
  },
  button: {
    background: '#1a73e8',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '16px',
    fontWeight: '600',
  },
};
