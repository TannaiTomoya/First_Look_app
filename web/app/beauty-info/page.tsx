import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";

const FEED = [
  {
    date: "毎朝",
    tag: "洗顔",
    title: "洗顔は「ぬるま湯32度・20秒」で十分",
    body: "熱いお湯と長時間の洗顔は皮脂を取りすぎてテカリの原因に。朝は泡洗顔なしでもOKな日が多い。",
  },
  {
    date: "毎日",
    tag: "保湿",
    title: "化粧水→乳液の2ステップだけ習慣化",
    body: "スキンケアの効果の8割は「続けること」。高い製品より、毎日続く安い製品。洗顔後60秒以内に。",
  },
  {
    date: "週1",
    tag: "眉",
    title: "眉下1列だけ抜く。上は触らない",
    body: "眉は「下のラインを整える」だけで清潔感が段違い。上を剃ると不自然になりやすい。月1の眉サロンも◎（3,000円前後）。",
  },
  {
    date: "週2-3",
    tag: "髪",
    title: "スタイリングより「シャンプー後の乾かし方」",
    body: "ドライヤーは根元から。前髪を最初に乾かすとキマる。ワックスは米粒2つ分から。",
  },
  {
    date: "毎晩",
    tag: "睡眠",
    title: "肌は寝ている間に作られる",
    body: "6時間未満の睡眠が続くと皮脂分泌が増え、くすみが出る。寝る90分前の入浴で入眠の質が上がる。",
  },
  {
    date: "月1",
    tag: "ヒゲ",
    title: "カミソリ負けするなら電動+保湿",
    body: "剃った直後の化粧水は必須。青ヒゲが気になるなら医療脱毛の無料カウンセリングで見積もりだけ取るのも手。",
  },
  {
    date: "毎日",
    tag: "姿勢",
    title: "顔より先に「姿勢」が見られている",
    body: "猫背は第一印象を大きく下げる。スマホを目線の高さへ。壁に背中をつけて10秒×3回。",
  },
  {
    date: "週3",
    tag: "運動",
    title: "有酸素20分で血色が変わる",
    body: "ランニングや早歩き20分で顔色が明るくなる。筋トレは首・肩まわりを鍛えるとスーツが似合う。",
  },
];

export const metadata = { title: "メンズ美容情報 | FirstLook" };

export default function BeautyInfoPage() {
  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">メンズ美容タイムライン</h1>
      <p className="mt-1 text-sm text-muted">今日からできる習慣だけを厳選。上から順に取り入れればOK。</p>

      <div className="mt-6 space-y-4 border-l-2 border-brand/30 pl-5">
        {FEED.map((item, i) => (
          <Card key={i} className="relative">
            <span className="absolute -left-[27px] top-7 h-3 w-3 rounded-full bg-brand" />
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-brand/10 px-2 py-0.5 font-semibold text-brand">{item.tag}</span>
              <span className="text-muted">{item.date}</span>
            </div>
            <h2 className="mt-2 font-semibold">{item.title}</h2>
            <p className="mt-1 text-sm text-muted">{item.body}</p>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
