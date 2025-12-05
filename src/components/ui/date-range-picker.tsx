"use client"

import * as React from "react"
import { format, startOfMonth, subMonths, isSameMonth } from "date-fns"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  /** Array of dates that have data - used to determine available months */
  availableDates?: Date[]
}

export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder = "Pick a date range",
  disabled = false,
  availableDates = [],
}: DateRangePickerProps) {
  const now = new Date()
  
  // Calculate the range of months with data
  const { earliestMonth, monthsWithData } = React.useMemo(() => {
    if (availableDates.length === 0) {
      // Default to showing last 12 months if no data provided
      return {
        earliestMonth: subMonths(now, 11),
        monthsWithData: [] as Date[]
      }
    }
    
    // Find all unique months with data
    const uniqueMonths = new Map<string, Date>()
    availableDates.forEach(date => {
      const d = new Date(date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!uniqueMonths.has(key)) {
        uniqueMonths.set(key, startOfMonth(d))
      }
    })
    
    const months = Array.from(uniqueMonths.values()).sort((a, b) => a.getTime() - b.getTime())
    
    return {
      earliestMonth: months[0] || subMonths(now, 11),
      monthsWithData: months
    }
  }, [availableDates, now])
  
  // Current month being displayed (the RIGHT calendar shows this month)
  const [displayMonth, setDisplayMonth] = React.useState<Date>(() => {
    // Start with current month on the right
    return startOfMonth(now)
  })
  
  // The left calendar shows the previous month
  const leftMonth = subMonths(displayMonth, 1)
  
  // Navigation handlers
  const canGoBack = leftMonth > earliestMonth || isSameMonth(leftMonth, earliestMonth)
  const canGoForward = !isSameMonth(displayMonth, now)
  
  const goToPreviousMonth = () => {
    if (canGoBack) {
      setDisplayMonth(prev => subMonths(prev, 1))
    }
  }
  
  const goToNextMonth = () => {
    if (canGoForward) {
      setDisplayMonth(prev => {
        const next = new Date(prev)
        next.setMonth(next.getMonth() + 1)
        return next
      })
    }
  }
  
  // Determine selection state for help text
  // Note: react-day-picker sets from === to on first click, so we check for that
  const selectionState = React.useMemo(() => {
    if (!value?.from) return 'none'
    // If from and to are the same date, user just selected the start
    if (!value.to || value.from.getTime() === value.to.getTime()) return 'from-selected'
    return 'complete'
  }, [value])

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(
              "justify-start text-left font-normal text-xs",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-3 w-3" />
            {value?.from ? (
              // Check if it's a complete range (from !== to) or just first selection
              value.to && value.from.getTime() !== value.to.getTime() ? (
                <>
                  {format(value.from, "MMM d, yyyy")} -{" "}
                  {format(value.to, "MMM d, yyyy")}
                </>
              ) : (
                <>
                  {format(value.from, "MMM d, yyyy")} - <span className="text-muted-foreground italic">select end</span>
                </>
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col">
            {/* Help text showing current selection state */}
            <div className="px-4 py-2 border-b bg-muted/50">
              <p className="text-xs text-center">
                {selectionState === 'none' && (
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">Step 1:</span> Click to select <span className="font-medium text-primary">start date</span>
                  </span>
                )}
                {selectionState === 'from-selected' && (
                  <span className="text-muted-foreground">
                    <span className="text-blue-600 dark:text-blue-400">✓ Start date selected</span> — now click to select <span className="font-medium text-primary">end date</span>
                  </span>
                )}
                {selectionState === 'complete' && (
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    ✓ Range selected — click any date to start over
                  </span>
                )}
              </p>
            </div>
            
            {/* Navigation header */}
            <div className="flex items-center justify-between px-2 py-2 border-b">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={goToPreviousMonth}
                disabled={!canGoBack}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex gap-8 text-sm font-medium">
                <span>{format(leftMonth, "MMMM yyyy")}</span>
                <span>{format(displayMonth, "MMMM yyyy")}</span>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={goToNextMonth}
                disabled={!canGoForward}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Calendars */}
            <div className="flex">
              <Calendar
                mode="range"
                month={leftMonth}
                onMonthChange={() => {}} // Controlled externally
                selected={value}
                onSelect={onChange}
                numberOfMonths={1}
                disableNavigation
                toDate={now}
                classNames={{
                  month_caption: "hidden", // Hide individual month captions
                }}
              />
              <div className="border-l" />
              <Calendar
                mode="range"
                month={displayMonth}
                onMonthChange={() => {}} // Controlled externally
                selected={value}
                onSelect={onChange}
                numberOfMonths={1}
                disableNavigation
                toDate={now}
                classNames={{
                  month_caption: "hidden", // Hide individual month captions
                }}
              />
            </div>
            
            {/* Month quick-jump buttons if we have data */}
            {monthsWithData.length > 2 && (
              <div className="px-3 py-2 border-t bg-muted/30">
                <p className="text-xs text-muted-foreground mb-2">Jump to month with data:</p>
                <div className="flex flex-wrap gap-1">
                  {monthsWithData.slice(-8).map((month) => (
                    <Button
                      key={month.getTime()}
                      variant={isSameMonth(month, displayMonth) || isSameMonth(month, leftMonth) ? "secondary" : "ghost"}
                      size="sm"
                      className="text-xs h-6 px-2"
                      onClick={() => {
                        // Set displayMonth so this month appears on the right
                        // unless it's the current month, then show it on right
                        if (isSameMonth(month, now)) {
                          setDisplayMonth(startOfMonth(now))
                        } else {
                          // Show clicked month on the left, next month on right
                          const nextMonth = new Date(month)
                          nextMonth.setMonth(nextMonth.getMonth() + 1)
                          setDisplayMonth(nextMonth)
                        }
                      }}
                    >
                      {format(month, "MMM yy")}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
