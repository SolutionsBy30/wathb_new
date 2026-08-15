import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api/client';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Taxonomy from './pages/Taxonomy';
import QuestionBank from './pages/QuestionBank';
import QuestionEditor from './pages/QuestionEditor';
import ReviewQueue from './pages/ReviewQueue';
import ProblemReports from './pages/ProblemReports';
import DailyTips from './pages/DailyTips';
import BulkImport from './pages/BulkImport';
import DeliveryLog from './pages/DeliveryLog';
import Packages from './pages/Packages';
import Subscriptions from './pages/Subscriptions';
import SolutionPerformance from './pages/SolutionPerformance';
import Geography from './pages/Geography';
import Students from './pages/Students';
import StudentDetail from './pages/StudentDetail';
import Supervisors from './pages/Supervisors';
import AuditLog from './pages/AuditLog';
import AdminUsers from './pages/AdminUsers';

// ADM-003 — grouped navigation: Overview; Content; Users; Business; System.
const NAV_GROUPS = [
  { group: null, items: [{ id: 'overview', label: 'نظرة عامة' }] },
  {
    group: 'المحتوى',
    items: [
      { id: 'taxonomy', label: 'الاختبارات والتصنيف' },
      { id: 'bank', label: 'بنك الأسئلة' },
      { id: 'reviewQueue', label: 'قائمة المراجعة' },
      { id: 'problemReports', label: 'بلاغات المشاكل' },
      { id: 'dailyTips', label: 'نصيحة اليوم' },
      { id: 'import', label: 'استيراد جماعي' },
      { id: 'solutionPerf', label: 'أداء الأسئلة' },
    ],
  },
  {
    group: 'المستخدمون',
    items: [
      { id: 'students', label: 'الطلاب' },
      { id: 'supervisors', label: 'المشرفون' },
      { id: 'geography', label: 'الجغرافيا والمدارس' },
    ],
  },
  {
    group: 'الأعمال',
    items: [
      { id: 'subscriptions', label: 'الاشتراكات' },
      { id: 'packages', label: 'الباقات والتسعير' },
    ],
  },
  {
    group: 'النظام',
    items: [
      { id: 'notifications', label: 'الإشعارات' },
      { id: 'auditLog', label: 'سجل التدقيق' },
      // ADM-088 — super-admin only; filtered out below for everyone else.
      { id: 'admins', label: 'المسؤولون', superAdminOnly: true },
    ],
  },
];

/**
 * ADM-088 — show only what this admin may reach.
 *
 * Nav ids and permission keys are the same strings by design, so there is no
 * mapping table to drift. 'overview' is ungated: it is the landing screen and
 * shows only aggregate counts. This is presentation — the API guards every
 * one of these routes independently, so a hidden tab is not a security
 * boundary, just an honest menu.
 */
function visibleGroups(me) {
  if (!me) return [];
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((n) => {
      if (n.superAdminOnly) return me.isSuperAdmin;
      if (n.id === 'overview') return true;
      return me.isSuperAdmin || me.adminPermissions.includes(n.id);
    }),
  }));
  return groups.filter((g) => g.items.length > 0);
}

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [tab, setTab] = useState('overview');
  const [tests, setTests] = useState([]);
  const [editingQuestionId, setEditingQuestionId] = useState(undefined); // undefined = not editing, null = new
  const [viewingStudentId, setViewingStudentId] = useState(null);
  // ADM-088 — the caller's own permissions, which decide what the nav shows.
  const [me, setMe] = useState(null);
  const [testsError, setTestsError] = useState(null);

  useEffect(() => {
    if (!authed) return;
    api.adminMe().then(setMe).catch(() => setMe(null));
    // ADM-088a — a failure here used to be swallowed into an empty array,
    // which rendered as "no tests" and made every filter look broken rather
    // than failing loudly. GET /admin/tests is now readable by any admin, so
    // this should not fail; if it does, say so instead of lying.
    api.listTests().then((t) => { setTests(t); setTestsError(null); })
      .catch((e) => { setTests([]); setTestsError(e.message); });
  }, [authed]);

  // Land on a tab this admin can actually open — otherwise an admin without
  // 'overview'-adjacent rights would stare at a screen that 403s on load.
  const groups = visibleGroups(me);
  const allowed = groups.flatMap((g) => g.items.map((n) => n.id));
  useEffect(() => {
    if (me && allowed.length > 0 && !allowed.includes(tab)) setTab(allowed[0]);
  }, [me, allowed.join(','), tab]);

  if (!authed) {
    return <Login onLogin={async (email, password) => {
      const { token } = await api.login(email, password);
      setToken(token);
      setAuthed(true);
    }} />;
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px 32px', borderBottom: '0.5px solid var(--on-indigo-line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontWeight: 600, fontSize: '18px', color: 'var(--sand)' }}>وثب · لوحة الإدارة</span>
          <button
            onClick={() => { setToken(null); setAuthed(false); }}
            style={{ marginInlineStart: 'auto', border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
          >
            خروج
          </button>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          {groups.map((g, gi) => (
            <div key={g.group ?? 'root'} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {g.group && (
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '10px', color: 'var(--mist)', marginInlineEnd: '4px' }}>{g.group}</span>
              )}
              {g.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setTab(n.id); setEditingQuestionId(undefined); setViewingStudentId(null); }}
                  style={{
                    border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: 'var(--radius-md)',
                    fontFamily: 'var(--font-arabic)', fontSize: '13px',
                    background: tab === n.id ? 'var(--on-indigo-subtle)' : 'transparent',
                    color: tab === n.id ? 'var(--sand)' : 'var(--mist)',
                  }}
                >
                  {n.label}
                </button>
              ))}
              {gi < groups.length - 1 && <span style={{ width: '0.5px', height: '18px', background: 'var(--on-indigo-line)', marginInlineStart: '10px' }} />}
            </div>
          ))}
        </nav>
      </header>

      <main style={{ padding: '28px 32px', maxWidth: '1200px', margin: '0 auto' }}>
        {testsError && (
          <p style={{ margin: '0 0 14px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>
            تعذّر تحميل قائمة الاختبارات ({testsError}) — قوائم التصفية ستظهر فارغة.
          </p>
        )}
        {tab === 'overview' && <Overview />}
        {tab === 'admins' && <AdminUsers me={me} />}
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
        {tab === 'reviewQueue' && (
          <ReviewQueue onEdit={(id) => { setTab('bank'); setEditingQuestionId(id); }} />
        )}
        {tab === 'problemReports' && (
          <ProblemReports onEditQuestion={(id) => { setTab('bank'); setEditingQuestionId(id); }} />
        )}
        {tab === 'dailyTips' && <DailyTips />}
        {tab === 'import' && <BulkImport tests={tests} />}
        {tab === 'solutionPerf' && <SolutionPerformance tests={tests} />}
        {tab === 'students' && viewingStudentId === null && <Students onOpenStudent={setViewingStudentId} />}
        {tab === 'students' && viewingStudentId !== null && (
          <StudentDetail studentId={viewingStudentId} onBack={() => setViewingStudentId(null)} />
        )}
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
