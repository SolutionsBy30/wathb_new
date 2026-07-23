import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api/client';
import Login from './pages/Login';
import Taxonomy from './pages/Taxonomy';
import QuestionBank from './pages/QuestionBank';
import QuestionEditor from './pages/QuestionEditor';
import BulkImport from './pages/BulkImport';
import DeliveryLog from './pages/DeliveryLog';
import Packages from './pages/Packages';
import Subscriptions from './pages/Subscriptions';
import SolutionPerformance from './pages/SolutionPerformance';
import Geography from './pages/Geography';
import Students from './pages/Students';
import Supervisors from './pages/Supervisors';
import AuditLog from './pages/AuditLog';

const NAV = [
  { id: 'taxonomy', label: 'الاختبارات والتصنيف' },
  { id: 'bank', label: 'بنك الأسئلة' },
  { id: 'import', label: 'استيراد جماعي' },
  { id: 'solutionPerf', label: 'أداء الأسئلة' },
  { id: 'students', label: 'الطلاب' },
  { id: 'geography', label: 'الجغرافيا والمدارس' },
  { id: 'notifications', label: 'الإشعارات' },
  { id: 'supervisors', label: 'المشرفون' },
  { id: 'packages', label: 'الباقات والتسعير' },
  { id: 'subscriptions', label: 'الاشتراكات' },
  { id: 'auditLog', label: 'سجل التدقيق' },
];

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [tab, setTab] = useState('taxonomy');
  const [tests, setTests] = useState([]);
  const [editingQuestionId, setEditingQuestionId] = useState(undefined); // undefined = not editing, null = new

  useEffect(() => {
    if (authed) api.listTests().then(setTests).catch(() => {});
  }, [authed]);

  if (!authed) {
    return <Login onLogin={async (email, password) => {
      const { token } = await api.login(email, password);
      setToken(token);
      setAuthed(true);
    }} />;
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '16px 32px', borderBottom: '0.5px solid var(--on-indigo-line)' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontWeight: 600, fontSize: '18px', color: 'var(--sand)' }}>وثب · لوحة الإدارة</span>
        <nav style={{ display: 'flex', gap: '4px' }}>
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => { setTab(n.id); setEditingQuestionId(undefined); }}
              style={{
                border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-arabic)', fontSize: '13px',
                background: tab === n.id ? 'var(--on-indigo-subtle)' : 'transparent',
                color: tab === n.id ? 'var(--sand)' : 'var(--mist)',
              }}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <button
          onClick={() => { setToken(null); setAuthed(false); }}
          style={{ marginInlineStart: 'auto', border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
        >
          خروج
        </button>
      </header>

      <main style={{ padding: '28px 32px', maxWidth: '1200px', margin: '0 auto' }}>
        {tab === 'taxonomy' && <Taxonomy tests={tests} onTestsChanged={() => api.listTests().then(setTests)} />}
        {tab === 'bank' && editingQuestionId === undefined && (
          <QuestionBank tests={tests} onEdit={(id) => setEditingQuestionId(id)} onNew={() => setEditingQuestionId(null)} />
        )}
        {tab === 'bank' && editingQuestionId !== undefined && (
          <QuestionEditor
            tests={tests}
            questionId={editingQuestionId}
            onDone={() => setEditingQuestionId(undefined)}
          />
        )}
        {tab === 'import' && <BulkImport tests={tests} />}
        {tab === 'solutionPerf' && <SolutionPerformance tests={tests} />}
        {tab === 'students' && <Students />}
        {tab === 'geography' && <Geography />}
        {tab === 'notifications' && <DeliveryLog />}
        {tab === 'supervisors' && <Supervisors />}
        {tab === 'packages' && <Packages tests={tests} />}
        {tab === 'subscriptions' && <Subscriptions />}
        {tab === 'auditLog' && <AuditLog />}
      </main>
    </div>
  );
}
