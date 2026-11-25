import { answerQuestion, collectOverview } from './ops-core.mjs'

const query = process.argv.slice(2).join(' ').trim()
const overview = collectOverview()
const res = answerQuestion(query, overview)

console.log(`\n[GreenMatch 即時進度問答] 問題：${res.question}`)
console.log(`結論：${res.headline}\n`)
for (const b of res.bullets) console.log(`- ${b}`)
if (res.nextActions.length) {
  console.log('\n下一步建議：')
  for (const a of res.nextActions) console.log(`→ ${a}`)
}
console.log(`\n參考來源：${res.sources.join('、')}\n`)
