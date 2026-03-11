import { prisma } from '@/lib/prisma'
import { PHASE_LABELS, currentQuarter } from '@/lib/db/onboarding'

// ─── Shared include for tracker → account + deal ──────────────────────────────

const trackerInclude = {
  include: {
    tracker: {
      include: {
        account: {
          select: {
            id: true, name: true,
            country: { select: { name: true } },
          },
        },
        deal: { select: { package: true, posSystem: true } },
      },
    },
  },
}

// ─── Flatten helpers ──────────────────────────────────────────────────────────

function flattenCsat(c) {
  return {
    id:             c.id,
    type:           'csat',
    trackerId:      c.trackerId,
    fromPhase:      c.fromPhase,
    toPhase:        c.toPhase,
    fromPhaseLabel: PHASE_LABELS[c.fromPhase] ?? c.fromPhase,
    toPhaseLabel:   PHASE_LABELS[c.toPhase]   ?? c.toPhase,
    score:          c.score,
    notes:          c.notes,
    completedAt:    c.completedAt,
    createdAt:      c.createdAt,
    account:        c.tracker?.account ?? null,
    deal:           c.tracker?.deal    ?? null,
  }
}

function flattenNps(n) {
  return {
    id:          n.id,
    type:        'nps',
    trackerId:   n.trackerId,
    quarter:     n.quarter,
    phase:       n.phase,
    phaseLabel:  PHASE_LABELS[n.phase] ?? n.phase,
    score:       n.score,
    notes:       n.notes,
    completedAt: n.completedAt,
    createdAt:   n.createdAt,
    account:     n.tracker?.account ?? null,
    deal:        n.tracker?.deal    ?? null,
  }
}

// ─── Statistics ───────────────────────────────────────────────────────────────

function computeCsatStats(records) {
  const scored      = records.filter(c => c.score != null)
  const total       = records.length
  const responded   = scored.length
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0
  const avgScore    = responded > 0
    ? parseFloat((scored.reduce((s, c) => s + c.score, 0) / responded).toFixed(2))
    : null
  const satisfied   = scored.filter(c => c.score >= 4).length
  // Industry standard: CSAT % = satisfied responses / total responses × 100
  // Satisfied = 4 or 5 on 1-5 scale
  const csatPct     = responded > 0 ? Math.round((satisfied / responded) * 100) : null

  // By stage-transition breakdown
  const byStageMap = {}
  for (const c of scored) {
    const key = `${c.fromPhase}→${c.toPhase}`
    if (!byStageMap[key]) {
      byStageMap[key] = {
        fromPhase: c.fromPhase,
        toPhase:   c.toPhase,
        label:     `${PHASE_LABELS[c.fromPhase]} → ${PHASE_LABELS[c.toPhase]}`,
        scores:    [],
      }
    }
    byStageMap[key].scores.push(c.score)
  }

  const byStage = Object.values(byStageMap)
    .map(({ fromPhase, toPhase, label, scores }) => ({
      fromPhase, toPhase, label,
      count:    scores.length,
      avgScore: parseFloat((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2)),
      csatPct:  Math.round((scores.filter(s => s >= 4).length / scores.length) * 100),
    }))
    // Order by natural pipeline progression
    .sort((a, b) => {
      const stages = ['DealClosure','Onboarding','Training','Incubation','AccountManagement']
      return stages.indexOf(a.fromPhase) - stages.indexOf(b.fromPhase)
    })

  return { total, responded, responseRate, avgScore, csatPct, byStage }
}

function computeNpsStats(records) {
  const scored      = records.filter(n => n.score != null)
  const total       = records.length
  const responded   = scored.length
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0

  // Industry standard NPS segments
  const promoters  = scored.filter(n => n.score >= 9).length  // 9–10
  const passives   = scored.filter(n => n.score >= 7 && n.score <= 8).length // 7–8
  const detractors = scored.filter(n => n.score <= 6).length  // 0–6

  // NPS = (Promoters − Detractors) / Total × 100  (range −100 to +100)
  const npsScore = responded > 0
    ? Math.round(((promoters - detractors) / responded) * 100)
    : null

  const promoterPct  = responded > 0 ? Math.round((promoters  / responded) * 100) : 0
  const passivePct   = responded > 0 ? Math.round((passives   / responded) * 100) : 0
  const detractorPct = responded > 0 ? Math.round((detractors / responded) * 100) : 0

  // By quarter (chronological)
  const byQuarterMap = {}
  for (const n of scored) {
    if (!byQuarterMap[n.quarter]) byQuarterMap[n.quarter] = []
    byQuarterMap[n.quarter].push(n.score)
  }

  const byQuarter = Object.entries(byQuarterMap)
    .map(([quarter, scores]) => {
      const p = scores.filter(s => s >= 9).length
      const d = scores.filter(s => s <= 6).length
      return {
        quarter,
        count:        scores.length,
        score:        Math.round(((p - d) / scores.length) * 100),
        promoterPct:  Math.round((p / scores.length) * 100),
        detractorPct: Math.round((d / scores.length) * 100),
      }
    })
    .sort((a, b) => a.quarter.localeCompare(b.quarter))

  return {
    score: npsScore,
    promoters, passives, detractors,
    total, responded, responseRate,
    promoterPct, passivePct, detractorPct,
    byQuarter,
  }
}

// ─── Main query ───────────────────────────────────────────────────────────────

export async function getSurveysData() {
  const [csatRecords, npsRecords] = await Promise.all([
    prisma.csatRecord.findMany({ ...trackerInclude, orderBy: { createdAt: 'desc' } }),
    prisma.npsRecord.findMany(  { ...trackerInclude, orderBy: { createdAt: 'desc' } }),
  ])

  const flatCsat = csatRecords.map(flattenCsat)
  const flatNps  = npsRecords.map(flattenNps)

  return {
    pending: {
      csat: flatCsat.filter(c => !c.completedAt),
      nps:  flatNps.filter(n => !n.completedAt),
    },
    completed: {
      csat: flatCsat.filter(c => c.completedAt),
      nps:  flatNps.filter(n => n.completedAt),
    },
    stats: {
      csat: computeCsatStats(csatRecords),
      nps:  computeNpsStats(npsRecords),
    },
  }
}

// ─── NPS manual trigger (idempotent) ─────────────────────────────────────────
// Creates an NPS record for a specific tracker for the given quarter.
// If one already exists (@@unique[trackerId, quarter]) it returns the existing one.

export async function triggerNpsForTracker(trackerId, quarter) {
  const tracker = await prisma.onboardingTracker.findUnique({
    where:  { id: Number(trackerId) },
    select: { id: true, phase: true },
  })
  if (!tracker) throw new Error('Tracker not found')

  try {
    return await prisma.npsRecord.create({
      data: { trackerId: tracker.id, phase: tracker.phase, quarter },
    })
  } catch {
    // Unique constraint — already exists for this quarter, return it
    return prisma.npsRecord.findFirst({
      where: { trackerId: tracker.id, quarter },
    })
  }
}
