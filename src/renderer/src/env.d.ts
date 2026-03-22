/// <reference types="vite/client" />

// ical.js does not ship TypeScript declarations — declare the minimum we use
declare module 'ical.js' {
  export function parse(input: string): unknown
  export class Component {
    constructor(jCal: unknown)
    getAllSubcomponents(name: string): Component[]
  }
  export class Event {
    constructor(component: Component)
    summary: string | null
    startDate: Time
    endDate: Time
    isRecurring(): boolean
    iterator(): RecurExpansion
  }
  export class Time {
    isDate: boolean
    toJSDate(): Date
    compare(aTime: Time): number
    static fromJSDate(aDate: Date, useUTC?: boolean): Time
  }
  export class RecurExpansion {
    next(): Time | null
  }
}
