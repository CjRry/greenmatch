import { describe, expect, it } from 'vitest'
import { STAGES } from '../../src/core/constants/stages'
import type { Case } from '../../src/core/types'
import { isError, transition, whyNot, type Actor, type ActionType, type CaseAction } from '../../src/features/workspace/lib/transitions'
import { fixtureData } from '../../src/test/fixtures'

const cases = fixtureData().cases ?? []
const get = (id: string) => cases.find((c) => c.id === id) as Case
const NOW = '2026-10-27T00:00:00.000Z'
const ctx = { now: NOW, quotedVendorIds: ['v01', 'v11'] }

function run(c: Case, a: CaseAction, actor: Actor, extra = {}) {
  return transition(c, a, actor, { ...ctx, ...extra })
}
function ok(r: ReturnType<typeof transition>) {
  if (isError(r)) throw new Error(`預期成功卻失敗：${r.error}`)
  return r
}
const factoryOf = (c: Case): Actor => ({ role: 'factory', id: c.factoryId })

describe('transition：合法動作', () => {
  it('survey：廠商預約場勘不換階段，只加事件', () => {
    const c = get('c02')
    const r = ok(run(c, { type: 'schedule_survey', at: '2026-11-01T10:00:00.000Z' }, { role: 'vendor', id: c.shortlist[0] }))
    expect(r.patch.stage).toBeUndefined()
    expect(r.event.kind).toBe('schedule')
    expect(r.event.caseId).toBe(c.id)
  })

  it('survey：場勘完成 → quote', () => {
    const c = get('c02')
    const r = ok(run(c, { type: 'finish_survey' }, factoryOf(c)))
    expect(r.patch.stage).toBe('quote')
    expect(r.event.stage).toBe('survey')
  })

  it('quote：廠商提交報價不換階段', () => {
    const r = ok(run(get('c01'), { type: 'submit_quote' }, { role: 'vendor', id: 'v01' }))
    expect(r.patch.stage).toBeUndefined()
    expect(r.event.kind).toBe('quote')
  })

  it('quote：工廠選擇已報價的廠商 → contract', () => {
    const c = get('c01')
    const r = ok(run(c, { type: 'select_vendor', vendorId: 'v01' }, factoryOf(c)))
    expect(r.patch.stage).toBe('contract')
    expect(r.patch.selectedVendorId).toBe('v01')
  })

  it('contract：簽約 → construction，金額寫入', () => {
    const c = get('c04')
    const r = ok(run(c, { type: 'sign_contract', contractNtd: 1_000_000, startDate: '2026-11-01', endDate: '2026-12-01' }, factoryOf(c)))
    expect(r.patch.stage).toBe('construction')
    expect(r.patch.contractNtd).toBe(1_000_000)
  })

  it('construction：回報進度不換階段，完工 → acceptance', () => {
    const c = get('c03')
    const vendor: Actor = { role: 'vendor', id: c.selectedVendorId! }
    expect(ok(run(c, { type: 'report_progress', text: '設備已進場' }, vendor)).event.kind).toBe('progress')
    expect(ok(run(c, { type: 'finish_construction' }, vendor)).patch.stage).toBe('acceptance')
  })

  it('acceptance：工廠驗收 → compare', () => {
    const c = get('c05')
    expect(ok(run(c, { type: 'accept' }, factoryOf(c))).patch.stage).toBe('compare')
  })

  it('compare：登錄用電、完成比較 → completed', () => {
    const c = get('c07')
    const added = ok(run(c, { type: 'add_usage', month: '2026-09', kwh: 1000, phase: 'after' }, factoryOf(c)))
    expect(added.patch.usage).toBeTruthy()
    expect(ok(run(c, { type: 'complete_compare' }, factoryOf(c))).patch.status).toBe('completed')
  })

  it('事件帶時間與操作者（歷史只增不改）', () => {
    const c = get('c05')
    const r = ok(run(c, { type: 'accept' }, factoryOf(c)))
    expect(r.event.at).toBe(NOW)
    expect(r.event.actor).toBe('factory')
  })
})

describe('transition：非法動作', () => {
  it('階段不符：assess 階段不能做場勘完成', () => {
    const c = get('c08')
    expect(isError(run(c, { type: 'finish_survey' }, factoryOf(c)))).toBe(true)
  })

  it('進行中案件，非當前階段的動作一律被擋', () => {
    const belongs: Partial<Record<ActionType, string>> = {
      finish_survey: 'survey',
      accept: 'acceptance',
      finish_construction: 'construction',
      complete_compare: 'compare',
    }
    for (const c of cases.filter((x) => x.status === 'active')) {
      for (const [type, stage] of Object.entries(belongs)) {
        if (c.stage === stage) continue
        expect(whyNot(c, type as ActionType, factoryOf(c)), `${c.id}/${type}`).not.toBeNull()
      }
    }
  })

  it('角色不符：廠商不能驗收，工廠不能預約場勘', () => {
    const c5 = get('c05')
    expect(isError(run(c5, { type: 'accept' }, { role: 'vendor', id: c5.selectedVendorId! }))).toBe(true)
    const c2 = get('c02')
    expect(isError(run(c2, { type: 'schedule_survey', at: '2026-11-01T10:00:00.000Z' }, factoryOf(c2)))).toBe(true)
  })

  it('別家工廠、不在名單的廠商都不能操作', () => {
    const c = get('c02')
    expect(isError(run(c, { type: 'finish_survey' }, { role: 'factory', id: 'f12' }))).toBe(true)
    expect(isError(run(c, { type: 'schedule_survey', at: '2026-11-01T10:00:00.000Z' }, { role: 'vendor', id: 'v99' }))).toBe(true)
  })

  it('未登入不能操作', () => {
    expect(whyNot(get('c02'), 'finish_survey', null)).not.toBeNull()
  })

  it('已完成的案件任何動作都被擋', () => {
    const c = get('c06')
    expect(c.status).toBe('completed')
    expect(isError(run(c, { type: 'complete_compare' }, factoryOf(c)))).toBe(true)
  })

  it('選擇未報價或不在名單的廠商會失敗', () => {
    const c = get('c01')
    expect(isError(run(c, { type: 'select_vendor', vendorId: 'v01' }, factoryOf(c), { quotedVendorIds: [] }))).toBe(true)
    expect(isError(run(c, { type: 'select_vendor', vendorId: 'v09' }, factoryOf(c)))).toBe(true)
  })

  it('輸入驗證：金額、日期、進度、月份、度數、星等', () => {
    const c4 = get('c04')
    expect(isError(run(c4, { type: 'sign_contract', contractNtd: 0, startDate: '2026-11-01', endDate: '2026-12-01' }, factoryOf(c4)))).toBe(true)
    expect(isError(run(c4, { type: 'sign_contract', contractNtd: 100, startDate: '2026-12-01', endDate: '2026-11-01' }, factoryOf(c4)))).toBe(true)
    const c3 = get('c03')
    expect(isError(run(c3, { type: 'report_progress', text: '   ' }, { role: 'vendor', id: c3.selectedVendorId! }))).toBe(true)
    const c7 = get('c07')
    expect(isError(run(c7, { type: 'add_usage', month: '2026-13', kwh: 10, phase: 'before' }, factoryOf(c7)))).toBe(true)
    expect(isError(run(c7, { type: 'add_usage', month: '2026-09', kwh: 0, phase: 'before' }, factoryOf(c7)))).toBe(true)
    const c5 = get('c05')
    expect(isError(run(c5, { type: 'review', rating: 6 }, factoryOf(c5)))).toBe(true)
  })

  it('compare：沒有改善前後用電紀錄不能完成', () => {
    const c = { ...get('c07'), usage: [] }
    expect(isError(run(c, { type: 'complete_compare' }, factoryOf(c)))).toBe(true)
  })

  it('標準階段共 8 個', () => {
    expect(STAGES).toHaveLength(8)
  })
})
