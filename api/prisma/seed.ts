// Seed data ported from the Claude-Design prototype (wathb-data.js / data.js) so the
// running app has real Arabic taxonomy + question content instead of empty tables.
import { PrismaClient, QuestionStatus, Track } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { stemHash } from '../src/questions/normalize';

const prisma = new PrismaClient();

type SeedOption = { k: string; t: string };
type SeedQuestion = {
  id: string;
  label: string;
  difficulty: number;
  status: QuestionStatus;
  stem: string;
  passage?: string;
  options: SeedOption[];
  correct: string;
  explanation: string;
  timerS: number;
};

const QUDURAT_QUESTIONS: SeedQuestion[] = [
  { id: 'Q1', label: 'analogy', difficulty: 2, status: 'published', stem: 'تشبه العلاقة بين (كتاب : قارئ) العلاقة بين:',
    options: [{k:'أ',t:'مفتاح : باب'},{k:'ب',t:'قلم : كاتب'},{k:'ج',t:'طبيب : مريض'},{k:'د',t:'سيارة : طريق'}], correct:'ب',
    explanation:'العلاقة بين الكلمتين الأوليين هي "أداة يستخدمها صاحبها لغرض معيّن"، وينطبق ذلك على قلم : كاتب.', timerS: 40 },
  { id: 'Q2', label: 'analogy', difficulty: 3, status: 'published', stem: '(طبيب : مستشفى) كـ:',
    options: [{k:'أ',t:'معلّم : مدرسة'},{k:'ب',t:'سيارة : طريق'},{k:'ج',t:'كتاب : مكتبة'},{k:'د',t:'طالب : كتاب'}], correct:'أ',
    explanation:'العلاقة هي "شخص : مكان عمله"، وتنطبق على معلّم : مدرسة.', timerS: 40 },
  { id: 'Q3', label: 'oddOneOut', difficulty: 3, status: 'published', stem: 'اختر الكلمة الشاذة: تفاح، برتقال، موز، طماطم',
    options: [{k:'أ',t:'تفاح'},{k:'ب',t:'برتقال'},{k:'ج',t:'موز'},{k:'د',t:'طماطم'}], correct:'د',
    explanation:'الكلمات الثلاث الأولى فواكه، بينما تُصنَّف الطماطم في الاستخدام الشائع كخضار.', timerS: 45 },
  { id: 'Q4', label: 'oddOneOut', difficulty: 4, status: 'in_review', stem: 'اختر الكلمة الشاذة: أسد، نمر، حصان، فهد',
    options: [{k:'أ',t:'أسد'},{k:'ب',t:'نمر'},{k:'ج',t:'حصان'},{k:'د',t:'فهد'}], correct:'ج',
    explanation:'الأسد والنمر والفهد حيوانات مفترسة، بينما الحصان عاشب.', timerS: 45 },
  { id: 'Q5', label: 'completion', difficulty: 2, status: 'published', stem: 'على الرغم من ......، إلا أن الفريق حقّق الفوز.',
    options: [{k:'أ',t:'الجهد الكبير'},{k:'ب',t:'الإصابات المتكررة'},{k:'ج',t:'الدعم الجماهيري'},{k:'د',t:'التدريب المكثّف'}], correct:'ب',
    explanation:'"على الرغم من" تستدعي عنصرًا مضادًا يتناقض مع النتيجة، وهو الإصابات المتكررة.', timerS: 40 },
  { id: 'Q6', label: 'completion', difficulty: 3, status: 'published', stem: 'كان الطقس ...... لدرجة أن الرحلة أُلغيت.',
    options: [{k:'أ',t:'معتدلاً'},{k:'ب',t:'عاصفاً'},{k:'ج',t:'صافياً'},{k:'د',t:'لطيفاً'}], correct:'ب',
    explanation:'إلغاء الرحلة نتيجة منطقية لطقس سيّئ، وهو الوصف "عاصفاً".', timerS: 40 },
  { id: 'Q7', label: 'contextError', difficulty: 4, status: 'published', stem: 'حدّد موضع الخطأ السياقي: «ذهبت الطالباتُ (أ) إلى المدرسةِ (ب) مبكراً (ج) ليستعدون (د) للاختبار».',
    options: [{k:'أ',t:'الطالباتُ'},{k:'ب',t:'المدرسةِ'},{k:'ج',t:'مبكراً'},{k:'د',t:'ليستعدون'}], correct:'د',
    explanation:'الفاعل جمع مؤنث "الطالبات"، فالصواب "ليستعددن" لا "ليستعدون".', timerS: 45 },
  { id: 'Q8', label: 'contextError', difficulty: 3, status: 'published', stem: 'حدّد موضع الخطأ السياقي: «تُعتبر (أ) القراءة (ب) من أهم (ج) وسائل بناء المعرفة (د) والثقافة».',
    options: [{k:'أ',t:'تُعتبر'},{k:'ب',t:'القراءة'},{k:'ج',t:'من أهم'},{k:'د',t:'والثقافة'}], correct:'أ',
    explanation:'الأسلوب الفصيح يفضّل "تُعدّ" على "تُعتبر" في هذا السياق.', timerS: 45 },
  { id: 'Q9', label: 'reading', difficulty: 3, status: 'published',
    passage: 'يُعدّ الحفاظ على المياه الجوفية من أولويات التنمية المستدامة في المناطق الجافة، إذ يعتمد عليها القطاع الزراعي بشكل رئيسي. وقد أظهرت الدراسات أن الاستهلاك الحالي يفوق معدل التجدد الطبيعي بمعدل كبير.',
    stem:'ما الفكرة الرئيسية للفقرة؟',
    options: [{k:'أ',t:'أهمية الزراعة في المناطق الجافة'},{k:'ب',t:'استنزاف المياه الجوفية يفوق تجدّدها'},{k:'ج',t:'خطط التنمية المستدامة'},{k:'د',t:'دور القطاع الزراعي في الاقتصاد'}], correct:'ب',
    explanation:'الفقرة تركّز على أن الاستهلاك يفوق معدل التجدد، وهذه هي الفكرة المحورية.', timerS: 60 },
  { id: 'Q10', label: 'reading', difficulty: 3, status: 'published',
    passage: 'يُعدّ الحفاظ على المياه الجوفية من أولويات التنمية المستدامة في المناطق الجافة، إذ يعتمد عليها القطاع الزراعي بشكل رئيسي. وقد أظهرت الدراسات أن الاستهلاك الحالي يفوق معدل التجدد الطبيعي بمعدل كبير.',
    stem:'يُفهم من الفقرة أن القطاع الأكثر اعتماداً على المياه الجوفية هو:',
    options: [{k:'أ',t:'الصناعي'},{k:'ب',t:'السياحي'},{k:'ج',t:'الزراعي'},{k:'د',t:'المنزلي'}], correct:'ج',
    explanation:'نص الفقرة صراحة على اعتماد القطاع الزراعي بشكل رئيسي.', timerS: 60 },
  { id: 'Q11', label: 'operations', difficulty: 2, status: 'published', stem: 'ناتج 45 × 12 ÷ 9 = ؟',
    options: [{k:'أ',t:'60'},{k:'ب',t:'54'},{k:'ج',t:'66'},{k:'د',t:'48'}], correct:'أ',
    explanation:'45 × 12 = 540، و540 ÷ 9 = 60.', timerS: 40 },
  { id: 'Q12', label: 'operations', difficulty: 3, status: 'published', stem: 'ما ناتج (٣٦ ÷ ٤) + (٥ × ٧)؟',
    options: [{k:'أ',t:'٤٤'},{k:'ب',t:'٤٦'},{k:'ج',t:'٤٠'},{k:'د',t:'٤٢'}], correct:'ب',
    explanation:'٣٦ ÷ ٤ = ٩، و٥ × ٧ = ٣٥، وناتج جمعهما ٤٦.', timerS: 40 },
  { id: 'Q13', label: 'ratios', difficulty: 3, status: 'published', stem: 'وُزِّع مبلغ 900 ريال بين ثلاثة أشخاص بنسبة 2:3:4، فما نصيب الشخص الثاني؟',
    options: [{k:'أ',t:'200'},{k:'ب',t:'300'},{k:'ج',t:'400'},{k:'د',t:'250'}], correct:'ب',
    explanation:'مجموع النسب 9، فقيمة الجزء = 100 ريال، ونصيب الثاني (3 أجزاء) = 300 ريال.', timerS: 50 },
  { id: 'Q14', label: 'ratios', difficulty: 4, status: 'published', stem: 'إذا شكّلت الفتيات 40% من طلاب صفّ عدده 30 طالباً، فكم عدد الأولاد؟',
    options: [{k:'أ',t:'12'},{k:'ب',t:'16'},{k:'ج',t:'18'},{k:'د',t:'20'}], correct:'ج',
    explanation:'عدد الفتيات = 12، وعدد الأولاد = 30 − 12 = 18.', timerS: 50 },
  { id: 'Q15', label: 'angles', difficulty: 3, status: 'published', stem: 'في مثلث، إذا كانت زاويتان تساويان 55° و65°، فما قياس الزاوية الثالثة؟',
    options: [{k:'أ',t:'55°'},{k:'ب',t:'60°'},{k:'ج',t:'65°'},{k:'د',t:'70°'}], correct:'ب',
    explanation:'مجموع زوايا المثلث 180°، و180 − 55 − 65 = 60°.', timerS: 45 },
  { id: 'Q16', label: 'equations', difficulty: 2, status: 'published', stem: 'إذا كان 3س + 5 = 20، فما قيمة س؟',
    options: [{k:'أ',t:'3'},{k:'ب',t:'4'},{k:'ج',t:'5'},{k:'د',t:'6'}], correct:'ج',
    explanation:'3س = 15، إذن س = 5.', timerS: 40 },
  { id: 'Q17', label: 'charts', difficulty: 3, status: 'published', stem: 'أظهر جدول أن مبيعات إحدى الشركات ارتفعت من 120 إلى 150 وحدة خلال شهر، فما نسبة الزيادة؟',
    options: [{k:'أ',t:'20%'},{k:'ب',t:'25%'},{k:'ج',t:'30%'},{k:'د',t:'35%'}], correct:'ب',
    explanation:'الزيادة = 30 وحدة، ونسبتها إلى الأصل 120 هي 25%.', timerS: 50 },
  { id: 'Q18', label: 'charts', difficulty: 4, status: 'draft', stem: 'يوضح رسم بياني أن 45% من الطلاب اختاروا التخصص العلمي من أصل 200 طالب، فكم عدد من اختاروا تخصصاً آخر؟',
    options: [{k:'أ',t:'90'},{k:'ب',t:'100'},{k:'ج',t:'110'},{k:'د',t:'120'}], correct:'ج',
    explanation:'عدد العلمي = 90 طالباً، والباقي = 200 − 90 = 110.', timerS: 50 },
];

const TAHSILI_QUESTIONS: SeedQuestion[] = [
  { id: 'T1', label: 'bioCells', difficulty: 2, status: 'published', stem: 'أي مما يلي يمثّل الوحدة البنائية الأساسية للكائنات الحية؟',
    options: [{k:'أ',t:'النسيج'},{k:'ب',t:'الخلية'},{k:'ج',t:'العضو'},{k:'د',t:'الجهاز'}], correct:'ب',
    explanation:'الخلية هي الوحدة البنائية والوظيفية الأساسية لكل الكائنات الحية.', timerS: 60 },
  { id: 'T2', label: 'chemBonds', difficulty: 2, status: 'published', stem: 'ما نوع الرابطة الناتجة عن مشاركة إلكترونات بين ذرتين؟',
    options: [{k:'أ',t:'أيونية'},{k:'ب',t:'تساهمية'},{k:'ج',t:'فلزية'},{k:'د',t:'هيدروجينية'}], correct:'ب',
    explanation:'الرابطة التساهمية تنتج عن مشاركة زوج إلكترونات بين ذرتين.', timerS: 60 },
  { id: 'T3', label: 'physMotion', difficulty: 3, status: 'published', stem: 'جسم يتحرك بسرعة ثابتة، ما مقدار تسارعه؟',
    options: [{k:'أ',t:'يساوي السرعة'},{k:'ب',t:'صفر'},{k:'ج',t:'يتزايد'},{k:'د',t:'يتناقص'}], correct:'ب',
    explanation:'السرعة الثابتة تعني عدم وجود تغيّر فيها، وبالتالي التسارع يساوي صفراً.', timerS: 60 },
  { id: 'T4', label: 'enGrammar', difficulty: 2, status: 'published', stem: 'أي الأزمنة التالية يُستخدم للتعبير عن حدث اعتيادي في الحاضر؟',
    options: [{k:'أ',t:'Present Simple'},{k:'ب',t:'Past Simple'},{k:'ج',t:'Future Simple'},{k:'د',t:'Present Continuous'}], correct:'أ',
    explanation:'Present Simple يُستخدم للتعبير عن العادات والحقائق الثابتة.', timerS: 50 },
];

async function seedTaxonomy() {
  const qudurat = await prisma.test.create({ data: { nameAr: 'اختبار القدرات (GAT)', nameEn: 'Qiyas GAT' } });

  const verbal = await prisma.section.create({ data: { testId: qudurat.id, nameAr: 'لفظي', nameEn: 'Verbal', weight: 0.5, sort: 0 } });
  const quant = await prisma.section.create({ data: { testId: qudurat.id, nameAr: 'كمي', nameEn: 'Quantitative', weight: 0.5, sort: 1 } });

  const semantic = await prisma.area.create({ data: { sectionId: verbal.id, nameAr: 'العلاقات اللفظية', nameEn: 'Semantic Relationships', sort: 0 } });
  const linguistic = await prisma.area.create({ data: { sectionId: verbal.id, nameAr: 'التراكيب اللغوية', nameEn: 'Linguistic Structures', sort: 1 } });
  const comprehension = await prisma.area.create({ data: { sectionId: verbal.id, nameAr: 'الاستيعاب المقروء', nameEn: 'Comprehension', sort: 2 } });
  const arithmetic = await prisma.area.create({ data: { sectionId: quant.id, nameAr: 'الحساب', nameEn: 'Arithmetic', sort: 0 } });
  const geometry = await prisma.area.create({ data: { sectionId: quant.id, nameAr: 'الهندسة', nameEn: 'Geometry', sort: 1 } });
  const algebra = await prisma.area.create({ data: { sectionId: quant.id, nameAr: 'الجبر', nameEn: 'Algebra', appliesToTracks: [Track.scientific], sort: 2 } });
  const dataAnalysis = await prisma.area.create({ data: { sectionId: quant.id, nameAr: 'تحليل البيانات', nameEn: 'Data Analysis', sort: 3 } });

  const labels = {
    analogy: await prisma.label.create({ data: { areaId: semantic.id, nameAr: 'التناظر اللفظي', nameEn: 'Verbal Analogy', defaultTimeLimitS: 40, sort: 0 } }),
    oddOneOut: await prisma.label.create({ data: { areaId: semantic.id, nameAr: 'المفردة الشاذة', nameEn: 'Odd-One-Out', defaultTimeLimitS: 45, sort: 1 } }),
    completion: await prisma.label.create({ data: { areaId: linguistic.id, nameAr: 'إكمال الجمل', nameEn: 'Sentence Completion', defaultTimeLimitS: 40, sort: 0 } }),
    contextError: await prisma.label.create({ data: { areaId: linguistic.id, nameAr: 'الخطأ السياقي', nameEn: 'Contextual Error', defaultTimeLimitS: 45, sort: 1 } }),
    reading: await prisma.label.create({ data: { areaId: comprehension.id, nameAr: 'الفهم القرائي', nameEn: 'Reading Comprehension', defaultTimeLimitS: 60, sort: 0 } }),
    operations: await prisma.label.create({ data: { areaId: arithmetic.id, nameAr: 'العمليات الحسابية', nameEn: 'Operations', defaultTimeLimitS: 40, sort: 0 } }),
    ratios: await prisma.label.create({ data: { areaId: arithmetic.id, nameAr: 'النسب والتناسب', nameEn: 'Ratios', defaultTimeLimitS: 50, sort: 1 } }),
    angles: await prisma.label.create({ data: { areaId: geometry.id, nameAr: 'الزوايا والمساحات', nameEn: 'Angles & Areas', defaultTimeLimitS: 45, sort: 0 } }),
    equations: await prisma.label.create({ data: { areaId: algebra.id, nameAr: 'المعادلات', nameEn: 'Equations', defaultTimeLimitS: 40, sort: 0 } }),
    charts: await prisma.label.create({ data: { areaId: dataAnalysis.id, nameAr: 'الجداول والرسوم البيانية', nameEn: 'Tables & Charts', defaultTimeLimitS: 50, sort: 0 } }),
  };

  const tahsili = await prisma.test.create({ data: { nameAr: 'اختبار التحصيلي', nameEn: 'Tahsili Achievement Test' } });
  const science = await prisma.section.create({ data: { testId: tahsili.id, nameAr: 'العلوم', nameEn: 'Science', weight: 0.7, sort: 0 } });
  const common = await prisma.section.create({ data: { testId: tahsili.id, nameAr: 'الاختبار المشترك', nameEn: 'Common', weight: 0.3, sort: 1 } });
  const biology = await prisma.area.create({ data: { sectionId: science.id, nameAr: 'الأحياء', nameEn: 'Biology', sort: 0 } });
  const chemistry = await prisma.area.create({ data: { sectionId: science.id, nameAr: 'الكيمياء', nameEn: 'Chemistry', sort: 1 } });
  const physics = await prisma.area.create({ data: { sectionId: science.id, nameAr: 'الفيزياء', nameEn: 'Physics', sort: 2 } });
  const englishArea = await prisma.area.create({ data: { sectionId: common.id, nameAr: 'اللغة الإنجليزية', nameEn: 'English', sort: 0 } });

  const tahsiliLabels = {
    bioCells: await prisma.label.create({ data: { areaId: biology.id, nameAr: 'الخلية', nameEn: 'The Cell', defaultTimeLimitS: 60, sort: 0 } }),
    chemBonds: await prisma.label.create({ data: { areaId: chemistry.id, nameAr: 'الروابط الكيميائية', nameEn: 'Chemical Bonds', defaultTimeLimitS: 60, sort: 0 } }),
    physMotion: await prisma.label.create({ data: { areaId: physics.id, nameAr: 'الحركة', nameEn: 'Motion', defaultTimeLimitS: 60, sort: 0 } }),
    enGrammar: await prisma.label.create({ data: { areaId: englishArea.id, nameAr: 'Grammar', nameEn: 'Grammar', defaultTimeLimitS: 50, sort: 0 } }),
  };

  return { qudurat, tahsili, labels, tahsiliLabels };
}

async function seedQuestions(labels: Record<string, { id: string }>, items: SeedQuestion[]) {
  const passageCache = new Map<string, string>();
  for (const item of items) {
    let passageId: string | undefined;
    if (item.passage) {
      passageId = passageCache.get(item.passage);
      if (!passageId) {
        const passage = await prisma.passage.create({
          data: { labelId: labels[item.label].id, body: item.passage, status: 'published' },
        });
        passageId = passage.id;
        passageCache.set(item.passage, passageId);
      }
    }
    const question = await prisma.question.create({
      data: {
        labelId: labels[item.label].id,
        passageId,
        difficulty: item.difficulty,
        timeLimitS: item.timerS,
        status: item.status,
        source: 'prototype-seed',
        stemHash: stemHash(item.stem),
      },
    });
    const version = await prisma.questionVersion.create({
      data: {
        questionId: question.id,
        version: 1,
        stem: item.stem,
        options: item.options.map((o) => ({ key: o.k, text: o.t })),
        correctKey: item.correct,
        explanation: item.explanation,
      },
    });
    await prisma.question.update({ where: { id: question.id }, data: { currentVersionId: version.id } });
  }
}

async function seedPackages(qudurat: { id: string }, tahsili: { id: string }) {
  const monthly = await prisma.package.create({
    data: { nameAr: 'شهر واحد', nameEn: '1 Month', testIds: [qudurat.id], durationMonths: 1, priceHalalas: 4500, questionsPerDay: 5 },
  });
  const sixMonth = await prisma.package.create({
    data: { nameAr: '6 أشهر', nameEn: '6 Months', testIds: [qudurat.id], durationMonths: 6, priceHalalas: 14900, questionsPerDay: 5 },
  });
  const yearly = await prisma.package.create({
    data: { nameAr: 'سنة كاملة', nameEn: '12 Months', testIds: [qudurat.id, tahsili.id], durationMonths: 12, priceHalalas: 19000, questionsPerDay: 5 },
  });
  return { monthly, sixMonth, yearly };
}

async function seedPeople(qudurat: { id: string }, yearlyPackage: { id: string; priceHalalas: number }) {
  const adminPassword = 'wathb-admin-2026';
  await prisma.user.create({
    data: {
      email: 'admin@wathb.dev',
      name: 'Admin',
      role: 'admin',
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });

  const student = await prisma.user.create({
    data: {
      mobileE164: '+966500000001',
      name: 'سارة القحطاني',
      role: 'student',
      whatsappOptInAt: new Date(),
      student: {
        create: {
          track: Track.scientific,
          targetTestId: qudurat.id,
          targetScore: 90,
          testDate: new Date(Date.now() + 64 * 86400000),
        },
      },
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      mobileE164: '+966500000099',
      name: 'منى القحطاني',
      role: 'supervisor',
      supervisor: { create: { type: 'parent' } },
    },
  });

  await prisma.studentSupervisor.create({
    data: { studentId: student.id, supervisorId: supervisor.id, acceptedAt: new Date() },
  });

  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setUTCFullYear(endsAt.getUTCFullYear() + 1);
  await prisma.subscription.create({
    data: {
      studentId: student.id,
      packageId: yearlyPackage.id,
      priceSnapshotHalalas: yearlyPackage.priceHalalas,
      status: 'active',
      startsAt: now,
      endsAt,
      paymentRef: 'seed-demo',
    },
  });

  console.log('\nSeeded demo accounts:');
  console.log(`  Admin login:       admin@wathb.dev / ${adminPassword}`);
  console.log(`  Demo student mobile:    ${student.mobileE164}`);
  console.log(`  Demo supervisor mobile: ${supervisor.mobileE164}`);
  console.log('  Log in on the student/supervisor app with either mobile number — OTP is echoed back');
  console.log('  in the request-code response when ALLOW_DEV_LOGIN=true (see api/.env.example).\n');
}

async function seedAdvice(labels: Record<string, { id: string }>) {
  // A handful of hand-written strings — spec §6.5 says ~60 written by a subject
  // expert outperforms generated text. This is a demonstration seed, not the library.
  await prisma.adviceRule.createMany({
    data: [
      { labelId: labels.oddOneOut.id, accuracyBand: 'low', speedBand: 'slow', textAr: 'إجابتك في «المفردة الشاذة» ضعيفة ووقتك أبطأ من الهدف — حدّد فئة الكلمات الثلاث المشتركة أولاً قبل النظر إلى الرابعة.', textEn: 'Your Odd-One-Out accuracy is low and you are slower than target — identify the shared category of three words before looking at the fourth.' },
      { labelId: labels.charts.id, accuracyBand: 'low', speedBand: 'on_pace', textAr: 'تدرّب على قراءة الفروقات المئوية خطوة بخطوة قبل اختيار الإجابة في أسئلة تحليل البيانات.', textEn: 'Practice reading percentage differences step by step before answering data-analysis questions.' },
    ],
  });
}

async function main() {
  const { qudurat, tahsili, labels, tahsiliLabels } = await seedTaxonomy();
  await seedQuestions(labels, QUDURAT_QUESTIONS);
  await seedQuestions(tahsiliLabels, TAHSILI_QUESTIONS);
  await seedAdvice(labels);
  const { yearly } = await seedPackages(qudurat, tahsili);
  await seedPeople(qudurat, yearly);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
