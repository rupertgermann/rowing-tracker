interface PromptSuggestionsProps {
  label: string
  append: (message: { role: "user"; content: string }) => void
  suggestions: string[]
}

export function PromptSuggestions({
  label,
  append,
  suggestions,
}: PromptSuggestionsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-center text-2xl font-bold">{label}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm max-w-5xl mx-auto">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => append({ role: "user", content: suggestion })}
            className="w-full h-auto min-h-[60px] rounded-xl border bg-background p-4 hover:bg-muted text-center flex items-center justify-center transition-colors"
          >
            <p className="line-clamp-2">{suggestion}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
