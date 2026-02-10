import { EventState } from "./types";

export function getEventState(startAt: Date, endAt: Date, now = new Date()): EventState {
  if (now < startAt) {
    return "upcoming";
  }
  if (now >= startAt && now < endAt) {
    return "live";
  }
  return "ended";
}
