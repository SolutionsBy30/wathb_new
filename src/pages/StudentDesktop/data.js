export const TEST_BANKS = {
  qudurat: {
    name: 'وثبة قدرات',
    questions: [
      { stem: 'تشبه العلاقة بين (كتاب : قارئ) العلاقة بين:', options: ['مفتاح : باب', 'قلم : كاتب', 'طبيب : مريض', 'سيارة : طريق'], correctIndex: 1, timerS: 40,
        explanation: 'العلاقة بين الكلمتين الأوليين هي "أداة يستخدمها صاحبها لغرض معيّن"، وينطبق ذلك على قلم : كاتب.' },
      { stem: 'على الرغم من ......، إلا أن الفريق حقّق الفوز.', options: ['الجهد الكبير', 'الإصابات المتكررة', 'الدعم الجماهيري', 'التدريب المكثّف'], correctIndex: 1, timerS: 40,
        explanation: '"على الرغم من" تستدعي عنصرًا مضادًا يتناقض مع النتيجة، وهو الإصابات المتكررة.' },
      { stem: 'ناتج 45 × 12 ÷ 9 = ؟', options: ['60', '54', '66', '48'], correctIndex: 0, timerS: 40,
        explanation: '45 × 12 = 540، و540 ÷ 9 = 60.' },
      { stem: 'في مثلث، إذا كانت زاويتان تساويان 55° و65°، فما قياس الزاوية الثالثة؟', options: ['55°', '60°', '65°', '70°'], correctIndex: 1, timerS: 45,
        explanation: 'مجموع زوايا المثلث 180°، و180 − 55 − 65 = 60°.' },
      { stem: 'وُزِّع مبلغ 900 ريال بين ثلاثة أشخاص بنسبة 2:3:4، فما نصيب الشخص الثاني؟', options: ['200', '300', '400', '250'], correctIndex: 1, timerS: 50,
        explanation: 'مجموع النسب 9، فقيمة الجزء = 100 ريال، ونصيب الثاني (3 أجزاء) = 300 ريال.' },
    ],
  },
  tahsili: {
    name: 'وثبة تحصيلي',
    questions: [
      { stem: 'أي مما يلي يمثّل الوحدة البنائية الأساسية للكائنات الحية؟', options: ['النسيج', 'الخلية', 'العضو', 'الجهاز'], correctIndex: 1, timerS: 60,
        explanation: 'الخلية هي الوحدة البنائية والوظيفية الأساسية لكل الكائنات الحية.' },
      { stem: 'ما نوع الرابطة الناتجة عن مشاركة إلكترونات بين ذرتين؟', options: ['أيونية', 'تساهمية', 'فلزية', 'هيدروجينية'], correctIndex: 1, timerS: 60,
        explanation: 'الرابطة التساهمية تنتج عن مشاركة زوج إلكترونات بين ذرتين.' },
      { stem: 'جسم يتحرك بسرعة ثابتة، ما مقدار تسارعه؟', options: ['يساوي السرعة', 'صفر', 'يتزايد', 'يتناقص'], correctIndex: 1, timerS: 60,
        explanation: 'السرعة الثابتة تعني عدم وجود تغيّر فيها، وبالتالي التسارع يساوي صفراً.' },
      { stem: 'أي الأزمنة التالية يُستخدم للتعبير عن حدث اعتيادي في الحاضر؟', options: ['Present Simple', 'Past Simple', 'Future Simple', 'Present Continuous'], correctIndex: 0, timerS: 50,
        explanation: 'Present Simple يُستخدم للتعبير عن العادات والحقائق الثابتة.' },
    ],
  },
};

export const LS_KEY = 'wathb_student_state_v2';

export const schoolCohortComposites = [71, 80, 47, 64, 39, 73, 58, 66, 61, 54, 49, 44, 68, 77, 52, 62, 57, 45, 70, 48, 63, 42, 59, 67, 51, 46, 65, 40];

export const labelStats = {
  analogy: { name: 'التناظر اللفظي', testName: 'قدرات', acc: 78, n: 41, meanTimeS: 33, targetS: 40 },
  completion: { name: 'إكمال الجمل', testName: 'قدرات', acc: 65, n: 30, meanTimeS: 36, targetS: 40 },
  operations: { name: 'العمليات الحسابية', testName: 'قدرات', acc: 82, n: 50, meanTimeS: 29, targetS: 40 },
  angles: { name: 'الزوايا والمساحات', testName: 'قدرات', acc: 50, n: 35, meanTimeS: 44, targetS: 45 },
  ratios: { name: 'النسب والتناسب', testName: 'قدرات', acc: 60, n: 28, meanTimeS: 49, targetS: 50 },
  bioCells: { name: 'الخلية', testName: 'تحصيلي', acc: 70, n: 20, meanTimeS: 55, targetS: 60 },
  chemBonds: { name: 'الروابط الكيميائية', testName: 'تحصيلي', acc: 60, n: 18, meanTimeS: 58, targetS: 60 },
  physMotion: { name: 'الحركة', testName: 'تحصيلي', acc: 55, n: 15, meanTimeS: 60, targetS: 60 },
  enGrammar: { name: 'Grammar', testName: 'تحصيلي', acc: 72, n: 22, meanTimeS: 45, targetS: 50 },
};

export const trendByTest = {
  qudurat: [58, 60, 59, 63, 65, 64, 67, 69],
  tahsili: [52, 54, 55, 57, 59, 58, 61, 63],
};

export const tipsByLabel = {
  angles: 'مجموع زوايا المثلث دائماً 180 درجة.',
  ratios: 'لحساب حصة كل طرف من نسبة، اقسم الكل على مجموع أجزاء النسبة أولاً.',
  operations: 'رتّب العمليات دائماً: الأقواس، ثم الضرب والقسمة، ثم الجمع والطرح.',
  oddOneOut: 'ابحث أولاً عن القاسم المشترك بين ثلاث كلمات قبل استبعاد الرابعة.',
  completion: 'اقرأ الجملة كاملة أولاً لتحديد المعنى العام قبل اختيار الكلمة المناسبة.',
  analogy: 'حدّد نوع العلاقة بين الكلمتين الأوليين بجملة واحدة، ثم طبّقها على الخيارات.',
  contextError: 'راجع تطابق الفاعل مع الفعل عدداً ونوعاً — أكثر مصدر للخطأ السياقي.',
  reading: 'ابحث عن الفكرة المحورية في الجملة الأولى والأخيرة من الفقرة غالباً.',
  bioCells: 'الخلية هي الوحدة البنائية والوظيفية الأساسية لكل كائن حي.',
  chemBonds: 'الرابطة التساهمية تنتج عن مشاركة إلكترونات، والأيونية عن انتقالها.',
  physMotion: 'التسارع صفر عندما تكون السرعة ثابتة، بغض النظر عن مقدارها.',
  enGrammar: 'Present Simple يُستخدم للعادات والحقائق الثابتة، لا للأحداث اللحظية.',
};

export const recentMistakes = [
  { testId: 'qudurat', stem: 'اختر الكلمة الشاذة: أسد، نمر، حصان، فهد', correctText: 'حصان', explanation: 'الأسد والنمر والفهد حيوانات مفترسة، بينما الحصان عاشب.' },
  { testId: 'qudurat', stem: 'حدّد موضع الخطأ السياقي: «ذهبت الطالباتُ إلى المدرسةِ مبكراً ليستعدون للاختبار».', correctText: 'ليستعددن', explanation: 'الفاعل جمع مؤنث "الطالبات"، فالصواب "ليستعددن" لا "ليستعدون".' },
  { testId: 'qudurat', stem: 'في مثلث، إذا كانت زاويتان تساويان 55° و65°، فما قياس الزاوية الثالثة؟', correctText: '60°', explanation: 'مجموع زوايا المثلث 180°، و180 − 55 − 65 = 60°.' },
  { testId: 'tahsili', stem: 'ما نوع الرابطة الناتجة عن مشاركة إلكترونات بين ذرتين؟', correctText: 'تساهمية', explanation: 'الرابطة التساهمية تنتج عن مشاركة زوج إلكترونات بين ذرتين.' },
  { testId: 'tahsili', stem: 'جسم يتحرك بسرعة ثابتة، ما مقدار تسارعه؟', correctText: 'صفر', explanation: 'السرعة الثابتة تعني عدم وجود تغيّر فيها، وبالتالي التسارع يساوي صفراً.' },
];

export const wathbHistory = [
  { id: 'w1', dateLabel: '2026-07-16', testId: 'qudurat', correct: 4, total: 5, avgTimeS: 34, targetS: 42, labels: ['التناظر اللفظي', 'إكمال الجمل', 'العمليات الحسابية'] },
  { id: 'w2', dateLabel: '2026-07-15', testId: 'tahsili', correct: 3, total: 4, avgTimeS: 57, targetS: 58, labels: ['الخلية', 'الروابط الكيميائية'] },
  { id: 'w3', dateLabel: '2026-07-14', testId: 'qudurat', correct: 5, total: 5, avgTimeS: 31, targetS: 42, labels: ['الزوايا والمساحات', 'النسب والتناسب'] },
  { id: 'w4', dateLabel: '2026-07-13', testId: 'qudurat', correct: 3, total: 5, avgTimeS: 46, targetS: 42, labels: ['التناظر اللفظي', 'المفردة الشاذة'] },
  { id: 'w5', dateLabel: '2026-07-12', testId: 'tahsili', correct: 2, total: 4, avgTimeS: 61, targetS: 58, labels: ['الحركة', 'Grammar'] },
  { id: 'w6', dateLabel: '2026-07-11', testId: 'qudurat', correct: 4, total: 5, avgTimeS: 38, targetS: 42, labels: ['إكمال الجمل', 'العمليات الحسابية'] },
];

export function heatmapGrid(streak, weeks = 8) {
  const grid = [];
  for (let w = 0; w < weeks; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const idxFromEnd = (weeks - 1 - w) * 7 + (6 - d);
      days.push(idxFromEnd < streak || ((w * 7 + d) % 5 === 0 && w < weeks - 2));
    }
    grid.push(days);
  }
  return grid;
}

export const initialState = {
  screen: 'home',
  activeTestId: 'qudurat',
  qIndex: 0,
  selectedIndex: null,
  answerStatus: null,
  sessionCorrect: 0,
  timeLeft: TEST_BANKS.qudurat.questions[0].timerS,
  streak: 23,
  lastCompletedDate: null,
  weeklyAnswered: 32,
  perf: {
    qudurat: { composite: 71, accuracy: 74, totalAnswered: 253, correct: 182, wrong: 71 },
    tahsili: { composite: 63, accuracy: 66, totalAnswered: 96, correct: 52, wrong: 44 },
  },
  dashboardTestId: null,
  selectedWathbId: null,
  inviteName: '', invitePhone: '', inviteSent: false,
  dailyWathbTime: '18:00', weeklyReportDay: 'الخميس', weeklyReportTime: '20:00', settingsSaved: false,
  renewed: false,
  linkedSupervisors: [
    { id: 'sup1', name: 'منى القحطاني', type: 'ولي أمر', linkedOn: '2026-03-01' },
    { id: 'sup2', name: 'أ. خالد الدوسري', type: 'معلّم', linkedOn: '2026-04-15' },
  ],
  enabledTests: { qudurat: true, tahsili: true },
};
