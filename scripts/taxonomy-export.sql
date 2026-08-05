-- Taxonomy export: Test → Section → Area → Label, one row per label.
-- label_id is the value the bulk importer needs as its destination.
SELECT
  t."nameAr"                                   AS test_ar,
  t."nameEn"                                   AS test_en,
  t.language                                   AS test_lang,
  t."isActive"                                 AS test_active,
  s."nameAr"                                   AS section_ar,
  s."nameEn"                                   AS section_en,
  s.weight                                     AS section_weight,
  s.sort                                       AS section_sort,
  a."nameAr"                                   AS area_ar,
  a."nameEn"                                   AS area_en,
  a.sort                                       AS area_sort,
  l."nameAr"                                   AS label_ar,
  l."nameEn"                                   AS label_en,
  l.sort                                       AS label_sort,
  l."defaultTimeLimitS"                        AS time_limit_s,
  l."isRetired"                                AS label_retired,
  l.id                                         AS label_id,
  COUNT(q.id) FILTER (WHERE q.status = 'published') AS q_published,
  COUNT(q.id) FILTER (WHERE q.status = 'draft')     AS q_draft,
  COUNT(q.id) FILTER (WHERE q.status = 'in_review') AS q_in_review,
  COUNT(q.id) FILTER (WHERE q.status = 'retired')   AS q_retired,
  COUNT(q.id)                                       AS q_total
FROM tests t
JOIN sections s ON s."testId"    = t.id
JOIN areas    a ON a."sectionId" = s.id
JOIN labels   l ON l."areaId"    = a.id
LEFT JOIN questions q ON q."labelId" = l.id
GROUP BY t.id, t."nameAr", t."nameEn", t.language, t."isActive",
         s.id, s."nameAr", s."nameEn", s.weight, s.sort,
         a.id, a."nameAr", a."nameEn", a.sort,
         l.id, l."nameAr", l."nameEn", l.sort, l."defaultTimeLimitS", l."isRetired"
ORDER BY t."nameAr", s.sort, s."nameAr", a.sort, a."nameAr", l.sort, l."nameAr";
