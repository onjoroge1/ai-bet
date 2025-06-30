import { useState } from "react"

interface QuizExperienceProps {
  onNext: (experience: string) => void
  onBack: () => void
}

const options = [
  { value: "regular", label: "Yes, I bet regularly", sublabel: "More than 5 times" },
  { value: "few_times", label: "Yes, a few times", sublabel: "2-5 times" },
  { value: "once", label: "Yes, just once", sublabel: "Tried it once" },
  { value: "want_to_learn", label: "No, but I want to learn", sublabel: "Interested in starting" },
  { value: "just_for_quiz", label: "No, just here for the quiz", sublabel: "Not interested in betting" },
]

export default function QuizExperience({ onNext, onBack }: QuizExperienceProps) {
  const [selected, setSelected] = useState<string>("")
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) {
      setError("Please select an option.")
      return
    }
    setError("")
    onNext(selected)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 animate-fadeIn">
      <div className="quiz-glass max-w-2xl w-full mx-auto p-10 rounded-2xl shadow-2xl border border-slate-700">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2">Quick Question</h1>
            <div className="text-slate-400 mb-2">Help us tailor your <span className="text-emerald-400">SnapBet experience</span></div>
            <div className="text-lg font-semibold text-white mt-4">Have you ever placed a sports bet before?</div>
          </div>
          <div className="space-y-4">
            {options.map(opt => (
              <label
                key={opt.value}
                className={`block rounded-xl border transition-all cursor-pointer px-6 py-5 bg-slate-800/60 hover:bg-emerald-900/30 border-slate-700 hover:border-emerald-500 shadow-sm flex flex-col items-start ${selected === opt.value ? 'border-emerald-500 bg-emerald-900/40 ring-2 ring-emerald-400' : ''}`}
              >
                <input
                  type="radio"
                  name="experience"
                  value={opt.value}
                  checked={selected === opt.value}
                  onChange={() => setSelected(opt.value)}
                  className="hidden"
                />
                <span className="text-lg font-semibold text-white">{opt.label}</span>
                <span className="text-sm text-slate-400 mt-1">{opt.sublabel}</span>
              </label>
            ))}
          </div>
          {error && <div className="text-red-500 text-sm mt-2 text-center">{error}</div>}
          <div className="flex justify-between mt-8">
            <button type="button" onClick={onBack} className="px-5 py-2 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-600">Back</button>
            <button type="submit" className="px-8 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700">Next</button>
          </div>
        </form>
      </div>
    </div>
  )
} 