"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type InputType = "paste" | "upload" | "form"

const options: { value: InputType; label: string }[] = [
  { value: "paste", label: "Paste" },
  { value: "upload", label: "Upload" },
  { value: "form", label: "Form" },
]

interface InputTypeSelectorProps {
  value: InputType
  onChange: (type: InputType) => void
}

export function InputTypeSelector({ value, onChange }: InputTypeSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground px-1">Input method</p>
      {options.map((opt) => (
        <Button
          key={opt.value}
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-start",
            value === opt.value && "bg-accent text-accent-foreground"
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  )
}
