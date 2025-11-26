import { Pencil } from "lucide-react"

interface PromptSuggestionsProps {
  label: string
  append: (message: { role: "user"; content: string }) => void
  suggestions: string[]
  onEditSuggestion?: (suggestion: string) => void
}

export function PromptSuggestions({
  label,
  append,
  suggestions,
  onEditSuggestion,
}: PromptSuggestionsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-center text-2xl font-bold">{label}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm max-w-5xl mx-auto">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion}
            className="group relative w-full h-auto min-h-[60px] rounded-xl border bg-background hover:bg-muted transition-colors"
          >
            <button
              onClick={() => append({ role: "user", content: suggestion })}
              className="w-full h-full p-4 pr-10 text-center flex items-center justify-center"
            >
              <p className="line-clamp-4">{suggestion}</p>
            </button>
            {onEditSuggestion && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEditSuggestion(suggestion)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-opacity"
                title="Edit before sending"
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
